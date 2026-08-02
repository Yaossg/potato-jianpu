import {
  actualNotePerBeat,
  VELOCITY_LABELS,
  type Document,
  type LyricLine,
  type Measure,
  type Note,
  type Pitch,
  type PitchNote,
  type ScoreLine,
  type Slur,
  type SourceRange,
} from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";
import { labelOffsetForTexts, lyricLineDisplayLabel, scoreLineDisplayLabel } from "./labels.js";
import {
  layoutLine,
  lineWidth,
  measureXOffset,
  type LineLayout,
  type LineLayoutConstraints,
  type MeasureLayout,
} from "./layout.js";
import { chordHeight, maxAccidentalOffset, ornamentLeftWidthOf, ornamentRightWidthOf } from "./metrics.js";
import type { JustifyMode } from "./options.js";
import { SMUFL_SYMBOLS } from "./smufl.js";
import { planVerticalLine, type VerticalItem, type VerticalLinePlan, type VerticalPlacement } from "./vertical-layout.js";
import { escapeXml } from "./xml.js";

const accidentalMap = new Map([
  [2, "&#119082;"],
  [1, "&#9839;"],
  [0, "&#9838;"],
  [-1, "&#9837;"],
  [-2, "&#119083;"],
]);
const LYRIC_LATIN_WIDTH = 8.5;
const LYRIC_CJK_WIDTH = 17;
const LYRIC_SPACE_WIDTH = 4.5;
const LYRIC_PUNCTUATION_WIDTH = 5;
const LYRIC_OTHER_WIDTH = 9;
const LYRIC_SYLLABLE_GAP = 6;
const PAGINATED_PAGE_CONTENT_TOP = 12;

function fragmentEdgeX(edgeX: number, strokeWidth: number, side: "left" | "right"): number {
  const inset = strokeWidth / 2;
  return side === "left" ? edgeX + inset : edgeX - inset;
}

interface RenderedLine {
  svg: string;
  lyricAnchors: number[];
}

interface SlurLineSegment {
  id: string;
  slur: Slur;
  lane: number;
  countLabel?: number;
  startNote?: Note;
  endNote?: Note;
  startBoundaryMeasure?: Measure;
  startOutset?: number;
  endOutset?: number;
}

interface LineEntry {
  note: Note;
  x: number;
  y: number;
  full: boolean;
  dashAnchors: number[];
  ornamentEndX: number;
}

interface HairpinSegment {
  kind: NonNullable<Note["hairpinStart"]>;
  start: Note;
  end: Note;
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

function renderGracePitches(note: PitchNote, x: number, y: number): string {
  if (note.ornament?.kind !== "grace") {
    return "";
  }
  const grace = note.ornament;
  const scale = DIMENSIONS.graceNoteFontSize / DIMENSIONS.baseNoteHeight;
  const graceY = y - DIMENSIONS.graceNoteYOffset;
  const anchorX = x + maxAccidentalOffset(note.chord);
  const graceHalves = Math.log2(grace.pitches.length) + 1;
  const beforeGraceWidth = grace.pitches.length * DIMENSIONS.graceNoteAdvance;
  const shortUnderlineEndOffset = 10;
  const isBeforeGrace = grace.placement === "before";
  const startX = isBeforeGrace
    ? anchorX - DIMENSIONS.graceNoteGap - beforeGraceWidth + DIMENSIONS.graceNoteAdvance / 2
    : anchorX + DIMENSIONS.graceNoteGap + DIMENSIONS.graceNoteAdvance / 2;
  const gracePitches = grace.pitches.map((pitch, index) => {
    const centerX = startX + index * DIMENSIONS.graceNoteAdvance;
    const pitchOffset = maxAccidentalOffset([pitch]);
    const graceNote: PitchNote = {
      kind: "pitch",
      chord: [pitch],
      duration: { dashes: 0, halves: graceHalves, dots: 0, value: 1 / 2 ** graceHalves },
      tie: false,
      index: note.index,
      range: pitch.range,
    };
    const groupX = centerX - pitchOffset * scale;
    const endsGraceGroup = index === grace.pitches.length - 1;
    const noteParts = [
      renderPitchNote(graceNote, 0, 0),
      renderDuration(graceNote, 0, 0, endsGraceGroup, []),
    ];
    const underlineBottomOffset =
      DIMENSIONS.octaveDotBelowOffset + (graceHalves - 1) * DIMENSIONS.underlineSpacing + DIMENSIONS.underlineSpacing / 4;
    return {
      svg: `<g class="grace-note-group" transform="translate(${groupX}, ${graceY}) scale(${scale})">${noteParts.join("")}</g>`,
      shortUnderlineMiddleX: groupX + ((DIMENSIONS.underlineXStart + shortUnderlineEndOffset + pitchOffset) / 2) * scale,
      underlineBottomY: graceY + underlineBottomOffset * scale,
    };
  });
  const connectorPitch = isBeforeGrace ? gracePitches.at(-1)! : gracePitches[0]!;
  const connectorGracePitch = isBeforeGrace ? grace.pitches.at(-1)! : grace.pitches[0]!;
  const lowOctaveArcDirection = isBeforeGrace ? -1 : 1;
  const lowOctaveArcOffset =
    connectorGracePitch.octave < 0 ? lowOctaveArcDirection * DIMENSIONS.graceLowOctaveArcOffset : 0;
  const underlineMiddleX = connectorPitch.shortUnderlineMiddleX - lowOctaveArcOffset;
  const underlineBottomY = connectorPitch.underlineBottomY;
  const arcRadius = 4;
  const arcStartX = isBeforeGrace ? underlineMiddleX : underlineMiddleX - arcRadius;
  const arcEndX = isBeforeGrace ? underlineMiddleX + arcRadius : underlineMiddleX;
  const arcStartY = isBeforeGrace ? underlineBottomY : underlineBottomY + arcRadius;
  const arcEndY = isBeforeGrace ? underlineBottomY + arcRadius : underlineBottomY;
  return [
    ...gracePitches.map((pitch) => pitch.svg),
    `<path class="ornament grace-arc" d="M${arcStartX},${arcStartY} A${arcRadius},${arcRadius} 0 0 0 ${arcEndX},${arcEndY}"/>`,
  ].join("");
}

function renderTrillExtension(startX: number, endX: number, y: number): string {
  const width = endX - startX;
  if (width <= 0) {
    return "";
  }
  const cycles = Math.max(1, Math.round(width / DIMENSIONS.trillExtensionWavelength));
  const cycleWidth = width / cycles;
  const halfCycle = cycleWidth / 2;
  const quarterCycle = cycleWidth / 4;
  const amplitude = DIMENSIONS.trillExtensionAmplitude;
  const commands = [`M${startX},${y}`];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const cycleStart = startX + cycle * cycleWidth;
    commands.push(
      `Q${cycleStart + quarterCycle},${y - amplitude} ${cycleStart + halfCycle},${y}`,
      `Q${cycleStart + halfCycle + quarterCycle},${y + amplitude} ${cycleStart + cycleWidth},${y}`,
    );
  }
  return `<path class="ornament trill-extension" d="${commands.join(" ")}"/>`;
}

function renderOrnament(note: Note, x: number, y: number, ornamentEndX: number, placement?: VerticalPlacement): string {
  if (!note.ornament) {
    return "";
  }
  const maxOffset = note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0;
  const centerX = x + maxOffset;
  const markY = placement
    ? y - placement.anchor - DIMENSIONS.ornamentTextDescent
    : y - chordHeight(note) - DIMENSIONS.verticalLaneGap - DIMENSIONS.ornamentTextDescent;
  if (note.ornament.kind === "fermata") {
    return `<text class="ornament fermata smufl-symbol" x="${centerX}" y="${markY}" text-anchor="middle">${SMUFL_SYMBOLS.fermataAbove}</text>`;
  }
  if (note.kind !== "pitch") {
    return "";
  }
  if (note.ornament.kind === "grace") {
    const intrinsicBottom = graceVerticalBounds(note).bottom;
    const shift = Math.max(0, (placement?.anchor ?? intrinsicBottom) - intrinsicBottom);
    return renderGracePitches(note, x, y - shift);
  }
  if (note.ornament.kind === "slide") {
    return "";
  }
  let symbol: string;
  if (note.ornament.kind === "trill") {
    symbol = SMUFL_SYMBOLS.ornamentTrill;
  } else if (note.ornament.kind === "turn") {
    symbol = note.ornament.direction === "lower" ? SMUFL_SYMBOLS.ornamentTurnInverted : SMUFL_SYMBOLS.ornamentTurn;
  } else {
    symbol = note.ornament.direction === "lower" ? SMUFL_SYMBOLS.ornamentMordent : SMUFL_SYMBOLS.ornamentShortTrill;
  }
  const glyph = `<text class="ornament ${note.ornament.kind} smufl-symbol" x="${centerX}" y="${markY}" text-anchor="middle">${symbol}</text>`;
  if (note.ornament.kind !== "trill" || note.ornament.extension !== "wavy" || note.duration.dashes === 0) {
    return glyph;
  }
  const extension = renderTrillExtension(
    centerX + DIMENSIONS.trillExtensionStartOffset,
    ornamentEndX - DIMENSIONS.trillExtensionEndGap,
    markY - DIMENSIONS.trillExtensionYOffset,
  );
  return `${glyph}${extension}`;
}

function renderDuration(note: Note, x: number, y: number, full: boolean, dashAnchors: number[]): string {
  const parts: string[] = [];
  const maxOffset = note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0;
  const ornamentOffset = ornamentRightWidthOf(note);
  for (let i = 0; i < note.duration.halves; i += 1) {
    const underlineY = y + DIMENSIONS.octaveDotBelowOffset + i * DIMENSIONS.underlineSpacing;
    const x2 = (full ? 10 : DIMENSIONS.underlineXEndOffset + note.duration.dots * DIMENSIONS.dotSpacing) + maxOffset;
    parts.push(
      `<line class="underline" x1="${x + DIMENSIONS.underlineXStart}" y1="${underlineY}" x2="${x + x2}" y2="${underlineY}"/>`,
    );
  }
  for (let i = 0; i < note.duration.dots; i += 1) {
    parts.push(`<circle class="dot" cx="${x + DIMENSIONS.dotXOffset + i * DIMENSIONS.dotSpacing + maxOffset + ornamentOffset}" cy="${y - 9}" r="3"/>`);
  }
  for (const dashAnchor of dashAnchors) {
    parts.push(`<line class="dash" x1="${dashAnchor - 10 + ornamentOffset}" y1="${y - 9}" x2="${dashAnchor + 6 + ornamentOffset}" y2="${y - 9}"/>`);
  }
  return parts.join("");
}

function renderRestOrDrum(note: Note, x: number, y: number): string {
  const text = note.kind === "drum" ? "X" : "0";
  return `<text class="note" x="${x}" y="${y}" text-anchor="middle">${text}</text>`;
}

function renderTie(startX: number, endX: number, tieY: number): string {
  if (endX <= startX) {
    return "";
  }
  const midX = (startX + endX) / 2;
  return `<path class="tie" d="M${startX},${tieY} Q${midX},${tieY - DIMENSIONS.tieHeight} ${endX},${tieY} Q${midX},${tieY - DIMENSIONS.tieCurveHeight} ${startX},${tieY} Z"/>`;
}

function renderSlur(
  startX: number,
  endX: number,
  endpointY: number,
  platformY: number,
  startsHere: boolean,
  endsHere: boolean,
  countLabel?: number,
): string {
  const width = Math.max(1, endX - startX);
  const topY = Math.min(endpointY, platformY);
  const height = Math.max(1, endpointY - topY);
  const arcWidth = Math.min(height, width / 4);
  const startY = startsHere ? endpointY : topY;
  const endY = endsHere ? endpointY : topY;
  const straightStartX = startsHere ? startX + arcWidth : startX;
  const straightEndX = endsHere ? endX - arcWidth : endX;
  const parts = [`M${startX},${startY}`];
  if (startsHere) {
    parts.push(`Q${startX},${topY} ${straightStartX},${topY}`);
  }
  let label = "";
  if (countLabel !== undefined) {
    const text = String(countLabel);
    const labelX = (straightStartX + straightEndX) / 2;
    const desiredHalfGap = text.length * DIMENSIONS.slurCountFontSize * 0.3 + DIMENSIONS.slurCountGap;
    const halfGap = Math.min(desiredHalfGap, Math.max(0, (straightEndX - straightStartX - 2) / 2));
    parts.push(`L${labelX - halfGap},${topY}`, `M${labelX + halfGap},${topY}`, `L${straightEndX},${topY}`);
    label = `<text class="slur-count" x="${labelX}" y="${topY}" text-anchor="middle" dominant-baseline="central">${text}</text>`;
  } else {
    parts.push(`L${straightEndX},${topY}`);
  }
  if (endsHere) {
    parts.push(`Q${endX},${topY} ${endX},${endY}`);
  }
  return `<path class="slur" d="${parts.join(" ")}"/>${label}`;
}

function pitchHeight(pitch: Pitch): number {
  const semitones = [0, 2, 4, 5, 7, 9, 11] as const;
  return pitch.octave * 12 + semitones[pitch.note - 1]! + (pitch.accidental ?? 0);
}

function slideDirection(source: PitchNote, target: PitchNote): -1 | 0 | 1 {
  return Math.sign(pitchHeight(target.chord[0]!) - pitchHeight(source.chord[0]!)) as -1 | 0 | 1;
}

function renderSlide(x: number, y: number, direction: -1 | 1): string {
  const radius = DIMENSIONS.slideRadius;
  const startX = x + DIMENSIONS.slideXOffset;
  const startY = direction < 0 ? y - DIMENSIONS.slideLowYOffset - radius : y - DIMENSIONS.slideLowYOffset;
  const pathEndX = startX + radius;
  const pathEndY = startY - direction * radius;
  const path = `M${startX},${startY} A${radius},${radius} 0 0 ${direction > 0 ? 0 : 1} ${pathEndX},${pathEndY}`;
  const arrowLength = DIMENSIONS.slideArrowLength;
  const arrowHalfWidth = DIMENSIONS.slideArrowHalfWidth;
  const endX = pathEndX;
  const endY = pathEndY - direction * arrowLength;
  const arrowPath = `M${endX},${endY} L${pathEndX - arrowHalfWidth},${pathEndY} L${pathEndX + arrowHalfWidth},${pathEndY} Z`;
  return `<path class="ornament slide" d="${path}"/><path class="slide-arrow" d="${arrowPath}" fill="currentColor" stroke="none"/>`;
}

function renderIncomingTie(edgeX: number, endX: number, tieY: number): string {
  if (endX <= edgeX) {
    return "";
  }
  const topCutX = edgeX;
  const topCutY = tieY - DIMENSIONS.tieHeight / 2;
  const bottomCutX = edgeX;
  const bottomCutY = tieY - DIMENSIONS.tieCurveHeight / 2;
  const topControlX = (edgeX + endX) / 2;
  const bottomControlX = topControlX;
  return `<path class="tie" d="M${topCutX},${topCutY} Q${topControlX},${topCutY} ${endX},${tieY} Q${bottomControlX},${bottomCutY} ${bottomCutX},${bottomCutY} Z"/>`;
}

function renderOutgoingTie(startX: number, edgeX: number, tieY: number): string {
  if (edgeX <= startX) {
    return "";
  }
  const topCutX = edgeX;
  const topCutY = tieY - DIMENSIONS.tieHeight / 2;
  const bottomCutX = edgeX;
  const bottomCutY = tieY - DIMENSIONS.tieCurveHeight / 2;
  const topControlX = (startX + edgeX) / 2;
  const bottomControlX = topControlX;
  return `<path class="tie" d="M${startX},${tieY} Q${topControlX},${topCutY} ${topCutX},${topCutY} L${bottomCutX},${bottomCutY} Q${bottomControlX},${bottomCutY} ${startX},${tieY} Z"/>`;
}

function renderHairpin(kind: NonNullable<Note["hairpinStart"]>, startX: number, endX: number, centerY: number): string {
  if (endX <= startX) {
    return "";
  }
  const leftGap = kind === "crescendo" ? 0 : DIMENSIONS.hairpinHeight / 2;
  const rightGap = kind === "crescendo" ? DIMENSIONS.hairpinHeight / 2 : 0;
  return [
    `<line class="hairpin" x1="${startX}" y1="${centerY - leftGap}" x2="${endX}" y2="${centerY - rightGap}"/>`,
    `<line class="hairpin" x1="${startX}" y1="${centerY + leftGap}" x2="${endX}" y2="${centerY + rightGap}"/>`,
  ].join("");
}

function renderRepeatDots(x: number, baselineY: number): string {
  const yOffset = DIMENSIONS.barVerticalOffset;
  return [
    `<circle class="repeat-dot" cx="${x}" cy="${baselineY - 16 + yOffset}" r="${DIMENSIONS.repeatDotRadius}"/>`,
    `<circle class="repeat-dot" cx="${x}" cy="${baselineY - 6 + yOffset}" r="${DIMENSIONS.repeatDotRadius}"/>`,
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

function renderEnding(ending: number[], startX: number, endX: number, noteY: number, placement: VerticalPlacement | undefined, openEnd = false): string {
  const topY = placement ? noteY - placement.top : noteY - DIMENSIONS.baseNoteHeight - DIMENSIONS.endingTopOffset - 14;
  const y = topY + 14;
  const labelX = startX + 4;
  const path = openEnd ? `M${startX},${y + 8} V${y} H${endX}` : `M${startX},${y + 8} V${y} H${endX} V${y + 8}`;
  return [
    `<path class="ending-line" d="${path}"/>`,
    `<text class="ending-label" x="${labelX}" y="${y - 4}" text-anchor="start">${formatEnding(ending)}.</text>`,
  ].join("");
}

interface NavigationBeforeDisplay {
  text: string;
  className: string;
  advance: number;
  yOffset?: number;
}

function navigationBeforeDisplay(mark: NonNullable<Measure["navigationBefore"]>[number]): NavigationBeforeDisplay {
  switch (mark) {
    case "segno":
      return { text: "&#119051;", className: "navigation-symbol", advance: 24 };
    case "coda":
      return { text: "&#119052;", className: "navigation-symbol navigation-coda-symbol", advance: 24, yOffset: 8 };
  }
}

function navigationAfterLabel(mark: NonNullable<Measure["navigationAfter"]>[number]): string {
  switch (mark) {
    case "dc":
      return "D.C.";
    case "ds":
      return "D.S.";
    case "toCoda":
      return "To Coda";
    case "fine":
      return "Fine";
  }
}

function renderNavigationBefore(marks: NonNullable<Measure["navigationBefore"]>, x: number, baselineY: number): string {
  const y = baselineY;
  let cursor = x;
  return marks
    .map((mark) => {
      const display = navigationBeforeDisplay(mark);
      const text = `<text class="navigation-target ${display.className}" x="${cursor}" y="${y + (display.yOffset ?? 0)}" text-anchor="start">${display.text}</text>`;
      cursor += display.advance;
      return text;
    })
    .join("");
}

function renderNavigationAfter(marks: NonNullable<Measure["navigationAfter"]>, x: number, baselineY: number): string {
  return `<text class="navigation-instruction" x="${x}" y="${baselineY}" text-anchor="middle">${marks.map(navigationAfterLabel).join(", ")}</text>`;
}

function renderFine(x: number, baselineY: number): string {
  return `<text class="navigation-target navigation-target-text" x="${x}" y="${baselineY}" text-anchor="middle">Fine</text>`;
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
  let firstNoteX = DIMENSIONS.leftPadding;
  for (const [measureIndex, measure] of layout.measures.entries()) {
    const firstNote = measure.measure.notes[0];
    if (firstNote) {
      firstNoteX =
        measureXOffset(layout.measures, measureIndex) +
        measure.leftPadding +
        measure.notePositions[0]! +
        ornamentLeftWidthOf(firstNote);
      break;
    }
  }
  const lastMeasure = layout.measures.at(-1);
  if (!lastMeasure) {
    return (x: number) => x;
  }
  const lastMeasureX = measureXOffset(layout.measures, layout.measures.length - 1);
  const naturalEndX =
    lastMeasureX +
    lastMeasure.width -
    lastMeasure.rightPadding -
    DIMENSIONS.repeatRightPadding +
    12 +
    (lastMeasure.measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0);
  const suffixWidth = layout.width - naturalEndX;
  const targetEndX = targetWidth - suffixWidth;
  if (naturalEndX <= firstNoteX || targetEndX <= firstNoteX) {
    return (x: number) => x;
  }
  const scale = (targetEndX - firstNoteX) / (naturalEndX - firstNoteX);
  const suffixShift = targetEndX - naturalEndX;
  return (x: number) => {
    if (x <= firstNoteX) {
      return x;
    }
    if (x >= naturalEndX) {
      return x + suffixShift;
    }
    return firstNoteX + (x - firstNoteX) * scale;
  };
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

function hairpinSegments(notes: Note[]): HairpinSegment[] {
  const segments: HairpinSegment[] = [];
  let active: { kind: NonNullable<Note["hairpinStart"]>; start: Note } | null = null;
  for (const note of notes) {
    if (note.hairpinEnd !== undefined && active?.kind === note.hairpinEnd) {
      segments.push({ ...active, end: note });
      active = null;
    }
    if (note.hairpinStart !== undefined) {
      active = { kind: note.hairpinStart, start: note };
    }
  }
  return segments;
}

function isHairpinTransition(note: Note): boolean {
  return note.hairpinStart !== undefined && note.hairpinEnd !== undefined && note.hairpinStart !== note.hairpinEnd;
}

function lineNotesByTrack(document: Document): Map<ScoreLine, Note[]> {
  const notesByTrack = new Map<string, Note[]>();
  for (const line of document.score) {
    const trackLabel = line.label ?? "";
    notesByTrack.set(trackLabel, [...(notesByTrack.get(trackLabel) ?? []), ...notesInLine(line)]);
  }

  return new Map(document.score.map((line) => [line, notesByTrack.get(line.label ?? "") ?? notesInLine(line)]));
}

function effectiveTrackLabel(line: ScoreLine): string {
  return line.label ?? "T1";
}

function slurLaneMap(document: Document, notesByLine: Map<ScoreLine, Note[]>): Map<Slur, number> {
  const lanes = new Map<Slur, number>();
  const trackNotes = new Map<string, Note[]>();
  for (const line of document.score) {
    const label = effectiveTrackLabel(line);
    if (!trackNotes.has(label)) {
      trackNotes.set(label, notesByLine.get(line) ?? notesInLine(line));
    }
  }

  const slursByTrack = new Map<string, Slur[]>();
  for (const slur of document.slurs) {
    slursByTrack.set(slur.track, [...(slursByTrack.get(slur.track) ?? []), slur]);
  }
  for (const [track, slurs] of slursByTrack) {
    const notes = trackNotes.get(track) ?? [];
    const ordinal = new Map(notes.map((note, index) => [note.index, index]));
    const ordered = [...slurs].sort((left, right) => {
      const leftStart = ordinal.get(left.startNoteIndex) ?? 0;
      const leftEnd = ordinal.get(left.endNoteIndex) ?? leftStart;
      const rightStart = ordinal.get(right.startNoteIndex) ?? 0;
      const rightEnd = ordinal.get(right.endNoteIndex) ?? rightStart;
      const widthDifference = leftEnd - leftStart - (rightEnd - rightStart);
      return widthDifference || left.range.end.offset - left.range.start.offset - (right.range.end.offset - right.range.start.offset);
    });
    for (const slur of ordered) {
      const start = ordinal.get(slur.startNoteIndex);
      const end = ordinal.get(slur.endNoteIndex);
      if (start === undefined || end === undefined) {
        continue;
      }
      let lane = 0;
      for (const inner of ordered) {
        const innerLane = lanes.get(inner);
        if (innerLane === undefined || inner === slur) {
          continue;
        }
        const innerStart = ordinal.get(inner.startNoteIndex);
        const innerEnd = ordinal.get(inner.endNoteIndex);
        if (innerStart === undefined || innerEnd === undefined) {
          continue;
        }
        const containsAnchors = start <= innerStart && end >= innerEnd;
        const containsSource = slur.range.start.offset < inner.range.start.offset && slur.range.end.offset > inner.range.end.offset;
        if (containsAnchors && (start < innerStart || end > innerEnd || containsSource)) {
          lane = Math.max(lane, innerLane + 1);
        }
      }
      lanes.set(slur, lane);
    }
    const primaryLaneByGroup = new Map<string, number>();
    for (const slur of slurs) {
      if (slur.branch?.role === "primary") {
        primaryLaneByGroup.set(slur.branch.group, lanes.get(slur) ?? 0);
      }
    }
    for (const slur of slurs) {
      if (slur.branch?.role === "continuation") {
        lanes.set(slur, primaryLaneByGroup.get(slur.branch.group) ?? lanes.get(slur) ?? 0);
      }
    }
  }
  return lanes;
}

function projectSlursToLine(
  document: Document,
  layout: LineLayout,
  notesByLine: Map<ScoreLine, Note[]>,
  lanes: Map<Slur, number>,
): SlurLineSegment[] {
  const lineNotes = layout.measures.flatMap((measure) => measure.measure.notes);
  if (lineNotes.length === 0) {
    return [];
  }
  const trackNotes = notesByLine.get(layout.line) ?? notesInLine(layout.line);
  const ordinal = new Map(trackNotes.map((note, index) => [note.index, index]));
  const notesByIndex = new Map(trackNotes.map((note) => [note.index, note]));
  const first = Math.min(...lineNotes.map((note) => ordinal.get(note.index) ?? Number.POSITIVE_INFINITY));
  const last = Math.max(...lineNotes.map((note) => ordinal.get(note.index) ?? Number.NEGATIVE_INFINITY));
  const lineNoteIndexes = new Set(lineNotes.map((note) => note.index));

  return document.slurs.flatMap((slur): SlurLineSegment[] => {
    if (slur.track !== effectiveTrackLabel(layout.line)) {
      return [];
    }
    const start = ordinal.get(slur.startNoteIndex);
    const end = ordinal.get(slur.endNoteIndex);
    const boundaryOnLine = slur.branch?.role === "continuation"
      && slur.branch.boundaryOffset >= layout.line.range.start.offset
      && slur.branch.boundaryOffset <= layout.line.range.end.offset;
    if (start === undefined || end === undefined || end < first || (start > last && !boundaryOnLine)) {
      return [];
    }
    const labelNote = slur.noteCount !== undefined
      ? trackNotes[Math.floor((start + end) / 2)]
      : undefined;
    const continuationStartMeasure = slur.branch?.role === "continuation"
      ? layout.measures.find((measure) => measure.measure.notes.some((note) => note.index === slur.startNoteIndex))?.measure
      : undefined;
    const continuationStartIndex = continuationStartMeasure
      ? layout.measures.findIndex((measure) => measure.measure === continuationStartMeasure)
      : -1;
    return [{
      id: `slur:${slur.range.start.offset}:${slur.range.end.offset}:${layout.line.range.start.offset}:${layout.measureStartIndex}`,
      slur,
      lane: lanes.get(slur) ?? 0,
      ...(labelNote && lineNoteIndexes.has(labelNote.index) ? { countLabel: slur.noteCount } : {}),
      ...(lineNoteIndexes.has(slur.startNoteIndex) && slur.branch?.role !== "continuation"
        ? { startNote: notesByIndex.get(slur.startNoteIndex) }
        : {}),
      ...(lineNoteIndexes.has(slur.endNoteIndex) ? { endNote: notesByIndex.get(slur.endNoteIndex) } : {}),
      ...(continuationStartIndex > 0 || boundaryOnLine
        ? { startBoundaryMeasure: continuationStartIndex > 0
            ? layout.measures[continuationStartIndex - 1]!.measure
            : [...layout.measures].reverse().find((entry) => entry.measure.repeatEnd)?.measure }
        : {}),
    }];
  });
}

function naturalMeasureBarX(layout: LineLayout, measure: Measure, contentOffset: number): number | undefined {
  const measureIndex = layout.measures.findIndex((entry) => entry.measure === measure);
  if (measureIndex < 0) {
    return undefined;
  }
  const measureLayout = layout.measures[measureIndex]!;
  const xOffset = measureXOffset(layout.measures, measureIndex);
  const naturalBarX = xOffset + measureLayout.width - measureLayout.rightPadding - DIMENSIONS.repeatRightPadding + 12;
  return contentOffset + naturalBarX + (measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0);
}

interface NaturalLineEntry {
  note: Note;
  x: number;
  ornamentEndX: number;
}

interface NaturalLineGeometry {
  entries: NaturalLineEntry[];
  leftEdgeX: number;
  rightEdgeX: number;
}

function naturalLineGeometry(layout: LineLayout, labelOffset: number, bracketOffset: number): NaturalLineGeometry {
  const contentOffset = labelOffset + bracketOffset;
  const entries: NaturalLineEntry[] = [];
  for (const [measureIndex, measureLayout] of layout.measures.entries()) {
    const xOffset = measureXOffset(layout.measures, measureIndex);
    const naturalBarX = xOffset + measureLayout.width - measureLayout.rightPadding - DIMENSIONS.repeatRightPadding + 12;
    const renderedBarX = contentOffset + naturalBarX + (measureLayout.measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0);
    const ornamentBarX = renderedBarX - (measureLayout.measure.repeatEnd ? 2 : 5);
    const measureEntries: NaturalLineEntry[] = [];
    for (const [noteIndex, note] of measureLayout.measure.notes.entries()) {
      const x =
        contentOffset +
        xOffset +
        measureLayout.notePositions[noteIndex]! +
        ornamentLeftWidthOf(note) +
        measureLayout.leftPadding;
      const entry = { note, x, ornamentEndX: ornamentBarX };
      const previous = measureEntries.at(-1);
      if (previous) {
        previous.ornamentEndX = x + (note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0);
      }
      measureEntries.push(entry);
      entries.push(entry);
    }
  }
  return {
    entries,
    leftEdgeX: contentOffset,
    rightEdgeX: contentOffset + layout.width - DIMENSIONS.leftPadding + 12,
  };
}

function slurHeight(width: number): number {
  return Math.min(DIMENSIONS.slurMaxHeight, Math.max(DIMENSIONS.slurMinHeight, Math.max(1, width) * 0.12));
}

function noteBodyItem(entry: NaturalLineEntry): VerticalItem {
  const accidental = entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0;
  return {
    id: `body:${entry.note.index}`,
    band: "body",
    x1: entry.x - DIMENSIONS.baseNoteWidth / 2,
    x2: entry.x + accidental + DIMENSIONS.baseNoteWidth / 2,
    height: chordHeight(entry.note),
    sourceOrder: entry.note.range.start.offset,
    fixed: true,
  };
}

function graceVerticalBounds(note: PitchNote): { bottom: number; height: number } {
  if (note.ornament?.kind !== "grace") {
    return { bottom: 0, height: 0 };
  }
  const scale = DIMENSIONS.graceNoteFontSize / DIMENSIONS.baseNoteHeight;
  const upperOctaves = Math.max(0, ...note.ornament.pitches.map((pitch) => pitch.octave));
  const lowerOctaves = Math.max(0, ...note.ornament.pitches.map((pitch) => -pitch.octave));
  const halves = Math.log2(note.ornament.pitches.length) + 1;
  const upperExtent = Math.max(
    DIMENSIONS.baseNoteHeight,
    DIMENSIONS.octaveDotVerticalOffset + upperOctaves * DIMENSIONS.octaveSpacing + 2,
  );
  const lowerExtent = Math.max(
    DIMENSIONS.baseNoteHeight * 0.2,
    DIMENSIONS.octaveDotBelowOffset + lowerOctaves * DIMENSIONS.octaveSpacing + 2,
    DIMENSIONS.octaveDotBelowOffset + (halves - 1) * DIMENSIONS.underlineSpacing + DIMENSIONS.underlineSpacing / 4,
  );
  const bottom = Math.max(0, DIMENSIONS.graceNoteYOffset - lowerExtent * scale);
  const top = DIMENSIONS.graceNoteYOffset + upperExtent * scale;
  return { bottom, height: top - bottom };
}

function ornamentItem(entry: NaturalLineEntry): VerticalItem | undefined {
  const note = entry.note;
  if (!note.ornament) {
    return undefined;
  }
  const accidental = note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0;
  const centerX = entry.x + accidental;
  if (note.ornament.kind === "grace") {
    if (note.kind !== "pitch") {
      return undefined;
    }
    const bounds = graceVerticalBounds(note);
    return {
      id: `ornament:${note.index}`,
      band: "ornament",
      x1: entry.x - ornamentLeftWidthOf(note) - DIMENSIONS.graceNoteGap,
      x2: entry.x + ornamentRightWidthOf(note) + DIMENSIONS.graceNoteGap,
      height: bounds.height,
      gap: DIMENSIONS.verticalLaneGap,
      preferredBottom: bounds.bottom,
      sourceOrder: note.range.start.offset,
    };
  }
  if (note.ornament.kind === "slide") {
    return {
      id: `ornament:${note.index}`,
      band: "ornament",
      x1: centerX + DIMENSIONS.slideXOffset,
      x2: centerX + DIMENSIONS.slideXOffset + DIMENSIONS.slideRadius + DIMENSIONS.slideArrowHalfWidth,
      height: DIMENSIONS.slideLowYOffset,
      gap: DIMENSIONS.verticalLaneGap,
      sourceOrder: note.range.start.offset,
    };
  }
  return {
    id: `ornament:${note.index}`,
    band: "ornament",
    x1: centerX - DIMENSIONS.ornamentHeight / 2,
    x2:
      note.ornament.kind === "trill" && note.ornament.extension === "wavy" && note.duration.dashes > 0
        ? Math.max(centerX + DIMENSIONS.ornamentHeight / 2, entry.ornamentEndX)
        : centerX + DIMENSIONS.ornamentHeight / 2,
    height: DIMENSIONS.ornamentHeight,
    gap: DIMENSIONS.verticalLaneGap,
    sourceOrder: note.range.start.offset,
  };
}

function anchorHorizontalBounds(entry: NaturalLineEntry): { left: number; right: number } {
  const body = noteBodyItem(entry);
  let left = body.x1;
  let right = body.x2;
  const ornament = ornamentItem(entry);
  if (ornament) {
    left = Math.min(left, ornament.x1);
    right = Math.max(right, ornament.x2);
  }
  if (entry.note.velocity !== undefined) {
    const label = VELOCITY_LABELS[entry.note.velocity] ?? "";
    const halfWidth = textWidth(label, DIMENSIONS.velocityFontSize) / 2;
    left = Math.min(left, entry.x - halfWidth);
    right = Math.max(right, entry.x + halfWidth);
  }
  return { left, right };
}

function textWidth(text: string, fontSize: number): number {
  return Math.max(fontSize, text.length * fontSize * 0.62);
}

function hairpinSegmentId(segment: HairpinSegment, layout: LineLayout): string {
  return `hairpin:${segment.kind}:${segment.start.index}:${segment.end.index}:${layout.line.range.start.offset}:${layout.measureStartIndex}`;
}

function endingItemId(measure: Measure): string {
  return `ending:${measure.range.start.offset}`;
}

function navigationBeforeId(measure: Measure): string {
  return `navigation-before:${measure.range.start.offset}`;
}

function navigationAfterId(measure: Measure, kind: "fine" | "instruction"): string {
  return `navigation-after:${kind}:${measure.range.start.offset}`;
}

function collectVerticalItems(
  layout: LineLayout,
  labelOffset: number,
  bracketOffset: number,
  notesByLine: Map<ScoreLine, Note[]>,
  slurSegments: SlurLineSegment[],
): VerticalItem[] {
  const geometry = naturalLineGeometry(layout, labelOffset, bracketOffset);
  const entryByNote = new Map(geometry.entries.map((entry) => [entry.note, entry]));
  const trackNotes = notesByLine.get(layout.line) ?? notesInLine(layout.line);
  const items: VerticalItem[] = geometry.entries.map(noteBodyItem);

  for (const entry of geometry.entries) {
    const previousNote = previousNoteInSequence(trackNotes, entry.note);
    const previous = previousNote ? entryByNote.get(previousNote) : undefined;
    const nextNote = nextNoteInSequence(trackNotes, entry.note);
    const next = nextNote ? entryByNote.get(nextNote) : undefined;
    if (entry.note.tie) {
      const endingBoundary = entry.note.tieFromEnding
        ? (() => {
            const measureIndex = layout.measures.findIndex((item) => item.measure.notes.includes(entry.note));
            return measureIndex > 0
              ? naturalMeasureBarX(layout, layout.measures[measureIndex - 1]!.measure, labelOffset + bracketOffset)
              : undefined;
          })()
        : undefined;
      items.push({
        id: `tie:${entry.note.index}`,
        band: "tie",
        x1: endingBoundary ?? previous?.x ?? geometry.leftEdgeX,
        x2: entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0),
        height: DIMENSIONS.tieHeight + DIMENSIONS.tieStrokeWidth,
        gap: DIMENSIONS.verticalLaneGap,
        sourceOrder: entry.note.range.start.offset,
      });
    }
    if (nextNote?.tie && !nextNote.tieFromEnding && !next) {
      items.push({
        id: `tie:${nextNote.index}`,
        band: "tie",
        x1: entry.x,
        x2: geometry.rightEdgeX,
        height: DIMENSIONS.tieHeight + DIMENSIONS.tieStrokeWidth,
        gap: DIMENSIONS.verticalLaneGap,
        sourceOrder: nextNote.range.start.offset,
      });
    }
    const ornament = ornamentItem(entry);
    if (ornament) {
      items.push(ornament);
    }
    if (entry.note.velocity !== undefined) {
      const label = VELOCITY_LABELS[entry.note.velocity] ?? "";
      items.push({
        id: `velocity:${entry.note.index}`,
        band: "velocity",
        x1: entry.x - textWidth(label, DIMENSIONS.velocityFontSize) / 2,
        x2: entry.x + textWidth(label, DIMENSIONS.velocityFontSize) / 2,
        height: DIMENSIONS.velocityFontSize,
        gap: DIMENSIONS.verticalLaneGap,
        sourceOrder: entry.note.range.start.offset,
      });
    }
  }

  const lineTrackIndexes = geometry.entries.map((entry) => trackNotes.indexOf(entry.note)).filter((index) => index >= 0);
  const firstLineTrackIndex = Math.min(...lineTrackIndexes);
  const lastLineTrackIndex = Math.max(...lineTrackIndexes);
  for (const segment of hairpinSegments(trackNotes)) {
    const startIndex = trackNotes.indexOf(segment.start);
    const endIndex = trackNotes.indexOf(segment.end);
    if (startIndex < 0 || endIndex < 0 || endIndex < firstLineTrackIndex || startIndex > lastLineTrackIndex) {
      continue;
    }
    const start = entryByNote.get(segment.start);
    const end = entryByNote.get(segment.end);
    const containsInterior = geometry.entries.some((entry) => {
      const index = trackNotes.indexOf(entry.note);
      return index > startIndex && index < endIndex;
    });
    if (!start && !end && !containsInterior) {
      continue;
    }
    items.push({
      id: hairpinSegmentId(segment, layout),
      band: "hairpin",
      x1: start?.x ?? geometry.leftEdgeX,
      x2: end?.x ?? geometry.rightEdgeX,
      height: DIMENSIONS.hairpinHeight + DIMENSIONS.hairpinStrokeWidth,
      gap: DIMENSIONS.verticalLaneGap,
      sourceOrder: segment.start.range.start.offset,
    });
  }

  const slurItems: Array<VerticalItem & { lane: number }> = slurSegments.map((segment) => {
    const start = segment.startNote ? entryByNote.get(segment.startNote) : undefined;
    const end = segment.endNote ? entryByNote.get(segment.endNote) : undefined;
    const laneOutset = segment.lane * DIMENSIONS.verticalLaneGap;
    if (start) {
      const desiredStartX =
        anchorHorizontalBounds(start).left - DIMENSIONS.slurEndpointGap - laneOutset;
      const safeStartX = geometry.leftEdgeX + DIMENSIONS.slurStrokeWidth / 2;
      segment.startOutset = start.x - Math.max(safeStartX, desiredStartX);
    }
    if (end) {
      const desiredEndX =
        anchorHorizontalBounds(end).right + DIMENSIONS.slurEndpointGap + laneOutset;
      const safeEndX = geometry.rightEdgeX - DIMENSIONS.slurStrokeWidth / 2;
      segment.endOutset = Math.min(safeEndX, desiredEndX) - end.x;
    }
    const x1 = start
      ? start.x - (segment.startOutset ?? DIMENSIONS.slurEndpointOutset)
      : segment.startBoundaryMeasure
        ? naturalMeasureBarX(layout, segment.startBoundaryMeasure, labelOffset + bracketOffset) ?? geometry.leftEdgeX
        : geometry.leftEdgeX;
    const x2 = end ? end.x + (segment.endOutset ?? DIMENSIONS.slurEndpointOutset) : geometry.rightEdgeX;
    return {
      id: segment.id,
      band: "slur",
      x1,
      x2,
      height:
        slurHeight(x2 - x1) +
        Math.max(DIMENSIONS.slurStrokeWidth / 2, segment.countLabel !== undefined ? DIMENSIONS.slurCountFontSize / 2 : 0),
      gap: DIMENSIONS.verticalLaneGap,
      sourceOrder: segment.slur.range.start.offset,
      lane: segment.lane,
    };
  });
  for (const item of slurItems) {
    item.dependsOn = slurItems
      .filter((inner) => inner.lane < item.lane && inner.x1 < item.x2 && item.x1 < inner.x2)
      .map((inner) => inner.id);
    items.push(item);
  }

  const contentOffset = labelOffset + bracketOffset;
  for (const [measureIndex, measureLayout] of layout.measures.entries()) {
    const measure = measureLayout.measure;
    const xOffset = measureXOffset(layout.measures, measureIndex);
    const naturalBarX = xOffset + measureLayout.width - measureLayout.rightPadding - DIMENSIONS.repeatRightPadding + 12;
    const previousMeasure = layout.measures[measureIndex - 1]?.measure;
    if (measure.ending !== undefined && !sameEnding(previousMeasure?.ending, measure.ending)) {
      let endingEndMeasureIndex = measureIndex;
      while (sameEnding(layout.measures[endingEndMeasureIndex + 1]?.measure.ending, measure.ending)) {
        endingEndMeasureIndex += 1;
      }
      const endLayout = layout.measures[endingEndMeasureIndex]!;
      const endOffset = measureXOffset(layout.measures, endingEndMeasureIndex);
      const endingEndX = endOffset + endLayout.width - endLayout.rightPadding - DIMENSIONS.repeatRightPadding + 12;
      items.push({
        id: endingItemId(measure),
        band: "ending",
        x1: contentOffset + xOffset + measureLayout.leftPadding - DIMENSIONS.leftPadding / 2 - DIMENSIONS.endingLeftOverhang,
        x2: contentOffset + endingEndX + (endLayout.measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0),
        height: DIMENSIONS.endingHeight,
        gap: DIMENSIONS.verticalLaneGap,
        sourceOrder: measure.range.start.offset,
      });
    }
    const before = measure.navigationBefore ?? [];
    if (before.length > 0) {
      const x = contentOffset + xOffset + measureLayout.leftPadding - DIMENSIONS.leftPadding / 2;
      const width = before.reduce((sum, mark) => sum + navigationBeforeDisplay(mark).advance, 0);
      items.push({ id: navigationBeforeId(measure), band: "navigation", x1: x, x2: x + width, height: DIMENSIONS.navigationFontHeight, gap: DIMENSIONS.verticalLaneGap, sourceOrder: measure.range.start.offset });
    }
    const after = measure.navigationAfter ?? [];
    if (after.includes("fine")) {
      const x = contentOffset + naturalBarX;
      const width = textWidth("Fine", DIMENSIONS.navigationTextFontSize);
      items.push({ id: navigationAfterId(measure, "fine"), band: "navigation", x1: x - width / 2, x2: x + width / 2, height: DIMENSIONS.navigationFontHeight, gap: DIMENSIONS.verticalLaneGap, sourceOrder: measure.range.end.offset });
    }
    const instructions = after.filter((mark) => mark !== "fine");
    if (instructions.length > 0) {
      const labels = instructions.map(navigationAfterLabel).join(", ");
      const x = contentOffset + naturalBarX;
      const width = textWidth(labels, DIMENSIONS.navigationTextFontSize);
      items.push({ id: navigationAfterId(measure, "instruction"), band: "navigation", x1: x - width / 2, x2: x + width / 2, height: DIMENSIONS.navigationFontHeight, gap: DIMENSIONS.verticalLaneGap, sourceOrder: measure.range.end.offset });
    }
  }
  return items;
}

function withVerticalLayout(layout: LineLayout, plan: VerticalLinePlan): LineLayout {
  const paddingDown = Math.max(0, layout.height - layout.maxPaddingUp - DIMENSIONS.noteBottomPadding);
  return {
    ...layout,
    maxPaddingUp: plan.aboveHeight,
    height: plan.aboveHeight + paddingDown + DIMENSIONS.noteBottomPadding,
    verticalPlan: plan,
  };
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
  slurSegments: SlurLineSegment[],
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
  const endingTieStartX = (note: Note): number => {
    const measureIndex = layout.measures.findIndex((entry) => entry.measure.notes.includes(note));
    if (measureIndex <= 0) {
      return fragmentEdgeX(leftTieEdgeX, DIMENSIONS.tieStrokeWidth, "left");
    }
    const previousLayout = layout.measures[measureIndex - 1]!;
    const xOffset = measureXOffset(layout.measures, measureIndex - 1);
    const naturalBarX = xOffset + previousLayout.width - previousLayout.rightPadding - DIMENSIONS.repeatRightPadding + 12;
    return contentOffset + justifyX(naturalBarX + (previousLayout.measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0));
  };
  if (displayLabel) {
    parts.push(`<text class="line-label" x="8" y="${lineY + layout.maxPaddingUp}" text-anchor="start">${escapeXml(displayLabel)}</text>`);
  }
  for (const [measureIndex, measureLayout] of layout.measures.entries()) {
    const xOffset = measureXOffset(layout.measures, measureIndex);
    const fullness = measureFullness(measureLayout.measure, unit);
    const previousMeasure = layout.measures[measureIndex - 1]?.measure;
    const nextMeasure = layout.measures[measureIndex + 1]?.measure;
    const naturalBarX = xOffset + measureLayout.width - measureLayout.rightPadding - DIMENSIONS.repeatRightPadding + 12;
    const renderedBarX = contentOffset + justifyX(
      naturalBarX + (measureLayout.measure.repeatEnd ? DIMENSIONS.repeatEndLeftGap : 0),
    );
    const ornamentBarX =
      renderedBarX - (measureLayout.measure.repeatEnd ? 2 : finalBarMeasures.has(measureLayout.measure) ? 5 : 0);
    const navigationBefore = measureLayout.measure.navigationBefore ?? [];
    if (navigationBefore.length > 0) {
      const navigationX = xOffset + measureLayout.leftPadding - DIMENSIONS.leftPadding / 2;
      const placement = layout.verticalPlan?.placements.get(navigationBeforeId(measureLayout.measure));
      const navigationY =
        lineY + layout.maxPaddingUp - (placement?.anchor ?? 0) - DIMENSIONS.navigationTextDescent;
      parts.push(renderNavigationBefore(navigationBefore, contentOffset + justifyX(navigationX), navigationY));
    }
    const navigationAfter = measureLayout.measure.navigationAfter ?? [];
    if (navigationAfter.includes("fine")) {
      const placement = layout.verticalPlan?.placements.get(navigationAfterId(measureLayout.measure, "fine"));
      const y = lineY + layout.maxPaddingUp - (placement?.anchor ?? 0) - DIMENSIONS.navigationTextDescent;
      parts.push(renderFine(contentOffset + justifyX(naturalBarX), y));
    }
    const navigationInstructions = navigationAfter.filter((mark) => mark !== "fine");
    if (navigationInstructions.length > 0) {
      const placement = layout.verticalPlan?.placements.get(navigationAfterId(measureLayout.measure, "instruction"));
      const y = lineY + layout.maxPaddingUp - (placement?.anchor ?? 0) - DIMENSIONS.navigationTextDescent;
      parts.push(renderNavigationAfter(navigationInstructions, contentOffset + justifyX(naturalBarX), y));
    }
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
          layout.verticalPlan?.placements.get(endingItemId(measureLayout.measure)),
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
    const measureEntries: LineEntry[] = [];
    for (const [noteIndex, note] of measureLayout.measure.notes.entries()) {
      const nextMeasureNote = measureLayout.measure.notes[noteIndex + 1];
      const naturalX = xOffset + measureLayout.notePositions[noteIndex]! + ornamentLeftWidthOf(note) + measureLayout.leftPadding;
      groupStartX ??= naturalX;
      const groupShift = justifyX(groupStartX) - groupStartX;
      const dashAnchors = measureLayout.dashPositions[noteIndex]!.map((dashPosition) => {
        const naturalDashX = xOffset + dashPosition + measureLayout.leftPadding;
        return contentOffset + justifyX(naturalDashX);
      });
      const entry: LineEntry = {
        note,
        x: contentOffset + naturalX + groupShift,
        y: lineY + layout.maxPaddingUp,
        full: (fullness[noteIndex] ?? false) || nextMeasureNote === undefined || nextMeasureNote.duration.halves === 0,
        dashAnchors,
        ornamentEndX: ornamentBarX,
      };
      const previousEntry = measureEntries.at(-1);
      if (previousEntry) {
        previousEntry.ornamentEndX = entry.x + (note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0);
      }
      measureEntries.push(entry);
      lineEntries.push(entry);
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

  const lineTrackIndexes = lineEntries.map((entry) => trackNotes.indexOf(entry.note)).filter((index) => index >= 0);
  const firstLineTrackIndex = Math.min(...lineTrackIndexes);
  const lastLineTrackIndex = Math.max(...lineTrackIndexes);
  for (const segment of hairpinSegments(trackNotes)) {
    const startIndex = trackNotes.indexOf(segment.start);
    const endIndex = trackNotes.indexOf(segment.end);
    if (startIndex < 0 || endIndex < 0 || endIndex < firstLineTrackIndex || startIndex > lastLineTrackIndex) {
      continue;
    }
    const startEntry = lineEntries.find((entry) => entry.note === segment.start);
    const endEntry = lineEntries.find((entry) => entry.note === segment.end);
    const containsInterior = lineEntries.some((entry) => {
      const index = trackNotes.indexOf(entry.note);
      return index > startIndex && index < endIndex;
    });
    if (!startEntry && !endEntry && !containsInterior) {
      continue;
    }
    const startX =
      (startEntry?.x ?? fragmentEdgeX(leftTieEdgeX, DIMENSIONS.hairpinStrokeWidth, "left")) +
      (startEntry && isHairpinTransition(segment.start) ? DIMENSIONS.hairpinTransitionGap / 2 : 0);
    const endX =
      (endEntry?.x ?? fragmentEdgeX(rightTieEdgeX, DIMENSIONS.hairpinStrokeWidth, "right")) -
      (endEntry && isHairpinTransition(segment.end) ? DIMENSIONS.hairpinTransitionGap / 2 : 0);
    const placement = layout.verticalPlan?.placements.get(hairpinSegmentId(segment, layout));
    const centerOffset = placement
      ? (placement.bottom + placement.top) / 2
      : DIMENSIONS.baseNoteHeight + DIMENSIONS.verticalLaneGap + DIMENSIONS.hairpinHeight / 2;
    parts.push(renderHairpin(segment.kind, startX, endX, lineY + layout.maxPaddingUp - centerOffset));
  }

  const bodyTop = Math.max(
    DIMENSIONS.baseNoteHeight,
    ...[...(layout.verticalPlan?.placements.values() ?? [])]
      .filter((placement) => placement.band === "body")
      .map((placement) => placement.top),
  );
  for (const segment of slurSegments) {
    const startEntry = segment.startNote
      ? lineEntries.find((entry) => entry.note === segment.startNote)
      : undefined;
    const endEntry = segment.endNote
      ? lineEntries.find((entry) => entry.note === segment.endNote)
      : undefined;
    const boundaryX = segment.startBoundaryMeasure
      ? naturalMeasureBarX(layout, segment.startBoundaryMeasure, 0)
      : undefined;
    const startX = startEntry
      ? startEntry.x - (segment.startOutset ?? DIMENSIONS.slurEndpointOutset)
      : boundaryX !== undefined
        ? contentOffset + justifyX(boundaryX)
        : fragmentEdgeX(leftTieEdgeX, DIMENSIONS.slurStrokeWidth, "left");
    const endX = endEntry
      ? endEntry.x + (segment.endOutset ?? DIMENSIONS.slurEndpointOutset)
      : fragmentEdgeX(rightTieEdgeX, DIMENSIONS.slurStrokeWidth, "right");
    const placement = layout.verticalPlan?.placements.get(segment.id);
    const baselineY = lineY + layout.maxPaddingUp;
    const endpointY = baselineY - bodyTop - DIMENSIONS.slurEndpointGap;
    const platformTopPadding = Math.max(
      DIMENSIONS.slurStrokeWidth / 2,
      segment.countLabel !== undefined ? DIMENSIONS.slurCountFontSize / 2 : 0,
    );
    const platformOffset = placement
      ? placement.top - platformTopPadding
      : bodyTop + DIMENSIONS.slurEndpointGap + slurHeight(endX - startX);
    const platformY = baselineY - platformOffset;
    parts.push(
      renderSlur(
        startX,
        Math.max(startX + 1, endX),
        endpointY,
        platformY,
        startEntry !== undefined,
        endEntry !== undefined,
        segment.countLabel,
      ),
    );
  }

  for (const entry of lineEntries) {
    const previousNote = previousNoteInSequence(trackNotes, entry.note);
    const previous = previousNote ? lineEntries.find((candidate) => candidate.note === previousNote) : undefined;
    const nextNote = nextNoteInSequence(trackNotes, entry.note);
    if (
      entry.note.kind === "pitch" &&
      entry.note.ornament?.kind === "slide" &&
      nextNote?.kind === "pitch"
    ) {
      const direction = slideDirection(entry.note, nextNote);
      if (direction !== 0) {
        const placement = layout.verticalPlan?.placements.get(`ornament:${entry.note.index}`);
        const intrinsicBottom = direction > 0
          ? DIMENSIONS.slideLowYOffset
          : DIMENSIONS.slideLowYOffset - DIMENSIONS.slideArrowLength;
        const shift = Math.max(0, (placement?.anchor ?? intrinsicBottom) - intrinsicBottom);
        parts.push(renderSlide(entry.x + maxAccidentalOffset(entry.note.chord), entry.y - shift, direction));
      }
    }
    if (entry.note.tie && previous && !entry.note.tieFromEnding) {
      const startX = previous.x + (previous.note.kind === "pitch" ? maxAccidentalOffset(previous.note.chord) : 0);
      const endX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      const placement = layout.verticalPlan?.placements.get(`tie:${entry.note.index}`);
      const tieOffset = (placement?.anchor ?? chordHeight(entry.note) + DIMENSIONS.verticalLaneGap) + DIMENSIONS.tieStrokeWidth / 2;
      parts.push(renderTie(startX, endX, entry.y - tieOffset));
    } else if (entry.note.tie) {
      const endX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      const placement = layout.verticalPlan?.placements.get(`tie:${entry.note.index}`);
      const tieOffset = (placement?.anchor ?? chordHeight(entry.note) + DIMENSIONS.verticalLaneGap) + DIMENSIONS.tieStrokeWidth / 2;
      const startX = entry.note.tieFromEnding ? endingTieStartX(entry.note) : fragmentEdgeX(leftTieEdgeX, DIMENSIONS.tieStrokeWidth, "left");
      parts.push(renderIncomingTie(startX, endX, entry.y - tieOffset));
    }
    const nextRendered = nextNote ? lineEntries.some((candidate) => candidate.note === nextNote) : false;
    if (nextNote?.tie && !nextNote.tieFromEnding && !nextRendered) {
      const startX = entry.x + (entry.note.kind === "pitch" ? maxAccidentalOffset(entry.note.chord) : 0);
      const placement = layout.verticalPlan?.placements.get(`tie:${nextNote.index}`);
      const tieOffset = (placement?.anchor ?? chordHeight(entry.note) + DIMENSIONS.verticalLaneGap) + DIMENSIONS.tieStrokeWidth / 2;
      parts.push(renderOutgoingTie(startX, fragmentEdgeX(rightTieEdgeX, DIMENSIONS.tieStrokeWidth, "right"), entry.y - tieOffset));
    }

    const className = activeNoteIndices.has(entry.note.index) ? "note-item active" : "note-item";
    const noteParts: string[] = [];
    if (entry.note.velocity !== undefined) {
      const label = VELOCITY_LABELS[entry.note.velocity];
      if (label) {
        const placement = layout.verticalPlan?.placements.get(`velocity:${entry.note.index}`);
        const velocityY = entry.y - (placement?.anchor ?? chordHeight(entry.note) + DIMENSIONS.verticalLaneGap) - DIMENSIONS.velocityTextDescent;
        noteParts.push(`<text class="velocity" x="${entry.x}" y="${velocityY}" text-anchor="middle">${escapeXml(label)}</text>`);
      }
    }
    if (entry.note.kind === "pitch") {
      noteParts.push(renderPitchNote(entry.note, entry.x, entry.y));
    } else {
      noteParts.push(renderRestOrDrum(entry.note, entry.x, entry.y));
    }
    noteParts.push(
      renderOrnament(
        entry.note,
        entry.x,
        entry.y,
        entry.ornamentEndX,
        layout.verticalPlan?.placements.get(`ornament:${entry.note.index}`),
      ),
    );
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
  groupMusicWidth: number;
  slurSegments: SlurLineSegment[];
}

interface ScoreLayoutContext {
  groups: ScoreLineGroup[];
  layouts: RenderLineLayout[];
  hasLabels: boolean;
  finalMeasures: Set<Measure>;
  notesByLine: Map<ScoreLine, Note[]>;
}

interface ScoreVisualBlock {
  items: RenderLineLayout[];
  groupIndex: number;
  index: number;
  height: number;
  pageBreakBefore: boolean;
}

interface ScoreRenderPlacement {
  block: ScoreVisualBlock;
  y: number;
  pageIndex?: number;
}

interface ScoreRenderResult {
  svg: string;
  height: number;
  width: number;
  pages?: string[];
}

export type OverwideScoreLayoutWarning =
  {
    kind: "overwide-line";
    range: SourceRange;
    naturalWidth: number;
    pageWidth: number;
    multiTrack: boolean;
  };

export type ScoreGeometryWarning =
  | {
      kind: "overwide-score-group";
      range: SourceRange;
      naturalWidth: number;
      pageWidth: number;
      scaleX: number;
      multiTrack: boolean;
    }
  | {
      kind: "overwide-lyric";
      range: SourceRange;
      naturalWidth: number;
      pageWidth: number;
      scaleX: number;
    }
  | {
      kind: "overheight-group";
      range: SourceRange;
      naturalHeight: number;
      pageHeight: number;
    };

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

function noteAdvanceInLayout(layout: MeasureLayout, noteIndex: number): number {
  const position = layout.notePositions[noteIndex] ?? 0;
  const nextPosition = layout.notePositions[noteIndex + 1];
  return nextPosition !== undefined ? nextPosition - position : measureContentWidth(layout) - position;
}

function rhythmicSlotWidth(layout: MeasureLayout, noteIndex: number): number {
  const note = layout.measure.notes[noteIndex]!;
  return Math.max(0, noteAdvanceInLayout(layout, noteIndex) - note.duration.dashes * DIMENSIONS.dashSpacing);
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

      for (const [noteIndex] of layout.measure.notes.entries()) {
        const noteStart = positions.noteStarts[noteIndex]!;
        if (noteStart >= beatStart - 1e-9 && noteStart < beatEnd - 1e-9) {
          setTimelineWidth(widthsByRelativeStart, noteStart - beatStart, rhythmicSlotWidth(layout, noteIndex));
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
    for (const [noteIndex] of layout.measure.notes.entries()) {
      setTimelineWidth(widthsByStart, positions.noteStarts[noteIndex]!, rhythmicSlotWidth(layout, noteIndex));
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

function lyricCharWidth(char: string): number {
  if (/\s/u.test(char)) {
    return LYRIC_SPACE_WIDTH;
  }
  if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(char)) {
    return LYRIC_CJK_WIDTH;
  }
  if (/[A-Za-z0-9]/u.test(char)) {
    return LYRIC_LATIN_WIDTH;
  }
  if (/[\p{P}\p{S}]/u.test(char)) {
    return LYRIC_PUNCTUATION_WIDTH;
  }
  return LYRIC_OTHER_WIDTH;
}

function lyricTextWidth(text: string): number {
  return [...text].reduce((sum, char) => sum + lyricCharWidth(char), 0);
}

interface RenderedLyricSyllable {
  text: string;
  startIndex: number;
  endIndex: number;
}

function renderedLyricSyllables(lyric: LyricLine): RenderedLyricSyllable[] {
  const syllables: RenderedLyricSyllable[] = [];
  for (const [index, unit] of lyric.alignment.entries()) {
    if (unit.kind === "syllable") {
      syllables.push({ text: unit.text, startIndex: index, endIndex: index });
    } else if (unit.kind === "merge") {
      const previous = syllables.at(-1);
      if (previous) {
        previous.endIndex = index;
      }
    }
  }
  return syllables;
}

function lyricLayoutConstraints(line: ScoreLine, lyrics: LyricLine[]): LineLayoutConstraints | undefined {
  const soundingNotes = notesInLine(line).filter((note) => note.kind !== "rest");
  if (soundingNotes.length <= 1) {
    return undefined;
  }

  const widths = Array.from({ length: soundingNotes.length }, () => 0);
  let lineStartPadding = 0;
  let lineEndPadding = 0;
  for (const lyric of lyrics) {
    if (lyric.alignment.length <= 1 || lyric.alignment.length > soundingNotes.length) {
      continue;
    }
    const syllables = renderedLyricSyllables(lyric);
    for (const syllable of syllables) {
      const width = lyricTextWidth(syllable.text);
      widths[syllable.startIndex] = Math.max(widths[syllable.startIndex] ?? 0, width);
    }
    const firstSyllable = syllables[0];
    const lastSyllable = syllables.at(-1);
    if (firstSyllable) {
      lineStartPadding = Math.max(lineStartPadding, lyricTextWidth(firstSyllable.text) / 2);
    }
    if (lastSyllable) {
      lineEndPadding = Math.max(lineEndPadding, lyricTextWidth(lastSyllable.text) / 2);
    }
  }

  if (widths.every((width) => width === 0) && lineStartPadding === 0 && lineEndPadding === 0) {
    return undefined;
  }

  const minAdvanceByNote = new Map<Note, number>();
  for (let index = 0; index < widths.length - 1; index += 1) {
    if (widths[index] === 0 || widths[index + 1] === 0) {
      continue;
    }
    const requiredAdvance = widths[index]! / 2 + widths[index + 1]! / 2 + LYRIC_SYLLABLE_GAP;
    const note = soundingNotes[index]!;
    minAdvanceByNote.set(note, Math.max(minAdvanceByNote.get(note) ?? 0, requiredAdvance));
  }
  return { minAdvanceByNote, lineStartPadding, lineEndPadding };
}

function navigationLayoutConstraints(line: ScoreLine): LineLayoutConstraints | undefined {
  const navigationAfter = line.measures.at(-1)?.navigationAfter ?? [];
  if (navigationAfter.length === 0) {
    return undefined;
  }
  const widths: number[] = [];
  if (navigationAfter.includes("fine")) {
    widths.push(textWidth("Fine", DIMENSIONS.navigationTextFontSize));
  }
  const instructions = navigationAfter.filter((mark) => mark !== "fine");
  if (instructions.length > 0) {
    widths.push(
      textWidth(
        instructions.map(navigationAfterLabel).join(", "),
        DIMENSIONS.navigationTextFontSize,
      ),
    );
  }
  return {
    lineEndPadding: Math.max(0, ...widths) / 2 + DIMENSIONS.verticalLaneGap,
  };
}

function mergeLineLayoutConstraints(
  left: LineLayoutConstraints | undefined,
  right: LineLayoutConstraints | undefined,
): LineLayoutConstraints | undefined {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  const minAdvanceByNote = new Map(left.minAdvanceByNote);
  for (const [note, advance] of right.minAdvanceByNote ?? []) {
    minAdvanceByNote.set(note, Math.max(minAdvanceByNote.get(note) ?? 0, advance));
  }
  return {
    ...(minAdvanceByNote.size > 0 ? { minAdvanceByNote } : {}),
    lineStartPadding: Math.max(left.lineStartPadding ?? 0, right.lineStartPadding ?? 0),
    lineEndPadding: Math.max(left.lineEndPadding ?? 0, right.lineEndPadding ?? 0),
  };
}

function layoutGroupLines(group: ScoreLineGroup, pageWidth: number, hasLabels: boolean): LineLayout[] {
  return group.lines.flatMap((line) => {
    const lyricConstraints = isPrimaryLyricLine(line, hasLabels)
      ? lyricLayoutConstraints(line, group.lyrics)
      : undefined;
    const constraints = mergeLineLayoutConstraints(lyricConstraints, navigationLayoutConstraints(line));
    return layoutLine(line, pageWidth, constraints);
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

function lyricNaturalWidth(group: ScoreLineGroup, lyric: LyricLine): number {
  const textWidth = lyricTextWidth(lyric.text);
  if (textWidth === 0) {
    return 0;
  }
  return group.labelOffset + group.bracketOffset + DIMENSIONS.leftPadding + textWidth + group.bracketOffset;
}

function primaryLineForLyrics(group: ScoreLineGroup, hasLabels: boolean): ScoreLine | undefined {
  return group.lines.find((line) => isPrimaryLyricLine(line, hasLabels));
}

function isAlignedLyric(group: ScoreLineGroup, lyric: LyricLine, hasLabels: boolean): boolean {
  const primaryLine = primaryLineForLyrics(group, hasLabels);
  const anchorCount = primaryLine ? notesInLine(primaryLine).filter((note) => note.kind !== "rest").length : 0;
  return lyric.alignment.length > 1 && lyric.alignment.length <= anchorCount;
}

function shouldJustifyGroup(justifyMode: JustifyMode, groupIndex: number, groupCount: number): boolean {
  return justifyMode === "all" || (justifyMode === "except-last" && groupIndex < groupCount - 1);
}

function renderVoiceBracket(x: number, y1: number, y2: number, side: "left" | "right"): string {
  const hook = 9;
  const bevel = 7;
  const innerX = side === "left" ? x + hook : x - hook;
  return `<path class="voice-bracket" d="M${innerX},${y1} L${x},${y1 + bevel} V${y2 - bevel} L${innerX},${y2}"/><path class="voice-bracket-stem" d="M${x},${y1 + bevel} V${y2 - bevel}"/>`;
}

function renderLyrics(document: Document, lyrics: LyricLine[], contentX: number, y: number, targetTextWidth: number | undefined): string {
  return lyrics
    .map((lyric, index) => {
      const lineY = y + index * DIMENSIONS.lyricLineHeight;
      const displayLabel = lyricLineDisplayLabel(document, lyric);
      const label = displayLabel ? `<text class="line-label" x="8" y="${lineY}" text-anchor="start">${escapeXml(displayLabel)}</text>` : "";
      const naturalTextWidth = lyricTextWidth(lyric.text);
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
      if (lyric.alignment.length <= 1 || lyric.alignment.length > anchors.length) {
        return renderLyrics(document, [lyric], contentX, y + index * DIMENSIONS.lyricLineHeight, targetTextWidth);
      }
      const lineY = y + index * DIMENSIONS.lyricLineHeight;
      const displayLabel = lyricLineDisplayLabel(document, lyric);
      const label = displayLabel ? `<text class="line-label" x="8" y="${lineY}" text-anchor="start">${escapeXml(displayLabel)}</text>` : "";
      const syllables = renderedLyricSyllables(lyric)
        .map((syllable) => {
          const x = (anchors[syllable.startIndex]! + anchors[syllable.endIndex]!) / 2;
          return `<text class="lyric-syllable" x="${x}" y="${lineY}" text-anchor="middle">${escapeXml(syllable.text)}</text>`;
        })
        .join("");
      return `${label}${syllables}`;
    })
    .join("\n");
}

function isPrimaryLyricLine(line: ScoreLine, hasLabels: boolean): boolean {
  return !hasLabels || line.label === undefined || line.label === "T1";
}

function layoutScore(document: Document, pageWidth: number): ScoreLayoutContext {
  const unit = actualNotePerBeat(document.header.timeSignature);
  const groups = scoreLineGroups(document);
  const hasLabels = document.score.some((line) => line.label !== undefined);
  const notesByLine = lineNotesByTrack(document);
  const slurLanes = slurLaneMap(document, notesByLine);
  const finalMeasures = finalBarMeasures(groups);
  const layouts = groups.flatMap((group, groupIndex) => {
    const groupLayouts = alignLineLayouts(layoutGroupLines(group, Math.max(1, pageWidth - group.labelOffset - group.bracketOffset * 2), hasLabels), unit);
    const groupMusicWidth = Math.max(0, ...groupLayouts.map((layout) => layout.width + group.labelOffset + group.bracketOffset * 2));
    return groupLayouts.map((lineLayout) => {
      const slurSegments = projectSlursToLine(document, lineLayout, notesByLine, slurLanes);
      const verticalPlan = planVerticalLine(
        collectVerticalItems(lineLayout, group.labelOffset, group.bracketOffset, notesByLine, slurSegments),
      );
      const adjustedLayout = withVerticalLayout(lineLayout, verticalPlan);
      return {
        layout: adjustedLayout,
        groupIndex,
        labelOffset: group.labelOffset,
        bracketOffset: group.bracketOffset,
        groupMusicWidth,
        slurSegments,
      };
    });
  });

  return { groups, layouts, hasLabels, finalMeasures, notesByLine };
}

function visualBlocks(context: ScoreLayoutContext): ScoreVisualBlock[] {
  return context.groups.map((group, groupIndex) => {
    const items = context.layouts.filter((item) => item.groupIndex === groupIndex);
    const musicHeight = items.reduce((sum, item) => sum + item.layout.height + DIMENSIONS.lineSpacing, 0);
    const lyricHeight = group.lyrics.length > 0 ? DIMENSIONS.lyricTopPadding + group.lyrics.length * DIMENSIONS.lyricLineHeight : 0;
    return {
      items,
      groupIndex,
      index: groupIndex,
      height: musicHeight + lyricHeight,
      pageBreakBefore: group.lines.some((line) => line.pageBreakBefore === true),
    };
  });
}

export function analyzeScoreGeometry(document: Document, pageWidth: number, pageHeight?: number): ScoreGeometryWarning[] {
  const safePageWidth = Math.max(1, pageWidth);
  const context = layoutScore(document, safePageWidth);
  const blocks = visualBlocks(context);
  const warnings: ScoreGeometryWarning[] = [];

  for (const [groupIndex, group] of context.groups.entries()) {
    const items = context.layouts.filter((item) => item.groupIndex === groupIndex);
    const naturalWidth = Math.max(0, ...items.map((item) => item.groupMusicWidth));
    if (naturalWidth > safePageWidth) {
      warnings.push({
        kind: "overwide-score-group",
        range: group.lines[0]!.range,
        naturalWidth: Math.ceil(naturalWidth),
        pageWidth: safePageWidth,
        scaleX: safePageWidth / naturalWidth,
        multiTrack: group.lines.length > 1,
      });
    }
    for (const lyric of group.lyrics) {
      if (isAlignedLyric(group, lyric, context.hasLabels)) {
        continue;
      }
      const naturalLyricWidth = lyricNaturalWidth(group, lyric);
      if (naturalLyricWidth > safePageWidth) {
        warnings.push({
          kind: "overwide-lyric",
          range: lyric.range,
          naturalWidth: Math.ceil(naturalLyricWidth),
          pageWidth: safePageWidth,
          scaleX: safePageWidth / naturalLyricWidth,
        });
      }
    }
    const block = blocks[groupIndex];
    const usablePageHeight = pageHeight === undefined ? undefined : Math.max(1, pageHeight - PAGINATED_PAGE_CONTENT_TOP);
    if (block && usablePageHeight !== undefined && block.height > usablePageHeight) {
      warnings.push({
        kind: "overheight-group",
        range: group.lines[0]!.range,
        naturalHeight: Math.ceil(block.height),
        pageHeight: usablePageHeight,
      });
    }
  }

  return warnings;
}

export function analyzeScoreOverwidth(document: Document, pageWidth: number): OverwideScoreLayoutWarning[] {
  return analyzeScoreGeometry(document, pageWidth)
    .filter((warning): warning is Extract<ScoreGeometryWarning, { kind: "overwide-score-group" }> => warning.kind === "overwide-score-group")
    .map((warning) => ({
      kind: "overwide-line",
      range: warning.range,
      naturalWidth: warning.naturalWidth,
      pageWidth: warning.pageWidth,
      multiTrack: warning.multiTrack,
    }));
}

function renderScorePlacements(
  document: Document,
  context: ScoreLayoutContext,
  placements: ScoreRenderPlacement[],
  pageWidth: number,
  activeNoteIndices: number[],
  justifyMode: JustifyMode,
): string[] {
  const activeNoteIndexSet = new Set(activeNoteIndices);
  const pageParts = new Map<number, string[]>();
  const partsFor = (pageIndex = 0) => {
    const current = pageParts.get(pageIndex) ?? [];
    pageParts.set(pageIndex, current);
    return current;
  };

  for (const placement of placements) {
    const { block } = placement;
    const pageIndex = placement.pageIndex ?? 0;
    const parts = partsFor(pageIndex);
    const group = context.groups[block.groupIndex]!;
    const groupMusicWidth = Math.max(0, ...block.items.map((item) => item.groupMusicWidth));
    const musicScaleX = groupMusicWidth > pageWidth ? pageWidth / groupMusicWidth : 1;
    const musicScaled = musicScaleX < 1;
    const shouldJustify = shouldJustifyGroup(justifyMode, block.groupIndex, context.groups.length);
    const musicParts: string[] = [];
    const ordinaryLyricParts: string[] = [];
    let lineY = placement.y;
    let lyricAnchors: number[] = [];
    let bracketY1 = Number.POSITIVE_INFINITY;
    let bracketY2 = Number.NEGATIVE_INFINITY;

    for (const item of block.items) {
      const renderedLine = renderLine(
        item.layout,
        lineY,
        document,
        activeNoteIndexSet,
        shouldJustify && !musicScaled,
        musicScaled ? groupMusicWidth : pageWidth,
        item.labelOffset,
        item.bracketOffset,
        context.hasLabels ? "" : "T1",
        context.finalMeasures,
        context.notesByLine,
        item.slurSegments,
      );
      musicParts.push(renderedLine.svg);
      if (isPrimaryLyricLine(item.layout.line, context.hasLabels)) {
        lyricAnchors = renderedLine.lyricAnchors;
      }
      bracketY1 = Math.min(bracketY1, lineY + Math.max(0, item.layout.maxPaddingUp - DIMENSIONS.baseNoteHeight - 4));
      bracketY2 = Math.max(bracketY2, lineY + item.layout.height);
      lineY += item.layout.height + DIMENSIONS.lineSpacing;
    }

    if (group.bracketed && Number.isFinite(bracketY1) && Number.isFinite(bracketY2)) {
      const leftX = group.labelOffset + group.bracketOffset / 2;
      const rightX = shouldJustify && !musicScaled ? pageWidth - group.bracketOffset / 2 : groupMusicWidth - group.bracketOffset / 2;
      const yShift = -4;
      musicParts.push(renderVoiceBracket(leftX, bracketY1 + yShift, bracketY2 + yShift, "left"));
      musicParts.push(renderVoiceBracket(rightX, bracketY1 + yShift, bracketY2 + yShift, "right"));
    }

    const lyricStartY = lineY + (group.lyrics.length > 0 ? DIMENSIONS.lyricTopPadding : 0);
    const contentX = group.labelOffset + group.bracketOffset + DIMENSIONS.leftPadding;
    for (const [lyricIndex, lyric] of group.lyrics.entries()) {
      const lyricY = lyricStartY + lyricIndex * DIMENSIONS.lyricLineHeight;
      if (isAlignedLyric(group, lyric, context.hasLabels)) {
        musicParts.push(renderAlignedLyrics(document, [lyric], contentX, lyricY, undefined, lyricAnchors));
        continue;
      }
      const naturalWidth = lyricNaturalWidth(group, lyric);
      const lyricScaleX = naturalWidth > pageWidth ? pageWidth / naturalWidth : 1;
      const targetTextWidth = shouldJustify && lyricScaleX === 1 ? Math.max(0, pageWidth - contentX - group.bracketOffset) : undefined;
      const renderedLyric = renderLyrics(document, [lyric], contentX, lyricY, targetTextWidth);
      ordinaryLyricParts.push(
        lyricScaleX < 1
          ? `<g class="lyric-block scaled" transform="scale(${lyricScaleX},1)">${renderedLyric}</g>`
          : renderedLyric,
      );
    }

    const renderedMusic = musicParts.join("\n");
    parts.push(
      musicScaled
        ? `<g class="score-group scaled" transform="scale(${musicScaleX},1)">${renderedMusic}</g>`
        : renderedMusic,
    );
    parts.push(...ordinaryLyricParts);
  }

  const pageCount = Math.max(0, ...placements.map((placement) => placement.pageIndex ?? 0)) + 1;
  return Array.from({ length: pageCount }, (_, pageIndex) => pageParts.get(pageIndex)?.join("\n") ?? "");
}

function paginateBlocks(blocks: ScoreVisualBlock[], yStart: number, pageHeight: number): ScoreRenderPlacement[] {
  const placements: ScoreRenderPlacement[] = [];
  let pageIndex = 0;
  let y = Math.max(yStart, PAGINATED_PAGE_CONTENT_TOP);
  let pageHasScore = false;

  for (const block of blocks) {
    if (block.pageBreakBefore && (pageHasScore || (pageIndex === 0 && yStart > 0))) {
      pageIndex += 1;
      y = PAGINATED_PAGE_CONTENT_TOP;
      pageHasScore = false;
    }
    const pageTop = pageIndex === 0 ? Math.max(yStart, PAGINATED_PAGE_CONTENT_TOP) : PAGINATED_PAGE_CONTENT_TOP;
    const available = pageHeight - y;
    if (block.height > available && (pageHasScore || (pageIndex === 0 && yStart > 0))) {
      pageIndex += 1;
      y = PAGINATED_PAGE_CONTENT_TOP;
      pageHasScore = false;
    }
    placements.push({ block, y, pageIndex });
    y += block.height;
    pageHasScore = true;
    if (y <= pageTop && pageHasScore) {
      y = block.height;
    }
  }

  return placements;
}

export function renderScore(
  document: Document,
  yStart: number,
  pageWidth: number,
  activeNoteIndices: number[],
  justifyMode: JustifyMode,
  pagination?: { enabled: boolean; pageHeight: number },
): ScoreRenderResult {
  const context = layoutScore(document, pageWidth);
  const blocks = visualBlocks(context);
  const placements: ScoreRenderPlacement[] =
    pagination?.enabled === true
      ? paginateBlocks(blocks, yStart, pagination.pageHeight)
      : blocks.map((block) => ({
          block,
          y: yStart + blocks.slice(0, block.index).reduce((sum, previous) => sum + previous.height, 0),
        }));
  const pages = renderScorePlacements(document, context, placements, pageWidth, activeNoteIndices, justifyMode);
  const height =
    placements.length === 0
      ? 0
      : pagination?.enabled === true
        ? Math.max(...placements.map((placement) => (placement.pageIndex ?? 0) * pagination.pageHeight + placement.y + placement.block.height)) - yStart
        : Math.max(...placements.map((placement) => placement.y + placement.block.height)) - yStart;

  return {
    svg: pages.join("\n"),
    width: Math.min(pageWidth, Math.max(0, ...context.layouts.map((layout) => layout.groupMusicWidth))),
    height,
    pages: pagination?.enabled === true ? pages : undefined,
  };
}
