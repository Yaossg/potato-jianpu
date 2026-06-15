import type { Document, Measure, Note, ScoreLine } from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";
import { noteTieAfter, widthOf } from "./metrics.js";

export interface MeasureLayout {
  measure: Measure;
  width: number;
  leftPadding: number;
  rightPadding: number;
  repeatStartX: number | null;
  notePositions: number[];
  dashPositions: number[][];
  paddingUp: number;
  paddingDown: number;
}

export interface LineLayout {
  line: ScoreLine;
  measures: MeasureLayout[];
  measureStartIndex: number;
  width: number;
  height: number;
  maxPaddingUp: number;
}

export function flattenNotes(document: Document): Note[] {
  return document.score.flatMap((line) => line.measures).flatMap((measure) => measure.notes);
}

function paddingUpOf(note: Note, tieAfter: boolean, hasEnding: boolean): number {
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
  height += hasEnding ? DIMENSIONS.endingHeight : 0;
  if (note.velocity !== undefined) {
    height += DIMENSIONS.velocityFontSize + DIMENSIONS.velocityTextGap;
  }
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

function layoutMeasure(
  measure: Measure,
  allNotes: Note[],
  inlineRepeatStart = false,
  repeatStartAfterEnd = false,
  repeatEndBeforeStart = false,
): MeasureLayout {
  const notePositions: number[] = [];
  const dashPositions: number[][] = [];
  const repeatStartPadding = measure.repeatStart
    ? inlineRepeatStart
      ? DIMENSIONS.repeatInlineLeftPadding
      : DIMENSIONS.repeatLeadingPadding
    : 0;
  const leftPadding = DIMENSIONS.leftPadding + repeatStartPadding + (repeatStartAfterEnd ? DIMENSIONS.repeatBothRightPadding : 0);
  const rightPadding = measure.repeatEnd && !repeatEndBeforeStart ? DIMENSIONS.repeatEndRightPadding : 0;
  let totalWidth = 0;
  let paddingUp = 0;
  let paddingDown = 0;

  for (const note of measure.notes) {
    notePositions.push(totalWidth);
    dashPositions.push(
      Array.from({ length: note.duration.dashes }, (_, index) => totalWidth + DIMENSIONS.dashSpacing * (index + 1)),
    );
    totalWidth += widthOf(note);
    paddingUp = Math.max(paddingUp, paddingUpOf(note, noteTieAfter(note, allNotes), note === measure.notes[0] && measure.ending !== undefined));
    paddingDown = Math.max(paddingDown, paddingDownOf(note));
  }

  return {
    measure,
    width: totalWidth + leftPadding + rightPadding + 4 + (measure.repeatEnd ? DIMENSIONS.repeatRightPadding - DIMENSIONS.leftPadding : 0),
    leftPadding,
    rightPadding,
    repeatStartX: measure.repeatStart ? (inlineRepeatStart ? -6 : 2) : null,
    notePositions,
    dashPositions,
    paddingUp,
    paddingDown,
  };
}

export function lineWidth(measures: MeasureLayout[]): number {
  return Math.max(
    0,
    measures.reduce((sum, measure) => sum + measure.width + DIMENSIONS.measureSpacing, 0) - DIMENSIONS.measureSpacing,
  );
}

function buildLineLayout(line: ScoreLine, measures: MeasureLayout[], measureStartIndex: number): LineLayout {
  const width = lineWidth(measures);
  const maxPaddingUp = Math.max(0, ...measures.map((measure) => measure.paddingUp));
  const maxPaddingDown = Math.max(0, ...measures.map((measure) => measure.paddingDown));
  return {
    line,
    measures,
    measureStartIndex,
    width,
    height: maxPaddingUp + maxPaddingDown + DIMENSIONS.noteBottomPadding,
    maxPaddingUp,
  };
}

export function layoutLine(line: ScoreLine, allNotes: Note[], pageWidth: number): LineLayout[] {
  const layouts: LineLayout[] = [];
  let current: MeasureLayout[] = [];
  let currentWidth = 0;
  let currentStartIndex = 0;

  for (const [measureIndex, measureNode] of line.measures.entries()) {
    const previousMeasure = current.at(-1)?.measure;
    const nextMeasure = line.measures[measureIndex + 1];
    let measure = layoutMeasure(
      measureNode,
      allNotes,
      current.length > 0,
      Boolean(previousMeasure?.repeatEnd && measureNode.repeatStart),
      Boolean(measureNode.repeatEnd && nextMeasure?.repeatStart),
    );
    const nextWidth = current.length === 0 ? measure.width : currentWidth + DIMENSIONS.measureSpacing + measure.width;
    if (current.length > 0 && nextWidth > pageWidth) {
      layouts.push(buildLineLayout(line, current, currentStartIndex));
      measure = layoutMeasure(measureNode, allNotes, false, false, Boolean(measureNode.repeatEnd && nextMeasure?.repeatStart));
      current = [measure];
      currentWidth = measure.width;
      currentStartIndex = measureIndex;
    } else {
      current.push(measure);
      currentWidth = nextWidth;
    }
  }

  if (current.length > 0) {
    layouts.push(buildLineLayout(line, current, currentStartIndex));
  }

  return layouts;
}

export function measureXOffset(measures: MeasureLayout[], measureIndex: number): number {
  return measures
    .slice(0, measureIndex)
    .reduce((sum, measure) => sum + measure.width + DIMENSIONS.measureSpacing, 0);
}
