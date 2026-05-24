import type { Document, Measure, Note, ScoreLine } from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";
import { noteTieAfter, widthOf } from "./metrics.js";

export interface MeasureLayout {
  measure: Measure;
  width: number;
  leftPadding: number;
  repeatStartX: number | null;
  notePositions: number[];
  paddingUp: number;
  paddingDown: number;
}

export interface LineLayout {
  line: ScoreLine;
  measures: MeasureLayout[];
  width: number;
  height: number;
  maxPaddingUp: number;
}

export function flattenNotes(document: Document): Note[] {
  return document.score.flatMap((line) => line.measures).flatMap((measure) => measure.notes);
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

function layoutMeasure(measure: Measure, allNotes: Note[], inlineRepeatStart = false): MeasureLayout {
  const notePositions: number[] = [];
  const repeatStartPadding = measure.repeatStart
    ? inlineRepeatStart
      ? DIMENSIONS.repeatInlineLeftPadding
      : DIMENSIONS.repeatLeadingPadding
    : 0;
  const leftPadding = DIMENSIONS.leftPadding + repeatStartPadding;
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
    width: totalWidth + leftPadding + 4 + (measure.repeatEnd ? DIMENSIONS.repeatRightPadding - DIMENSIONS.leftPadding : 0),
    leftPadding,
    repeatStartX: measure.repeatStart ? (inlineRepeatStart ? -6 : 2) : null,
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

export function layoutLine(line: ScoreLine, allNotes: Note[], pageWidth: number): LineLayout[] {
  const layouts: LineLayout[] = [];
  let current: MeasureLayout[] = [];
  let currentWidth = 0;

  for (const measureNode of line.measures) {
    let measure = layoutMeasure(measureNode, allNotes, current.length > 0);
    const nextWidth = current.length === 0 ? measure.width : currentWidth + DIMENSIONS.measureSpacing + measure.width;
    if (current.length > 0 && nextWidth > pageWidth) {
      layouts.push(buildLineLayout(line, current));
      measure = layoutMeasure(measureNode, allNotes, false);
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

export function measureXOffset(measures: MeasureLayout[], measureIndex: number): number {
  return measures
    .slice(0, measureIndex)
    .reduce((sum, measure) => sum + measure.width + DIMENSIONS.measureSpacing, 0);
}
