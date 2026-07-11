import type { Note, Pitch } from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";

function hasAccidental(pitch: Pitch): boolean {
  return pitch.accidental !== undefined;
}

function accidentalOffset(pitch: Pitch): number {
  return hasAccidental(pitch) ? DIMENSIONS.accidentalOffset : 0;
}

export function maxAccidentalOffset(chord: Pitch[] | undefined): number {
  if (!chord || chord.length === 0) {
    return 0;
  }
  return Math.max(...chord.map(accidentalOffset));
}

export function widthOf(note: Note): number {
  let width = DIMENSIONS.baseNoteWidth;
  width += ornamentLeftWidthOf(note) + ornamentRightWidthOf(note);
  width += note.duration.dashes * DIMENSIONS.dashSpacing;
  width += note.duration.dots * DIMENSIONS.dotSpacing;
  width += note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0;
  return width;
}

function graceWidth(pitches: Pitch[]): number {
  return DIMENSIONS.graceNoteGap + pitches.length * DIMENSIONS.graceNoteAdvance;
}

export function ornamentLeftWidthOf(note: Note): number {
  return note.kind === "pitch" && note.ornament?.kind === "grace" && note.ornament.placement === "before"
    ? graceWidth(note.ornament.pitches)
    : 0;
}

export function ornamentRightWidthOf(note: Note): number {
  if (note.kind !== "pitch" || note.ornament === undefined) {
    return 0;
  }
  if (note.ornament.kind === "grace") {
    return note.ornament.placement === "after" ? graceWidth(note.ornament.pitches) : 0;
  }
  if (note.ornament.kind === "slide") {
    return DIMENSIONS.slideRightWidth;
  }
  return 0;
}

export function chordHeight(note: Note): number {
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

export function noteTieAfter(note: Note, allNotes: Note[]): boolean {
  return Boolean(allNotes[note.index + 1]?.tie);
}
