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
  width += note.duration.dashes * DIMENSIONS.dashSpacing;
  width += note.duration.dots * DIMENSIONS.dotSpacing;
  width += note.kind === "pitch" ? maxAccidentalOffset(note.chord) : 0;
  return width;
}

export function ornamentRightWidthOf(_note: Note): number {
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
