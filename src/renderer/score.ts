import { actualNotePerBeat, type Document, type Measure, type Note, type Pitch, type PitchNote } from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";
import { flattenNotes, layoutLine, measureXOffset, type LineLayout } from "./layout.js";
import { chordHeight, maxAccidentalOffset, noteTieAfter, widthOf } from "./metrics.js";
import type { JustifyMode } from "./options.js";
import { escapeXml } from "./xml.js";

const accidentalMap = new Map([
  [2, "&#119082;"],
  [1, "&#9839;"],
  [0, "&#9838;"],
  [-1, "&#9837;"],
  [-2, "&#119083;"],
]);

function lastMeasure(document: Document): Measure | undefined {
  return document.score.at(-1)?.measures.at(-1);
}

function renderOctaveDots(pitch: Pitch, x: number, y: number, isBase: boolean, halves: number): string {
  const parts: string[] = [];
  if (pitch.octave > 0) {
    for (let i = 0; i < pitch.octave; i += 1) {
      parts.push(`<circle class="dot" cx="${x}" cy="${y - DIMENSIONS.octaveDotVerticalOffset - i * DIMENSIONS.octaveSpacing}" r="2"/>`);
    }
  }
  if (pitch.octave < 0) {
    const underlineOffset = isBase ? halves : 0;
    for (let i = 0; i < Math.abs(pitch.octave); i += 1) {
      parts.push(
        `<circle class="dot" cx="${x}" cy="${y + DIMENSIONS.octaveDotBelowOffset + (i + underlineOffset) * DIMENSIONS.octaveSpacing}" r="2"/>`,
      );
    }
  }
  return parts.join("");
}

function renderPitchNote(note: PitchNote, x: number, y: number): string {
  const parts: string[] = [];
  const maxOffset = maxAccidentalOffset(note.chord);
  let currentY = 0;
  const positions: Array<{ pitch: Pitch; y: number; isBase: boolean }> = [];

  for (let index = note.chord.length - 1; index >= 0; index -= 1) {
    const pitch = note.chord[index]!;
    const isBase = index === note.chord.length - 1;
    if (!isBase && pitch.octave < 0) {
      currentY -= Math.abs(pitch.octave) * DIMENSIONS.octaveSpacing;
    }
    positions.unshift({ pitch, y: y + currentY, isBase });
    currentY -= DIMENSIONS.baseNoteHeight;
    if (pitch.octave > 0) {
      currentY -= pitch.octave * DIMENSIONS.octaveSpacing;
    }
  }

  for (const position of positions) {
    const accidental = position.pitch.accidental;
    if (accidental !== undefined) {
      parts.push(
        `<text class="accidental" x="${x}" y="${position.y - DIMENSIONS.accidentalVerticalOffset}">${accidentalMap.get(accidental)}</text>`,
      );
    }
    const noteX = x + maxOffset;
    parts.push(`<text class="note" x="${noteX}" y="${position.y}" text-anchor="middle">${position.pitch.note}</text>`);
    parts.push(renderOctaveDots(position.pitch, noteX, position.y, position.isBase, note.duration.halves));
  }

  return parts.join("");
}

function renderDuration(note: Note, x: number, y: number, full: boolean): string {
  const parts: string[] = [];
  const maxOffset = note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0;
  for (let i = 0; i < note.duration.halves; i += 1) {
    const underlineY = y + DIMENSIONS.octaveDotBelowOffset + i * DIMENSIONS.underlineSpacing;
    const x2 = (full ? 10 : DIMENSIONS.underlineXEndOffset + note.duration.dots * DIMENSIONS.dotSpacing) + maxOffset;
    parts.push(
      `<line class="underline" x1="${x + DIMENSIONS.underlineXStart}" y1="${underlineY}" x2="${x + x2}" y2="${underlineY}"/>`,
    );
  }
  for (let i = 0; i < note.duration.dots; i += 1) {
    parts.push(`<circle class="dot" cx="${x + DIMENSIONS.dotXOffset + i * DIMENSIONS.dotSpacing + maxOffset}" cy="${y - 9}" r="3"/>`);
  }
  for (let i = 0; i < note.duration.dashes; i += 1) {
    const dashX = x + DIMENSIONS.dashXOffset + i * DIMENSIONS.dashSpacing + maxOffset;
    parts.push(`<line class="dash" x1="${dashX + 2}" y1="${y - 9}" x2="${dashX + 18}" y2="${y - 9}"/>`);
  }
  return parts.join("");
}

function renderRestOrDrum(note: Note, x: number, y: number): string {
  const text = note.kind === "drum" ? "X" : "0";
  return `<text class="note" x="${x}" y="${y}" text-anchor="middle">${text}</text>`;
}

function renderTie(startX: number, endX: number, y: number, chordHeightValue: number): string {
  if (endX <= startX) {
    return "";
  }
  const midX = (startX + endX) / 2;
  const yOffset = chordHeightValue > DIMENSIONS.baseNoteHeight ? -(chordHeightValue - DIMENSIONS.baseNoteHeight) - 2 : 0;
  const tieY = y + yOffset;
  return `<path class="tie" d="M${startX},${tieY} Q${midX},${tieY - DIMENSIONS.tieHeight} ${endX},${tieY} Q${midX},${tieY - DIMENSIONS.tieCurveHeight} ${startX},${tieY} Z"/>`;
}

function tieYOf(y: number, chordHeightValue: number): number {
  const yOffset = chordHeightValue > DIMENSIONS.baseNoteHeight ? -(chordHeightValue - DIMENSIONS.baseNoteHeight) - 2 : 0;
  return y + yOffset;
}

function renderIncomingTie(edgeX: number, endX: number, y: number, chordHeightValue: number): string {
  if (endX <= edgeX) {
    return "";
  }
  const tieY = tieYOf(y, chordHeightValue);
  const topCutX = edgeX;
  const topCutY = tieY - DIMENSIONS.tieHeight / 2;
  const bottomCutX = edgeX;
  const bottomCutY = tieY - DIMENSIONS.tieCurveHeight / 2;
  const topControlX = (edgeX + endX) / 2;
  const bottomControlX = topControlX;
  return `<path class="tie" d="M${topCutX},${topCutY} Q${topControlX},${topCutY} ${endX},${tieY} Q${bottomControlX},${bottomCutY} ${bottomCutX},${bottomCutY} Z"/>`;
}

function renderOutgoingTie(startX: number, edgeX: number, y: number, chordHeightValue: number): string {
  if (edgeX <= startX) {
    return "";
  }
  const tieY = tieYOf(y, chordHeightValue);
  const topCutX = edgeX;
  const topCutY = tieY - DIMENSIONS.tieHeight / 2;
  const bottomCutX = edgeX;
  const bottomCutY = tieY - DIMENSIONS.tieCurveHeight / 2;
  const topControlX = (startX + edgeX) / 2;
  const bottomControlX = topControlX;
  return `<path class="tie" d="M${startX},${tieY} Q${topControlX},${topCutY} ${topCutX},${topCutY} L${bottomCutX},${bottomCutY} Q${bottomControlX},${bottomCutY} ${startX},${tieY} Z"/>`;
}

function renderRepeatDots(x: number, baselineY: number): string {
  const yOffset = DIMENSIONS.barVerticalOffset;
  return [
    `<circle class="repeat-dot" cx="${x}" cy="${baselineY - 16 + yOffset}" r="2.5"/>`,
    `<circle class="repeat-dot" cx="${x}" cy="${baselineY - 6 + yOffset}" r="2.5"/>`,
  ].join("");
}

function renderBar(x: number, baselineY: number, final: boolean, repeatEnd = false): string {
  const yOffset = DIMENSIONS.barVerticalOffset;
  const y1 = baselineY - DIMENSIONS.baseNoteHeight - 4 + yOffset;
  const y2 = baselineY + 4 + yOffset;
  if (repeatEnd) {
    return [
      renderRepeatDots(x - 8, baselineY),
      `<line class="bar-thin" x1="${x - 2}" y1="${y1}" x2="${x - 2}" y2="${y2}"/>`,
      `<line class="bar-final" x1="${x + 5}" y1="${y1}" x2="${x + 5}" y2="${y2}"/>`,
    ].join("");
  }
  if (final) {
    return [
      `<line class="bar-thin" x1="${x - 5}" y1="${y1}" x2="${x - 5}" y2="${y2}"/>`,
      `<line class="bar-final" x1="${x + 2}" y1="${y1}" x2="${x + 2}" y2="${y2}"/>`,
    ].join("");
  }
  return `<line class="bar-thin" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`;
}

function renderRepeatStart(x: number, baselineY: number): string {
  const yOffset = DIMENSIONS.barVerticalOffset;
  const y1 = baselineY - DIMENSIONS.baseNoteHeight - 4 + yOffset;
  const y2 = baselineY + 4 + yOffset;
  return [
    `<line class="bar-final" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`,
    `<line class="bar-thin" x1="${x + 7}" y1="${y1}" x2="${x + 7}" y2="${y2}"/>`,
    renderRepeatDots(x + 18, baselineY),
  ].join("");
}

function measureFullness(measure: Measure, unit: number): boolean[] {
  let duration = 0;
  return measure.notes.map((note) => {
    duration += note.duration.value;
    return Math.abs(duration % unit) < 1e-9;
  });
}

function createLineJustifier(layout: LineLayout, targetWidth: number, enabled: boolean): (x: number) => number {
  if (!enabled || targetWidth <= layout.width) {
    return (x: number) => x;
  }
  const firstNoteX = DIMENSIONS.leftPadding;
  const naturalEndX = layout.width - DIMENSIONS.leftPadding + 12;
  const targetEndX = targetWidth - DIMENSIONS.leftPadding / 3;
  if (naturalEndX <= firstNoteX || targetEndX <= firstNoteX) {
    return (x: number) => x;
  }
  const scale = (targetEndX - firstNoteX) / (naturalEndX - firstNoteX);
  return (x: number) => firstNoteX + (x - firstNoteX) * scale;
}

function renderLine(layout: LineLayout, lineY: number, allNotes: Note[], document: Document, activeNoteIndex: number, justifyLine: boolean, visualWidth: number): string {
  const parts: string[] = [];
  const lineEntries: Array<{ note: Note; x: number; y: number; full: boolean }> = [];
  const unit = actualNotePerBeat(document.header.timeSignature);
  const finalMeasure = lastMeasure(document);
  const labelOffset = layout.line.label ? DIMENSIONS.labelWidth : 0;
  const justifyX = createLineJustifier(layout, visualWidth - labelOffset, justifyLine);
  const leftTieEdgeX = labelOffset;
  const rightTieEdgeX = labelOffset + justifyX(layout.width - DIMENSIONS.leftPadding + 12);
  if (layout.line.label) {
    parts.push(`<text class="line-label" x="8" y="${lineY + layout.maxPaddingUp}" text-anchor="start">${escapeXml(layout.line.label)}</text>`);
  }
  for (const [measureIndex, measureLayout] of layout.measures.entries()) {
    const xOffset = measureXOffset(layout.measures, measureIndex);
    const fullness = measureFullness(measureLayout.measure, unit);
    const nextMeasure = layout.measures[measureIndex + 1]?.measure;
    if (measureLayout.measure.repeatStart) {
      const naturalStartX = xOffset + (measureLayout.repeatStartX ?? 0);
      const startX = labelOffset + justifyX(naturalStartX);
      parts.push(renderRepeatStart(startX, lineY + layout.maxPaddingUp + DIMENSIONS.noteBottomPadding));
    }
    let groupStartX: number | null = null;
    let groupDuration = 0;
    for (const [noteIndex, note] of measureLayout.measure.notes.entries()) {
      const naturalX = xOffset + measureLayout.notePositions[noteIndex]! + measureLayout.leftPadding;
      groupStartX ??= naturalX;
      const groupShift = justifyX(groupStartX) - groupStartX;
      lineEntries.push({
        note,
        x: labelOffset + naturalX + groupShift,
        y: lineY + layout.maxPaddingUp,
        full: fullness[noteIndex] ?? false,
      });
      groupDuration += note.duration.value;
      if (Math.abs(groupDuration % unit) < 1e-9) {
        groupStartX = null;
        groupDuration = 0;
      }
    }
    if (nextMeasure?.repeatStart) {
      continue;
    }
    const naturalBarX = xOffset + measureLayout.width - DIMENSIONS.repeatRightPadding + 12;
    const barX = naturalBarX + (measureLayout.measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0);
    parts.push(
      renderBar(
        labelOffset + justifyX(barX),
        lineY + layout.maxPaddingUp + DIMENSIONS.noteBottomPadding,
        measureLayout.measure === finalMeasure,
        measureLayout.measure.repeatEnd,
      ),
    );
  }

  for (const [index, entry] of lineEntries.entries()) {
    const previous = lineEntries[index - 1];
    if (entry.note.tie && previous) {
      const startX = previous.x + (previous.note.kind === "pitch" ? maxAccidentalOffset(previous.note.chord) : 0);
      const endX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      parts.push(renderTie(startX, endX, lineY + layout.maxPaddingUp - DIMENSIONS.tiePadding, Math.max(chordHeight(previous.note), chordHeight(entry.note))));
    } else if (entry.note.tie) {
      const endX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      parts.push(renderIncomingTie(leftTieEdgeX, endX, lineY + layout.maxPaddingUp - DIMENSIONS.tiePadding, chordHeight(entry.note)));
    }
    if (noteTieAfter(entry.note, allNotes) && index === lineEntries.length - 1) {
      const startX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      parts.push(renderOutgoingTie(startX, rightTieEdgeX, lineY + layout.maxPaddingUp - DIMENSIONS.tiePadding, chordHeight(entry.note)));
    }

    const className = entry.note.index === activeNoteIndex ? "note-item active" : "note-item";
    const noteParts: string[] = [];
    if (entry.note.kind === "pitch") {
      noteParts.push(renderPitchNote(entry.note, entry.x, entry.y));
    } else {
      noteParts.push(renderRestOrDrum(entry.note, entry.x, entry.y));
    }
    noteParts.push(renderDuration(entry.note, entry.x, entry.y, entry.full));
    parts.push(`<g class="${className}" data-note-index="${entry.note.index}">${noteParts.join("")}</g>`);
  }

  return parts.join("\n");
}

function lineVisualWidth(layout: LineLayout): number {
  return layout.width + (layout.line.label ? DIMENSIONS.labelWidth : 0);
}

export function renderScore(document: Document, yStart: number, pageWidth: number, activeNoteIndex: number, justifyMode: JustifyMode): { svg: string; height: number; width: number } {
  const allNotes = flattenNotes(document);
  const layouts = document.score.flatMap((line) => {
    const labelOffset = line.label ? DIMENSIONS.labelWidth : 0;
    return layoutLine(line, allNotes, Math.max(1, pageWidth - labelOffset));
  });
  let y = yStart;
  const parts: string[] = [];
  for (const [index, layout] of layouts.entries()) {
    const width = lineVisualWidth(layout);
    const scaleX = width > pageWidth ? pageWidth / width : 1;
    const visualWidth = scaleX < 1 ? width : pageWidth;
    const shouldJustify = justifyMode === "all" || (justifyMode === "except-last" && index < layouts.length - 1);
    const line = renderLine(layout, y, allNotes, document, activeNoteIndex, shouldJustify && scaleX === 1, visualWidth);
    parts.push(scaleX < 1 ? `<g class="score-line scaled" transform="scale(${scaleX},1)">${line}</g>` : line);
    y += layout.height + DIMENSIONS.lineSpacing;
  }
  return {
    svg: parts.join("\n"),
    width: Math.min(pageWidth, Math.max(0, ...layouts.map(lineVisualWidth))),
    height: layouts.reduce((sum, layout) => sum + layout.height + DIMENSIONS.lineSpacing, 0),
  };
}
