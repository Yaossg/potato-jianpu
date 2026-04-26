import type { Document, Measure, Note, Pitch } from "../core/index.js";

export interface MelodyNote {
  chord: number[] | "rest";
  duration: number;
  index: number;
}

export interface Melody {
  notes: MelodyNote[];
  tempo: number;
  beatsPerMeasure: number;
  beatsPerWholeNote: number;
}

const C_MAJOR_NOTE_MAP = [60, 62, 64, 65, 67, 69, 71] as const;
const MIN_PROGRAM = 0;
const MAX_PROGRAM = 220;

function assertProgram(program: number) {
  if (!Number.isInteger(program) || program < MIN_PROGRAM || program > MAX_PROGRAM) {
    throw new Error(`Program must be an integer from ${MIN_PROGRAM} to ${MAX_PROGRAM}.`);
  }
}

function pitchToMidi(pitch: Pitch, noteMap: number[]): number {
  return noteMap[pitch.note - 1]! + pitch.octave * 12;
}

function compileNote(note: Note, noteMap: number[], program: number): MelodyNote {
  switch (note.kind) {
    case "rest":
      return { chord: "rest", duration: note.duration.value, index: note.index };
    case "drum":
      return {
        chord: [program < 128 ? 60 : program - 128 + 35],
        duration: note.duration.value,
        index: note.index,
      };
    case "pitch":
      return {
        chord: note.chord.map((pitch) => pitchToMidi(pitch, noteMap)),
        duration: note.duration.value,
        index: note.index,
      };
  }
}

function compileMeasure(measure: Measure, baseNoteMap: number[], program: number, output: MelodyNote[]) {
  const noteMap = [...baseNoteMap];
  for (const note of measure.notes) {
    if (note.kind === "pitch") {
      for (const pitch of note.chord) {
        if (pitch.accidental !== undefined) {
          noteMap[pitch.note - 1] = baseNoteMap[pitch.note - 1]! + pitch.accidental;
        }
      }
    }

    const melodyNote = compileNote(note, noteMap, program);
    if (note.tie) {
      const previous = output.at(-1);
      if (previous) {
        previous.duration += melodyNote.duration;
      }
    } else {
      output.push(melodyNote);
    }
  }
}

export function compileMelody(document: Document, program = 0): Melody {
  assertProgram(program);
  const baseNoteMap = C_MAJOR_NOTE_MAP.map((note) => note + document.header.keySignature);
  const notes: MelodyNote[] = [];
  for (const line of document.score) {
    for (const measure of line.measures) {
      compileMeasure(measure, baseNoteMap, program, notes);
    }
  }

  return {
    notes,
    tempo: document.header.tempo,
    beatsPerMeasure: document.header.timeSignature.beatsPerMeasure,
    beatsPerWholeNote: document.header.timeSignature.beatsPerWholeNote,
  };
}

export function skipInitialRests(melody: Melody): Melody {
  const firstSoundingIndex = melody.notes.findIndex((note) => note.chord !== "rest");
  return {
    ...melody,
    notes: firstSoundingIndex < 0 ? [] : melody.notes.slice(firstSoundingIndex),
  };
}
