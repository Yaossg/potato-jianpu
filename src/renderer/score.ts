import { actualNotePerBeat, type Document, type LyricLine, type Measure, type Note, type Pitch, type PitchNote, type ScoreLine } from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";
import { labelOffsetForTexts, lyricLineDisplayLabel, scoreLineDisplayLabel } from "./labels.js";
import { flattenNotes, layoutLine, lineWidth, measureXOffset, type LineLayout, type MeasureLayout } from "./layout.js";
import { chordHeight, maxAccidentalOffset, widthOf } from "./metrics.js";
import type { JustifyMode } from "./options.js";
import { escapeXml } from "./xml.js";

const accidentalMap = new Map([
  [2, "&#119082;"],
  [1, "&#9839;"],
  [0, "&#9838;"],
  [-1, "&#9837;"],
  [-2, "&#119083;"],
]);
const LYRIC_CHARACTER_WIDTH = 9;

interface RenderedLine {
  svg: string;
  lyricAnchors: number[];
}

interface LineEntry {
  note: Note;
  x: number;
  y: number;
  full: boolean;
  dashAnchors: number[];
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

function renderDuration(note: Note, x: number, y: number, full: boolean, dashAnchors: number[]): string {
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
  for (const dashAnchor of dashAnchors) {
    parts.push(`<line class="dash" x1="${dashAnchor - 10}" y1="${y - 9}" x2="${dashAnchor + 6}" y2="${y - 9}"/>`);
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
    renderRepeatDots(x + 13, baselineY),
  ].join("");
}

function renderRepeatBoth(x: number, baselineY: number): string {
  const yOffset = DIMENSIONS.barVerticalOffset;
  const y1 = baselineY - DIMENSIONS.baseNoteHeight - 4 + yOffset;
  const y2 = baselineY + 4 + yOffset;
  return [
    renderRepeatDots(x - 8, baselineY),
    `<line class="bar-thin" x1="${x - 2}" y1="${y1}" x2="${x - 2}" y2="${y2}"/>`,
    `<line class="bar-final" x1="${x + 5}" y1="${y1}" x2="${x + 5}" y2="${y2}"/>`,
    `<line class="bar-thin" x1="${x + 12}" y1="${y1}" x2="${x + 12}" y2="${y2}"/>`,
    renderRepeatDots(x + 18, baselineY),
  ].join("");
}

function sameEnding(left: number[] | undefined, right: number[] | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return left.length === right.length && left.every((ending, index) => ending === right[index]);
}

function formatEnding(endings: number[]): string {
  return endings.join(",");
}

function renderEnding(ending: number[], startX: number, endX: number, noteY: number, openEnd = false): string {
  const y = noteY - DIMENSIONS.baseNoteHeight - DIMENSIONS.endingTopOffset;
  const labelX = startX + 4;
  const path = openEnd ? `M${startX},${y + 8} V${y} H${endX}` : `M${startX},${y + 8} V${y} H${endX} V${y + 8}`;
  return [
    `<path class="ending-line" d="${path}"/>`,
    `<text class="ending-label" x="${labelX}" y="${y - 4}" text-anchor="start">${formatEnding(ending)}.</text>`,
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

function nextMeasureInDocument(document: Document, measure: Measure): Measure | undefined {
  const measures = document.score.flatMap((line) => line.measures);
  const index = measures.indexOf(measure);
  return index < 0 ? undefined : measures[index + 1];
}

function hasLaterDifferentEnding(document: Document, measure: Measure): boolean {
  const measures = document.score.flatMap((line) => line.measures);
  const index = measures.indexOf(measure);
  if (index < 0 || measure.ending === undefined) {
    return false;
  }
  for (const candidate of measures.slice(index + 1)) {
    if (candidate.repeatStart) {
      return false;
    }
    if (candidate.ending !== undefined && !sameEnding(candidate.ending, measure.ending)) {
      return true;
    }
  }
  return false;
}

function notesInLine(line: ScoreLine): Note[] {
  return line.measures.flatMap((measure) => measure.notes);
}

function previousNoteInSequence(notes: Note[], note: Note): Note | undefined {
  const index = notes.indexOf(note);
  return index > 0 ? notes[index - 1] : undefined;
}

function nextNoteInSequence(notes: Note[], note: Note): Note | undefined {
  const index = notes.indexOf(note);
  return index >= 0 ? notes[index + 1] : undefined;
}

function lineNotesByTrack(document: Document): Map<ScoreLine, Note[]> {
  const hasLabels = document.score.some((line) => line.label !== undefined);
  if (!hasLabels) {
    return new Map(document.score.map((line) => [line, notesInLine(line)]));
  }

  const notesByTrack = new Map<string, Note[]>();
  for (const line of document.score) {
    const trackLabel = line.label ?? "";
    notesByTrack.set(trackLabel, [...(notesByTrack.get(trackLabel) ?? []), ...notesInLine(line)]);
  }

  return new Map(document.score.map((line) => [line, notesByTrack.get(line.label ?? "") ?? notesInLine(line)]));
}

function renderLine(
  layout: LineLayout,
  lineY: number,
  document: Document,
  activeNoteIndices: Set<number>,
  justifyLine: boolean,
  visualWidth: number,
  labelOffset: number,
  bracketOffset: number,
  defaultTrackLabel: string,
  finalBarMeasures: Set<Measure>,
  notesByLine: Map<ScoreLine, Note[]>,
): RenderedLine {
  const parts: string[] = [];
  const lineEntries: LineEntry[] = [];
  const trackNotes = notesByLine.get(layout.line) ?? notesInLine(layout.line);
  const unit = actualNotePerBeat(document.header.timeSignature);
  const displayLabel = scoreLineDisplayLabel(document, layout.line, defaultTrackLabel);
  const contentOffset = labelOffset + bracketOffset;
  const justifyX = createLineJustifier(layout, visualWidth - contentOffset - bracketOffset, justifyLine);
  const leftTieEdgeX = contentOffset;
  const rightTieEdgeX = contentOffset + justifyX(layout.width - DIMENSIONS.leftPadding + 12);
  if (displayLabel) {
    parts.push(`<text class="line-label" x="8" y="${lineY + layout.maxPaddingUp}" text-anchor="start">${escapeXml(displayLabel)}</text>`);
  }
  for (const [measureIndex, measureLayout] of layout.measures.entries()) {
    const xOffset = measureXOffset(layout.measures, measureIndex);
    const fullness = measureFullness(measureLayout.measure, unit);
    const previousMeasure = layout.measures[measureIndex - 1]?.measure;
    const nextMeasure = layout.measures[measureIndex + 1]?.measure;
    const naturalBarX = xOffset + measureLayout.width - measureLayout.rightPadding - DIMENSIONS.repeatRightPadding + 12;
    if (measureLayout.measure.ending !== undefined && !sameEnding(previousMeasure?.ending, measureLayout.measure.ending)) {
      let endingEndMeasureIndex = measureIndex;
      while (sameEnding(layout.measures[endingEndMeasureIndex + 1]?.measure.ending, measureLayout.measure.ending)) {
        endingEndMeasureIndex += 1;
      }
      const endingEndLayout = layout.measures[endingEndMeasureIndex]!;
      const endingEndXOffset = measureXOffset(layout.measures, endingEndMeasureIndex);
      const endingNaturalBarX = endingEndXOffset + endingEndLayout.width - endingEndLayout.rightPadding - DIMENSIONS.repeatRightPadding + 12;
      const endingStartX = xOffset + measureLayout.leftPadding - DIMENSIONS.leftPadding / 2 - DIMENSIONS.endingLeftOverhang;
      const endingEndX = endingNaturalBarX + (endingEndLayout.measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0);
      const openEnd =
        sameEnding(nextMeasureInDocument(document, endingEndLayout.measure)?.ending, measureLayout.measure.ending) ||
        !hasLaterDifferentEnding(document, measureLayout.measure);
      parts.push(
        renderEnding(
          measureLayout.measure.ending,
          contentOffset + justifyX(endingStartX),
          contentOffset + justifyX(endingEndX),
          lineY + layout.maxPaddingUp,
          openEnd,
        ),
      );
    }
    if (measureLayout.measure.repeatStart && !previousMeasure?.repeatEnd) {
      const naturalStartX = xOffset + (measureLayout.repeatStartX ?? 0);
      const startX = contentOffset + justifyX(naturalStartX);
      parts.push(renderRepeatStart(startX, lineY + layout.maxPaddingUp + DIMENSIONS.noteBottomPadding));
    }
    let groupStartX: number | null = null;
    let groupDuration = 0;
    for (const [noteIndex, note] of measureLayout.measure.notes.entries()) {
      const naturalX = xOffset + measureLayout.notePositions[noteIndex]! + measureLayout.leftPadding;
      groupStartX ??= naturalX;
      const groupShift = justifyX(groupStartX) - groupStartX;
      const dashAnchors = measureLayout.dashPositions[noteIndex]!.map((dashPosition) => {
        const naturalDashX = xOffset + dashPosition + measureLayout.leftPadding;
        return contentOffset + justifyX(naturalDashX);
      });
      lineEntries.push({
        note,
        x: contentOffset + naturalX + groupShift,
        y: lineY + layout.maxPaddingUp,
        full: fullness[noteIndex] ?? false,
        dashAnchors,
      });
      groupDuration += note.duration.value;
      if (Math.abs(groupDuration % unit) < 1e-9) {
        groupStartX = null;
        groupDuration = 0;
      }
    }
    if (nextMeasure?.repeatStart) {
      if (measureLayout.measure.repeatEnd) {
        const barX = naturalBarX + DIMENSIONS.repeatEndLeftGap;
        parts.push(renderRepeatBoth(contentOffset + justifyX(barX), lineY + layout.maxPaddingUp + DIMENSIONS.noteBottomPadding));
      }
      continue;
    }
    const barX = naturalBarX + (measureLayout.measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0);
    parts.push(
      renderBar(
        contentOffset + justifyX(barX),
        lineY + layout.maxPaddingUp + DIMENSIONS.noteBottomPadding,
        finalBarMeasures.has(measureLayout.measure),
        measureLayout.measure.repeatEnd,
      ),
    );
  }

  for (const entry of lineEntries) {
    const previousNote = previousNoteInSequence(trackNotes, entry.note);
    const previous = previousNote ? lineEntries.find((candidate) => candidate.note === previousNote) : undefined;
    if (entry.note.tie && previous) {
      const startX = previous.x + (previous.note.kind === "pitch" ? maxAccidentalOffset(previous.note.chord) : 0);
      const endX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      parts.push(renderTie(startX, endX, lineY + layout.maxPaddingUp - DIMENSIONS.tiePadding, Math.max(chordHeight(previous.note), chordHeight(entry.note))));
    } else if (entry.note.tie) {
      const endX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      parts.push(renderIncomingTie(leftTieEdgeX, endX, lineY + layout.maxPaddingUp - DIMENSIONS.tiePadding, chordHeight(entry.note)));
    }
    const nextNote = nextNoteInSequence(trackNotes, entry.note);
    const nextRendered = nextNote ? lineEntries.some((candidate) => candidate.note === nextNote) : false;
    if (nextNote?.tie && !nextRendered) {
      const startX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      parts.push(renderOutgoingTie(startX, rightTieEdgeX, lineY + layout.maxPaddingUp - DIMENSIONS.tiePadding, chordHeight(entry.note)));
    }

    const className = activeNoteIndices.has(entry.note.index) ? "note-item active" : "note-item";
    const noteParts: string[] = [];
    if (entry.note.kind === "pitch") {
      noteParts.push(renderPitchNote(entry.note, entry.x, entry.y));
    } else {
      noteParts.push(renderRestOrDrum(entry.note, entry.x, entry.y));
    }
    noteParts.push(renderDuration(entry.note, entry.x, entry.y, entry.full, entry.dashAnchors));
    parts.push(`<g class="${className}" data-note-index="${entry.note.index}">${noteParts.join("")}</g>`);
  }

  return {
    svg: parts.join("\n"),
    lyricAnchors: lineEntries.filter((entry) => entry.note.kind !== "rest").map((entry) => entry.x),
  };
}

interface ScoreLineGroup {
  lines: ScoreLine[];
  lyrics: LyricLine[];
  bracketed: boolean;
  labelOffset: number;
  bracketOffset: number;
}

interface RenderLineLayout {
  layout: LineLayout;
  groupIndex: number;
  labelOffset: number;
  bracketOffset: number;
  groupVisualWidth: number;
}

function timelineKey(value: number): string {
  return value.toFixed(9);
}

interface MeasureRhythmPositions {
  noteStarts: number[];
  dashStarts: number[][];
  totalDuration: number;
}

function measureRhythmPositions(measure: Measure): MeasureRhythmPositions {
  let start = 0;
  const noteStarts: number[] = [];
  const dashStarts: number[][] = [];
  for (const note of measure.notes) {
    noteStarts.push(start);
    dashStarts.push(Array.from({ length: note.duration.dashes }, (_, index) => start + (index + 1) / 4));
    start += note.duration.value;
  }
  return { noteStarts, dashStarts, totalDuration: start };
}

function rhythmicSlotWidth(note: Note): number {
  return widthOf(note) - note.duration.dashes * DIMENSIONS.dashSpacing;
}

function setTimelineWidth(widthsByStart: Map<string, { start: number; width: number }>, start: number, width: number) {
  const key = timelineKey(start);
  const current = widthsByStart.get(key);
  widthsByStart.set(key, { start, width: Math.max(current?.width ?? 0, width) });
}

function positionsForStarts(starts: number[], positionsByStart: Map<string, number>): number[] {
  return starts.map((start) => positionsByStart.get(timelineKey(start)) ?? 0);
}

function dashPositionsForStarts(starts: number[][], positionsByStart: Map<string, number>): number[][] {
  return starts.map((dashStarts) => positionsForStarts(dashStarts, positionsByStart));
}

function measureTimelineSignature(positions: MeasureRhythmPositions): string {
  return [...positions.noteStarts, ...positions.dashStarts.flat()]
    .sort((a, b) => a - b)
    .map(timelineKey)
    .join("|");
}

function measureTrailingWidth(measure: Measure): number {
  return 4 + (measure.repeatEnd ? DIMENSIONS.repeatRightPadding - DIMENSIONS.leftPadding : 0);
}

function measureContentWidth(layout: MeasureLayout): number {
  return layout.width - layout.leftPadding - layout.rightPadding - measureTrailingWidth(layout.measure);
}

function scalePositions(positions: number[], sourceWidth: number, targetWidth: number): number[] {
  if (sourceWidth <= 0 || targetWidth === sourceWidth) {
    return positions;
  }
  const scale = targetWidth / sourceWidth;
  return positions.map((position) => position * scale);
}

function scaleDashPositions(positions: number[][], sourceWidth: number, targetWidth: number): number[][] {
  return positions.map((dashPositions) => scalePositions(dashPositions, sourceWidth, targetWidth));
}

function alignMeasureLinesOnly(measureLayouts: MeasureLayout[]): MeasureLayout[] {
  const contentWidth = Math.max(0, ...measureLayouts.map(measureContentWidth));
  const leftPadding = Math.max(...measureLayouts.map((layout) => layout.leftPadding));
  const rightPadding = Math.max(...measureLayouts.map((layout) => layout.rightPadding));
  return measureLayouts.map((layout) => {
    const sourceWidth = measureContentWidth(layout);
    return {
      ...layout,
      width: contentWidth + leftPadding + rightPadding + measureTrailingWidth(layout.measure),
      leftPadding,
      rightPadding,
      notePositions: scalePositions(layout.notePositions, sourceWidth, contentWidth),
      dashPositions: scaleDashPositions(layout.dashPositions, sourceWidth, contentWidth),
    };
  });
}

function allStarts(positions: MeasureRhythmPositions): number[] {
  return [...positions.noteStarts, ...positions.dashStarts.flat()];
}

function canAlignBeatBoundaries(positionsByMeasure: MeasureRhythmPositions[], unit: number): boolean {
  if (unit <= 0) {
    return false;
  }

  return positionsByMeasure.every((positions) => {
    const starts = new Set(allStarts(positions).map(timelineKey));
    for (let beatStart = 0; beatStart < positions.totalDuration - 1e-9; beatStart += unit) {
      if (!starts.has(timelineKey(beatStart))) {
        return false;
      }
    }
    return true;
  });
}

function beatStarts(totalDuration: number, unit: number): number[] {
  const starts: number[] = [];
  for (let beatStart = 0; beatStart < totalDuration - 1e-9; beatStart += unit) {
    starts.push(beatStart);
  }
  return starts;
}

function alignMeasureLayoutsByBeat(measureLayouts: MeasureLayout[], positionsByMeasure: MeasureRhythmPositions[], unit: number): MeasureLayout[] {
  const beatStartsByMeasure = positionsByMeasure.map((positions) => beatStarts(positions.totalDuration, unit));
  const beatCount = Math.max(0, ...beatStartsByMeasure.map((starts) => starts.length));
  const positionsByAbsoluteStart = new Map<string, number>();
  let position = 0;

  for (let beatIndex = 0; beatIndex < beatCount; beatIndex += 1) {
    const widthsByRelativeStart = new Map<string, { start: number; width: number }>();

    for (const [layoutIndex, layout] of measureLayouts.entries()) {
      const positions = positionsByMeasure[layoutIndex]!;
      const beatStart = beatStartsByMeasure[layoutIndex]![beatIndex];
      const beatEnd = beatStartsByMeasure[layoutIndex]![beatIndex + 1] ?? positions.totalDuration;
      if (beatStart === undefined) {
        continue;
      }

      for (const [noteIndex, note] of layout.measure.notes.entries()) {
        const noteStart = positions.noteStarts[noteIndex]!;
        if (noteStart >= beatStart - 1e-9 && noteStart < beatEnd - 1e-9) {
          setTimelineWidth(widthsByRelativeStart, noteStart - beatStart, rhythmicSlotWidth(note));
        }
        for (const dashStart of positions.dashStarts[noteIndex]!) {
          if (dashStart >= beatStart - 1e-9 && dashStart < beatEnd - 1e-9) {
            setTimelineWidth(widthsByRelativeStart, dashStart - beatStart, DIMENSIONS.dashSpacing);
          }
        }
      }
    }

    const timeline = [...widthsByRelativeStart.values()].sort((a, b) => a.start - b.start);
    for (const entry of timeline) {
      for (const starts of beatStartsByMeasure) {
        const beatStart = starts[beatIndex];
        if (beatStart !== undefined) {
          positionsByAbsoluteStart.set(timelineKey(beatStart + entry.start), position);
        }
      }
      position += entry.width;
    }
  }

  const leftPadding = Math.max(...measureLayouts.map((layout) => layout.leftPadding));
  const rightPadding = Math.max(...measureLayouts.map((layout) => layout.rightPadding));
  return measureLayouts.map((layout, layoutIndex) => {
    const positions = positionsByMeasure[layoutIndex]!;
    return {
      ...layout,
      width: position + leftPadding + rightPadding + 4 + (layout.measure.repeatEnd ? DIMENSIONS.repeatRightPadding - DIMENSIONS.leftPadding : 0),
      leftPadding,
      rightPadding,
      notePositions: positionsForStarts(positions.noteStarts, positionsByAbsoluteStart),
      dashPositions: dashPositionsForStarts(positions.dashStarts, positionsByAbsoluteStart),
    };
  });
}

function alignMeasureLayouts(measureLayouts: MeasureLayout[], unit: number): MeasureLayout[] {
  const positionsByMeasure = measureLayouts.map((layout) => measureRhythmPositions(layout.measure));
  const signatures = new Set(positionsByMeasure.map(measureTimelineSignature));
  if (signatures.size > 1) {
    return canAlignBeatBoundaries(positionsByMeasure, unit)
      ? alignMeasureLayoutsByBeat(measureLayouts, positionsByMeasure, unit)
      : alignMeasureLinesOnly(measureLayouts);
  }

  const widthsByStart = new Map<string, { start: number; width: number }>();

  for (const [layoutIndex, layout] of measureLayouts.entries()) {
    const positions = positionsByMeasure[layoutIndex]!;
    for (const [noteIndex, note] of layout.measure.notes.entries()) {
      setTimelineWidth(widthsByStart, positions.noteStarts[noteIndex]!, rhythmicSlotWidth(note));
      for (const dashStart of positions.dashStarts[noteIndex]!) {
        setTimelineWidth(widthsByStart, dashStart, DIMENSIONS.dashSpacing);
      }
    }
  }

  const timeline = [...widthsByStart.values()].sort((a, b) => a.start - b.start);
  const positionsByStart = new Map<string, number>();
  let position = 0;
  for (const entry of timeline) {
    positionsByStart.set(timelineKey(entry.start), position);
    position += entry.width;
  }

  const leftPadding = Math.max(...measureLayouts.map((layout) => layout.leftPadding));
  const rightPadding = Math.max(...measureLayouts.map((layout) => layout.rightPadding));
  return measureLayouts.map((layout, layoutIndex) => {
    const positions = positionsByMeasure[layoutIndex]!;
    return {
      ...layout,
      width: position + leftPadding + rightPadding + 4 + (layout.measure.repeatEnd ? DIMENSIONS.repeatRightPadding - DIMENSIONS.leftPadding : 0),
      leftPadding,
      rightPadding,
      notePositions: positionsForStarts(positions.noteStarts, positionsByStart),
      dashPositions: dashPositionsForStarts(positions.dashStarts, positionsByStart),
    };
  });
}

function alignLineLayouts(layouts: LineLayout[], unit: number): LineLayout[] {
  const aligned = [...layouts];
  const layoutsBySpan = new Map<string, Array<{ index: number; layout: LineLayout }>>();

  for (const [index, layout] of layouts.entries()) {
    const key = `${layout.measureStartIndex}:${layout.measures.length}`;
    layoutsBySpan.set(key, [...(layoutsBySpan.get(key) ?? []), { index, layout }]);
  }

  for (const entries of layoutsBySpan.values()) {
    if (entries.length <= 1) {
      continue;
    }
    const measureCount = entries[0]!.layout.measures.length;
    const alignedMeasures = entries.map((entry) => [...entry.layout.measures]);

    for (let measureIndex = 0; measureIndex < measureCount; measureIndex += 1) {
      const measureLayouts = entries.map((entry) => entry.layout.measures[measureIndex]!);
      const alignedMeasureLayouts = alignMeasureLayouts(measureLayouts, unit);
      for (const [entryIndex, measureLayout] of alignedMeasureLayouts.entries()) {
        alignedMeasures[entryIndex]![measureIndex] = measureLayout;
      }
    }

    for (const [entryIndex, entry] of entries.entries()) {
      const measures = alignedMeasures[entryIndex]!;
      aligned[entry.index] = {
        ...entry.layout,
        measures,
        width: lineWidth(measures),
      };
    }
  }

  return aligned;
}

function scoreLineGroups(document: Document): ScoreLineGroup[] {
  const hasLabels = document.score.some((line) => line.label !== undefined);
  if (!hasLabels) {
    return document.score.map((line) => {
      const lyrics = line.lyrics ?? [];
      const labelOffset = labelOffsetForTexts([scoreLineDisplayLabel(document, line, "T1"), ...lyrics.map((lyric) => lyricLineDisplayLabel(document, lyric))]);
      return { lines: [line], lyrics, bracketed: false, labelOffset, bracketOffset: 0 };
    });
  }

  const groups: ScoreLine[][] = [];
  let current: ScoreLine[] = [];
  for (const line of document.score) {
    if (line.label === "T1" && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    groups.push(current);
  }

  return groups.map((lines) => {
    const lyrics = lines.flatMap((line) => line.lyrics ?? []);
    const labelOffset = labelOffsetForTexts([
      ...lines.map((line) => scoreLineDisplayLabel(document, line)),
      ...lyrics.map((lyric) => lyricLineDisplayLabel(document, lyric)),
    ]);
    const bracketed = lines.length > 1;
    return {
      lines,
      lyrics,
      bracketed,
      labelOffset,
      bracketOffset: bracketed ? DIMENSIONS.voiceBracketWidth : 0,
    };
  });
}

function finalBarMeasures(groups: ScoreLineGroup[]): Set<Measure> {
  const finalMeasures = new Set<Measure>();
  const finalGroup = groups.at(-1);
  if (!finalGroup) {
    return finalMeasures;
  }
  for (const line of finalGroup.lines) {
    const measure = line.measures.at(-1);
    if (measure) {
      finalMeasures.add(measure);
    }
  }
  return finalMeasures;
}

function lineVisualWidth(layout: RenderLineLayout): number {
  return layout.layout.width + layout.labelOffset + layout.bracketOffset * 2;
}

function lyricNaturalWidth(group: ScoreLineGroup): number {
  const maxTextWidth = Math.max(0, ...group.lyrics.map((lyric) => lyric.text.length * LYRIC_CHARACTER_WIDTH));
  if (maxTextWidth === 0) {
    return 0;
  }
  return group.labelOffset + group.bracketOffset + DIMENSIONS.leftPadding + maxTextWidth + group.bracketOffset;
}

function shouldJustifyGroup(justifyMode: JustifyMode, groupIndex: number, groupCount: number): boolean {
  return justifyMode === "all" || (justifyMode === "except-last" && groupIndex < groupCount - 1);
}

function renderedLineRightEdge(width: number, pageWidth: number, justified: boolean, scaled: boolean): number {
  return justified || scaled ? pageWidth : Math.min(pageWidth, width);
}

function renderedItemRightEdge(item: RenderLineLayout, pageWidth: number, justified: boolean, scaled: boolean): number {
  return renderedLineRightEdge(lineVisualWidth(item), pageWidth, justified, scaled);
}

function renderVoiceBracket(x: number, y1: number, y2: number, side: "left" | "right"): string {
  const hook = 9;
  const bevel = 7;
  const innerX = side === "left" ? x + hook : x - hook;
  return `<path class="voice-bracket" d="M${innerX},${y1} L${x},${y1 + bevel} V${y2 - bevel} L${innerX},${y2}"/>`;
}

function renderLyrics(document: Document, lyrics: LyricLine[], contentX: number, y: number, targetTextWidth: number | undefined): string {
  return lyrics
    .map((lyric, index) => {
      const lineY = y + index * DIMENSIONS.lyricLineHeight;
      const displayLabel = lyricLineDisplayLabel(document, lyric);
      const label = displayLabel ? `<text class="line-label" x="8" y="${lineY}" text-anchor="start">${escapeXml(displayLabel)}</text>` : "";
      const naturalTextWidth = lyric.text.length * LYRIC_CHARACTER_WIDTH;
      const justifyAttributes =
        targetTextWidth !== undefined && targetTextWidth > naturalTextWidth
          ? ` textLength="${targetTextWidth}" lengthAdjust="spacing"`
          : "";
      return `${label}<text class="lyric-line" x="${contentX}" y="${lineY}" text-anchor="start"${justifyAttributes}>${escapeXml(lyric.text)}</text>`;
    })
    .join("\n");
}

function renderAlignedLyrics(document: Document, lyrics: LyricLine[], contentX: number, y: number, targetTextWidth: number | undefined, anchors: number[]): string {
  return lyrics
    .map((lyric, index) => {
      if (lyric.syllables.length <= 1 || lyric.syllables.length !== anchors.length) {
        return renderLyrics(document, [lyric], contentX, y + index * DIMENSIONS.lyricLineHeight, targetTextWidth);
      }
      const lineY = y + index * DIMENSIONS.lyricLineHeight;
      const displayLabel = lyricLineDisplayLabel(document, lyric);
      const label = displayLabel ? `<text class="line-label" x="8" y="${lineY}" text-anchor="start">${escapeXml(displayLabel)}</text>` : "";
      const syllables = lyric.syllables
        .map((syllable, syllableIndex) => `<text class="lyric-syllable" x="${anchors[syllableIndex]}" y="${lineY}" text-anchor="middle">${escapeXml(syllable)}</text>`)
        .join("");
      return `${label}${syllables}`;
    })
    .join("\n");
}

function isPrimaryLyricLine(line: ScoreLine, hasLabels: boolean): boolean {
  return !hasLabels || line.label === undefined || line.label === "T1";
}

export function renderScore(document: Document, yStart: number, pageWidth: number, activeNoteIndices: number[], justifyMode: JustifyMode): { svg: string; height: number; width: number } {
  const allNotes = flattenNotes(document);
  const unit = actualNotePerBeat(document.header.timeSignature);
  const activeNoteIndexSet = new Set(activeNoteIndices);
  const groups = scoreLineGroups(document);
  const hasLabels = document.score.some((line) => line.label !== undefined);
  const notesByLine = lineNotesByTrack(document);
  const finalMeasures = finalBarMeasures(groups);
  const layouts = groups.flatMap((group, groupIndex) => {
    const groupLayouts = alignLineLayouts(
      group.lines.flatMap((line) => layoutLine(line, allNotes, Math.max(1, pageWidth - group.labelOffset - group.bracketOffset * 2))),
      unit,
    );
    const groupVisualWidth = Math.max(0, lyricNaturalWidth(group), ...groupLayouts.map((layout) => layout.width + group.labelOffset + group.bracketOffset * 2));
    return groupLayouts.map((layout) => ({
      layout,
      groupIndex,
      labelOffset: group.labelOffset,
      bracketOffset: group.bracketOffset,
      groupVisualWidth,
    }));
  });
  let y = yStart;
  const parts: string[] = [];
  const groupBounds = new Map<number, { y1: number; y2: number; x2: number }>();
  const lyricAnchorLinesByGroup = new Map<number, number[][]>();
  for (const [index, item] of layouts.entries()) {
    const lineWidth = lineVisualWidth(item);
    const scaleX = lineWidth > pageWidth ? pageWidth / lineWidth : 1;
    const scaled = scaleX < 1;
    const visualWidth = scaleX < 1 ? lineWidth : pageWidth;
    const groupScaled = item.groupVisualWidth > pageWidth;
    const shouldJustify = shouldJustifyGroup(justifyMode, item.groupIndex, groups.length);
    const renderedLine = renderLine(
      item.layout,
      y,
      document,
      activeNoteIndexSet,
      shouldJustify && !scaled,
      visualWidth,
      item.labelOffset,
      item.bracketOffset,
      hasLabels ? "" : "T1",
      finalMeasures,
      notesByLine,
    );
    parts.push(scaled ? `<g class="score-line scaled" transform="scale(${scaleX},1)">${renderedLine.svg}</g>` : renderedLine.svg);
    if (isPrimaryLyricLine(item.layout.line, hasLabels)) {
      const lyricAnchors = scaled ? renderedLine.lyricAnchors.map((anchor) => anchor * scaleX) : renderedLine.lyricAnchors;
      lyricAnchorLinesByGroup.set(item.groupIndex, [...(lyricAnchorLinesByGroup.get(item.groupIndex) ?? []), lyricAnchors]);
    }

    if (groups[item.groupIndex]?.bracketed) {
      const y1 = y + Math.max(0, item.layout.maxPaddingUp - DIMENSIONS.baseNoteHeight - 4);
      const y2 = y + item.layout.height;
      const rightEdge = renderedItemRightEdge(item, pageWidth, shouldJustify, scaled);
      const current = groupBounds.get(item.groupIndex);
      groupBounds.set(item.groupIndex, {
        y1: Math.min(current?.y1 ?? y1, y1),
        y2: Math.max(current?.y2 ?? y2, y2),
        x2: Math.max(current?.x2 ?? 0, rightEdge - item.bracketOffset / 2),
      });
    }

    y += item.layout.height + DIMENSIONS.lineSpacing;
    const next = layouts[index + 1];
    if (!next || next.groupIndex !== item.groupIndex) {
      const group = groups[item.groupIndex]!;
      if (group.lyrics.length > 0) {
        const contentX = group.labelOffset + group.bracketOffset + DIMENSIONS.leftPadding;
        const lyricRightEdge = renderedLineRightEdge(item.groupVisualWidth, pageWidth, shouldJustify, groupScaled);
        const targetTextWidth = shouldJustify && !groupScaled ? Math.max(0, lyricRightEdge - contentX - group.bracketOffset) : undefined;
        const anchorLines = lyricAnchorLinesByGroup.get(item.groupIndex) ?? [];
        const lyricAnchors = anchorLines.length === 1 ? anchorLines[0]! : [];
        parts.push(renderAlignedLyrics(document, group.lyrics, contentX, y + DIMENSIONS.lyricTopPadding, targetTextWidth, lyricAnchors));
        y += DIMENSIONS.lyricTopPadding + group.lyrics.length * DIMENSIONS.lyricLineHeight;
      }
    }
  }

  for (const [groupIndex, bounds] of groupBounds) {
    const group = groups[groupIndex]!;
    const leftX = group.labelOffset + group.bracketOffset / 2;
    const yShift = -4;
    parts.push(renderVoiceBracket(leftX, bounds.y1 + yShift, bounds.y2 + yShift, "left"));
    parts.push(renderVoiceBracket(bounds.x2, bounds.y1 + yShift, bounds.y2 + yShift, "right"));
  }

  return {
    svg: parts.join("\n"),
    width: Math.min(pageWidth, Math.max(0, ...layouts.map((layout) => layout.groupVisualWidth))),
    height: Math.max(0, y - yStart),
  };
}
