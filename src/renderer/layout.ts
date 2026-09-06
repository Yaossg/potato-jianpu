import type { Measure, Note, ScoreLine } from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";
import { maxAccidentalOffset, ornamentLeftWidthOf, widthOf } from "./metrics.js";
import type { VerticalLinePlan } from "./vertical-layout.js";

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
  verticalPlan?: VerticalLinePlan;
}

export interface LineLayoutConstraints {
  minAdvanceByNote?: Map<Note, number>;
  lineStartPadding?: number;
  lineEndPadding?: number;
}

function paddingUpOf(note: Note): number {
  let height = DIMENSIONS.baseNoteHeight;
  if (note.kind === "pitch") {
    const base = note.chord.at(-1);
    height += base && base.octave > 0 ? base.octave * DIMENSIONS.octaveSpacing : 0;
    for (const pitch of note.chord.slice(0, -1)) {
      height += DIMENSIONS.baseNoteHeight;
      height += Math.abs(pitch.octave) * DIMENSIONS.octaveSpacing;
    }
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
  constraints: LineLayoutConstraints | undefined,
  inlineRepeatStart = false,
  repeatStartAfterEnd = false,
  repeatEndBeforeStart = false,
  extraLeftPadding = 0,
  extraRightPadding = 0,
): MeasureLayout {
  const notePositions: number[] = [];
  const dashPositions: number[][] = [];
  const repeatStartPadding = measure.repeatStart
    ? inlineRepeatStart
      ? DIMENSIONS.repeatInlineLeftPadding
      : DIMENSIONS.repeatLeadingPadding
    : 0;
  const leftPadding = DIMENSIONS.leftPadding + repeatStartPadding + (repeatStartAfterEnd ? DIMENSIONS.repeatBothRightPadding : 0) + extraLeftPadding;
  const rightPadding =
    (measure.repeatEnd && !repeatEndBeforeStart ? DIMENSIONS.repeatEndRightPadding : 0) +
    extraRightPadding;
  let totalWidth = 0;
  let paddingUp = 0;
  let paddingDown = 0;

  for (const note of measure.notes) {
    const noteLeftOrnamentWidth = ornamentLeftWidthOf(note);
    const noteAccidentalWidth = note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0;
    notePositions.push(totalWidth);
    dashPositions.push(
      Array.from(
        { length: note.duration.dashes },
        (_, index) => totalWidth + noteLeftOrnamentWidth + noteAccidentalWidth + DIMENSIONS.dashSpacing * (index + 1),
      ),
    );
    totalWidth += Math.max(widthOf(note), constraints?.minAdvanceByNote?.get(note) ?? 0);
    paddingUp = Math.max(paddingUp, paddingUpOf(note));
    paddingDown = Math.max(paddingDown, paddingDownOf(note));
  }

  return {
    measure,
    width: totalWidth + leftPadding + rightPadding + 4 + (measure.repeatEnd ? DIMENSIONS.repeatRightPadding - DIMENSIONS.leftPadding : 0),
    leftPadding,
    rightPadding,
    repeatStartX: measure.repeatStart
      ? (inlineRepeatStart ? -6 : DIMENSIONS.barFinalStrokeWidth / 2)
      : null,
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

export function layoutLine(line: ScoreLine, _pageWidth: number, constraints?: LineLayoutConstraints): LineLayout[] {
  const measures: MeasureLayout[] = [];

  for (const [measureIndex, measureNode] of line.measures.entries()) {
    const previousMeasure = measures.at(-1)?.measure;
    const nextMeasure = line.measures[measureIndex + 1];
    const measure = layoutMeasure(
      measureNode,
      constraints,
      measures.length > 0,
      Boolean(previousMeasure?.repeatEnd && measureNode.repeatStart),
      Boolean(measureNode.repeatEnd && nextMeasure?.repeatStart),
      measureIndex === 0 ? (constraints?.lineStartPadding ?? 0) : 0,
      measureIndex === line.measures.length - 1 ? (constraints?.lineEndPadding ?? 0) : 0,
    );
    measures.push(measure);
  }

  return measures.length > 0 ? [buildLineLayout(line, measures, 0)] : [];
}

export function measureXOffset(measures: MeasureLayout[], measureIndex: number): number {
  return measures
    .slice(0, measureIndex)
    .reduce((sum, measure) => sum + measure.width + DIMENSIONS.measureSpacing, 0);
}
