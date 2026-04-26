import { actualNotePerBeat, type Document, type Measure, type Note, type Pitch, type PitchNote, type ScoreLine } from "../core/index.js";

export interface RenderOptions {
  pageWidth?: number;
  activeNoteIndex?: number;
}

interface MeasureLayout {
  measure: Measure;
  width: number;
  notePositions: number[];
  paddingUp: number;
  paddingDown: number;
}

interface LineLayout {
  line: ScoreLine;
  measures: MeasureLayout[];
  width: number;
  height: number;
  maxPaddingUp: number;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  pageWidth: 1000,
  activeNoteIndex: -1,
};

const DIMENSIONS = {
  baseNoteWidth: 24,
  baseNoteHeight: 24,
  leftPadding: 18,
  measureSpacing: 0,
  accidentalOffset: 10,
  tieHeight: 16,
  tieCurveHeight: 13,
  tiePadding: 24,
  octaveSpacing: 5,
  noteBottomPadding: 10,
  underlineSpacing: 5,
  dotSpacing: 12,
  dashSpacing: 24,
  lineSpacing: 10,
  octaveDotVerticalOffset: 22,
  octaveDotBelowOffset: 5,
  accidentalVerticalOffset: 8,
  underlineXStart: -10,
  underlineXEndOffset: 14,
  dotXOffset: 12,
  dashXOffset: 12,
};

const accidentalMap = new Map([
  [2, "&#119082;"],
  [1, "&#9839;"],
  [0, "&#9838;"],
  [-1, "&#9837;"],
  [-2, "&#119083;"],
]);

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatKey(key: string): string {
  return key.replace("#", "&#9839;").replace("b", "&#9837;");
}

function hasAccidental(pitch: Pitch): boolean {
  return pitch.accidental !== undefined;
}

function accidentalOffset(pitch: Pitch): number {
  return hasAccidental(pitch) ? DIMENSIONS.accidentalOffset : 0;
}

function maxAccidentalOffset(chord: Pitch[] | undefined): number {
  if (!chord || chord.length === 0) {
    return 0;
  }
  return Math.max(...chord.map(accidentalOffset));
}

function widthOf(note: Note): number {
  let width = DIMENSIONS.baseNoteWidth;
  width += note.duration.dashes * DIMENSIONS.dashSpacing;
  width += note.duration.dots * DIMENSIONS.dotSpacing;
  width += note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0;
  return width;
}

function chordHeight(note: Note): number {
  if (note.kind !== "pitch") {
    return DIMENSIONS.baseNoteHeight;
  }
  let height = 0;
  for (let index = note.chord.length - 1; index >= 0; index -= 1) {
    const pitch = note.chord[index]!;
    const isBase = index === note.chord.length - 1;
    if (!isBase && pitch.octave < 0) {
      height += Math.abs(pitch.octave) * DIMENSIONS.octaveSpacing;
    }
    height += DIMENSIONS.baseNoteHeight;
    if (pitch.octave > 0) {
      height += pitch.octave * DIMENSIONS.octaveSpacing;
    }
  }
  return height;
}

function paddingUpOf(note: Note, tieAfter: boolean): number {
  let height = DIMENSIONS.baseNoteHeight;
  if (note.kind === "pitch") {
    const base = note.chord.at(-1);
    height += base && base.octave > 0 ? base.octave * DIMENSIONS.octaveSpacing : 0;
    for (const pitch of note.chord.slice(0, -1)) {
      height += DIMENSIONS.baseNoteHeight;
      height += Math.abs(pitch.octave) * DIMENSIONS.octaveSpacing;
    }
  }
  height += note.tie || tieAfter ? DIMENSIONS.tieHeight : 0;
  return height;
}

function paddingDownOf(note: Note): number {
  let height = note.duration.halves * DIMENSIONS.underlineSpacing;
  if (note.kind === "pitch") {
    const base = note.chord.at(-1);
    if (base && base.octave < 0) {
      height += Math.abs(base.octave) * DIMENSIONS.octaveSpacing;
    }
  }
  return height;
}

function flattenNotes(document: Document): Note[] {
  return document.score.flatMap((line) => line.measures).flatMap((measure) => measure.notes);
}

function lastMeasure(document: Document): Measure | undefined {
  return document.score.at(-1)?.measures.at(-1);
}

function noteTieAfter(note: Note, allNotes: Note[]): boolean {
  return Boolean(allNotes[note.index + 1]?.tie);
}

function layoutMeasure(measure: Measure, allNotes: Note[]): MeasureLayout {
  const notePositions: number[] = [];
  let totalWidth = 0;
  let paddingUp = 0;
  let paddingDown = 0;

  for (const note of measure.notes) {
    notePositions.push(totalWidth);
    totalWidth += widthOf(note);
    paddingUp = Math.max(paddingUp, paddingUpOf(note, noteTieAfter(note, allNotes)));
    paddingDown = Math.max(paddingDown, paddingDownOf(note));
  }

  return {
    measure,
    width: totalWidth + DIMENSIONS.leftPadding + 4,
    notePositions,
    paddingUp,
    paddingDown,
  };
}

function lineWidth(measures: MeasureLayout[]): number {
  return Math.max(
    0,
    measures.reduce((sum, measure) => sum + measure.width + DIMENSIONS.measureSpacing, 0) - DIMENSIONS.measureSpacing,
  );
}

function buildLineLayout(line: ScoreLine, measures: MeasureLayout[]): LineLayout {
  const width = lineWidth(measures);
  const maxPaddingUp = Math.max(0, ...measures.map((measure) => measure.paddingUp));
  const maxPaddingDown = Math.max(0, ...measures.map((measure) => measure.paddingDown));
  return {
    line,
    measures,
    width,
    height: maxPaddingUp + maxPaddingDown + DIMENSIONS.noteBottomPadding,
    maxPaddingUp,
  };
}

function layoutLine(line: ScoreLine, allNotes: Note[], pageWidth: number): LineLayout[] {
  const measures = line.measures.map((measure) => layoutMeasure(measure, allNotes));
  const layouts: LineLayout[] = [];
  let current: MeasureLayout[] = [];
  let currentWidth = 0;

  for (const measure of measures) {
    const nextWidth = current.length === 0 ? measure.width : currentWidth + DIMENSIONS.measureSpacing + measure.width;
    if (current.length > 0 && nextWidth > pageWidth) {
      layouts.push(buildLineLayout(line, current));
      current = [measure];
      currentWidth = measure.width;
    } else {
      current.push(measure);
      currentWidth = nextWidth;
    }
  }

  if (current.length > 0) {
    layouts.push(buildLineLayout(line, current));
  }

  return layouts;
}

function measureXOffset(measures: MeasureLayout[], measureIndex: number): number {
  return measures
    .slice(0, measureIndex)
    .reduce((sum, measure) => sum + measure.width + DIMENSIONS.measureSpacing, 0);
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

function renderBar(x: number, baselineY: number, final: boolean): string {
  const y1 = baselineY - DIMENSIONS.baseNoteHeight - 4;
  const y2 = baselineY + 4;
  if (final) {
    return [
      `<line class="bar-thin" x1="${x - 5}" y1="${y1}" x2="${x - 5}" y2="${y2}"/>`,
      `<line class="bar-final" x1="${x + 2}" y1="${y1}" x2="${x + 2}" y2="${y2}"/>`,
    ].join("");
  }
  return `<line class="bar-thin" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`;
}

const tempoMarkMap = new Map([
  [2, "𝅗𝅥"],
  [4, "♩"],
  [8, "♪"],
  [16, "𝅘𝅥𝅯"],
]);

function renderTempoMark(beatsPerWholeNote: number, tempo: number, x: number, baselineY: number): string {
  return `<text class="tempo-mark" x="${x}" y="${baselineY}">${tempoMarkMap.get(beatsPerWholeNote) ?? "♩"} = ${tempo}</text>`;
}

function renderHeader(document: Document, width: number): { svg: string; height: number } {
  const { header } = document;
  if (header.hidden) {
    return { svg: "", height: 0 };
  }
  const parts: string[] = [];
  const titleY = header.title ? 40 : 0;
  const subtitleY = header.subtitle ? titleY + 32 : titleY;
  const metadataY = subtitleY + 40;
  const height = metadataY + 40;

  if (header.title) {
    parts.push(`<text class="title" x="${width / 2}" y="${titleY}" text-anchor="middle">${escapeXml(header.title)}</text>`);
  }
  if (header.subtitle) {
    parts.push(`<text class="subtitle" x="${width / 2}" y="${subtitleY}" text-anchor="middle">${escapeXml(header.subtitle)}</text>`);
  }
  parts.push(`<text class="metadata" x="10" y="${metadataY}">1=${formatKey(escapeXml(header.keySignatureText))}</text>`);
  parts.push(
    `<text class="metadata" x="${72 + 16 * header.keySignatureText.length}" y="${metadataY}">${header.timeSignature.beatsPerMeasure}/${header.timeSignature.beatsPerWholeNote}</text>`,
  );
  parts.push(renderTempoMark(header.timeSignature.beatsPerWholeNote, header.tempo, 116 + 16 * header.keySignatureText.length, metadataY));
  if (header.composer) {
    parts.push(`<text class="metadata" x="${width - 50}" y="${metadataY}" text-anchor="end">${escapeXml(header.composer)}</text>`);
  }
  return { svg: parts.join("\n"), height };
}

function measureFullness(measure: Measure, unit: number): boolean[] {
  let duration = 0;
  return measure.notes.map((note) => {
    duration += note.duration.value;
    return Math.abs(duration % unit) < 1e-9;
  });
}

function renderLine(layout: LineLayout, lineY: number, allNotes: Note[], document: Document, activeNoteIndex: number): string {
  const parts: string[] = [];
  const lineEntries: Array<{ note: Note; x: number; y: number; full: boolean }> = [];
  const unit = actualNotePerBeat(document.header.timeSignature);
  const finalMeasure = lastMeasure(document);
  for (const [measureIndex, measureLayout] of layout.measures.entries()) {
    const xOffset = measureXOffset(layout.measures, measureIndex);
    const fullness = measureFullness(measureLayout.measure, unit);
    for (const [noteIndex, note] of measureLayout.measure.notes.entries()) {
      lineEntries.push({
        note,
        x: xOffset + measureLayout.notePositions[noteIndex]! + DIMENSIONS.leftPadding,
        y: lineY + layout.maxPaddingUp,
        full: fullness[noteIndex] ?? false,
      });
    }
    parts.push(
      renderBar(
        xOffset + measureLayout.width - DIMENSIONS.leftPadding + 12,
        lineY + layout.maxPaddingUp + DIMENSIONS.noteBottomPadding,
        measureLayout.measure === finalMeasure,
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
      parts.push(renderTie(endX - DIMENSIONS.baseNoteWidth * 2, endX, lineY + layout.maxPaddingUp - DIMENSIONS.tiePadding, chordHeight(entry.note)));
    }
    if (noteTieAfter(entry.note, allNotes) && index === lineEntries.length - 1) {
      const startX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      parts.push(renderTie(startX, startX + widthOf(entry.note) * 2, lineY + layout.maxPaddingUp - DIMENSIONS.tiePadding, chordHeight(entry.note)));
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

function renderScore(document: Document, yStart: number, pageWidth: number, activeNoteIndex: number): { svg: string; height: number; width: number } {
  const allNotes = flattenNotes(document);
  const layouts = document.score.flatMap((line) => layoutLine(line, allNotes, pageWidth));
  let y = yStart;
  const parts: string[] = [];
  for (const layout of layouts) {
    parts.push(renderLine(layout, y, allNotes, document, activeNoteIndex));
    y += layout.height + DIMENSIONS.lineSpacing;
  }
  return {
    svg: parts.join("\n"),
    width: Math.max(0, ...layouts.map((layout) => layout.width)),
    height: layouts.reduce((sum, layout) => sum + layout.height + DIMENSIONS.lineSpacing, 0),
  };
}

export function renderSvg(document: Document, options: RenderOptions = {}): string {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const header = renderHeader(document, resolved.pageWidth);
  const score = renderScore(document, header.height, resolved.pageWidth, resolved.activeNoteIndex);
  const height = Math.max(1, header.height + score.height);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${resolved.pageWidth}" height="${height}" viewBox="0 0 ${resolved.pageWidth} ${height}">
<defs>
<style>
.title { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 32px; font-weight: 700; }
.subtitle { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 400; }
.metadata { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 400; }
.note { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: 700; }
.accidental { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; text-anchor: middle; }
.dot { fill: currentColor; }
.bar-thin { stroke: currentColor; stroke-width: 2.5; stroke-linecap: butt; }
.bar-final { stroke: currentColor; stroke-width: 5; stroke-linecap: butt; }
.tempo-mark { fill: currentColor; font-family: "Segoe UI Symbol", "Noto Music", "Noto Sans Symbols 2", Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 400; }
.underline { stroke: currentColor; stroke-width: 2.5; }
.dash { stroke: currentColor; stroke-width: 3; }
.tie { fill: currentColor; stroke: currentColor; stroke-width: 1; }
.note-item { cursor: pointer; }
.note-item.active .note, .note-item.active .accidental, .note-item.active .dot { fill: #dc2626; }
.note-item.active .underline, .note-item.active .dash { stroke: #dc2626; }
</style>
</defs>
${header.svg}
${score.svg}
</svg>`;
}
