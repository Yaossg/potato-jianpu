import type { Document, Measure, Note, Pitch, ScoreLine } from "../core/index.js";
import { isPercussionTrackLabel } from "../parser/header.js";

export interface MelodyNote {
  chord: number[] | "rest";
  duration: number;
  index: number;
  velocity?: number;
}

export interface Melody {
  notes: MelodyNote[];
  tempo: number;
  beatsPerMeasure: number;
  beatsPerWholeNote: number;
}

export interface ArrangementTrack extends Melody {
  name: string;
  program: number;
  volume: number;
}

export interface Arrangement {
  tracks: ArrangementTrack[];
  tempo: number;
  beatsPerMeasure: number;
  beatsPerWholeNote: number;
}

const C_MAJOR_NOTE_MAP = [60, 62, 64, 65, 67, 69, 71] as const;
const MIN_PROGRAM = 0;
const MAX_PROGRAM = 174;
const DEFAULT_VELOCITY = 64;
const HAIRPIN_DEFAULT_DELTA = 24;

function assertProgram(program: number) {
  if (!Number.isInteger(program) || program < MIN_PROGRAM || program > MAX_PROGRAM) {
    throw new Error(`Program must be an integer from ${MIN_PROGRAM} to ${MAX_PROGRAM}.`);
  }
}

function pitchToMidi(pitch: Pitch, noteMap: number[]): number {
  return noteMap[pitch.note - 1]! + pitch.octave * 12;
}

function compileNote(note: Note, noteMap: number[], program: number): MelodyNote {
  const velocity = note.velocity;
  switch (note.kind) {
    case "rest":
      return { chord: "rest", duration: note.duration.value, index: note.index, velocity };
    case "drum":
      return {
        chord: [program < 128 ? 60 : program - 128 + 35],
        duration: note.duration.value,
        index: note.index,
        velocity,
      };
    case "pitch":
      return {
        chord: note.chord.map((pitch) => pitchToMidi(pitch, noteMap)),
        duration: note.duration.value,
        index: note.index,
        velocity,
      };
  }
}

function compileMeasure(measure: Measure, baseNoteMap: number[], program: number, output: MelodyNote[], sourceNotes: Note[]) {
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
      sourceNotes.push(note);
    }
  }
}

function clampVelocity(velocity: number): number {
  return Math.max(0, Math.min(127, Math.round(velocity)));
}

function interpolateHairpin(notes: MelodyNote[], startIndex: number, endIndex: number, startVelocity: number, endVelocity: number) {
  const span = Math.max(1, endIndex - startIndex);
  for (let index = startIndex; index <= endIndex; index += 1) {
    const amount = (index - startIndex) / span;
    notes[index]!.velocity = clampVelocity(startVelocity + (endVelocity - startVelocity) * amount);
  }
}

function applyHairpinVelocities(notes: MelodyNote[], sourceNotes: Note[]) {
  let lastExplicitVelocity = DEFAULT_VELOCITY;
  let active: { kind: NonNullable<Note["hairpinStart"]>; startIndex: number; startVelocity: number } | null = null;

  for (const [index, note] of sourceNotes.entries()) {
    const melodyNote = notes[index]!;
    if (melodyNote.velocity !== undefined && active === null) {
      lastExplicitVelocity = melodyNote.velocity;
    }

    if (note.hairpinEnd !== undefined && active?.kind === note.hairpinEnd) {
      const fallbackEndVelocity =
        active.kind === "crescendo" ? active.startVelocity + HAIRPIN_DEFAULT_DELTA : active.startVelocity - HAIRPIN_DEFAULT_DELTA;
      const endVelocity = melodyNote.velocity ?? fallbackEndVelocity;
      interpolateHairpin(notes, active.startIndex, index, active.startVelocity, endVelocity);
      lastExplicitVelocity = clampVelocity(endVelocity);
      active = null;
    }

    if (note.hairpinStart !== undefined) {
      const startVelocity = melodyNote.velocity ?? lastExplicitVelocity;
      active = { kind: note.hairpinStart, startIndex: index, startVelocity };
      melodyNote.velocity = startVelocity;
    } else if (melodyNote.velocity !== undefined && active === null) {
      lastExplicitVelocity = melodyNote.velocity;
    }
  }
}

function melodyBase(document: Document) {
  return {
    tempo: document.header.tempo,
    beatsPerMeasure: document.header.timeSignature.beatsPerMeasure,
    beatsPerWholeNote: document.header.timeSignature.beatsPerWholeNote,
  };
}

function expandRepeatedMeasures(measures: Measure[]): Measure[] {
  const expanded: Measure[] = [];

  function shouldPlayOnPass(measure: Measure, pass: number): boolean {
    return measure.ending === undefined || measure.ending.includes(pass);
  }

  function maxEnding(measure: Measure): number {
    return measure.ending === undefined ? 1 : Math.max(...measure.ending);
  }

  function clearRepeatFlags(measure: Measure): Measure {
    return { ...measure, repeatStart: false, repeatEnd: false };
  }

  let measureIndex = 0;
  while (measureIndex < measures.length) {
    const nextRepeatEndIndex = measures.findIndex((measure, index) => index >= measureIndex && measure.repeatEnd);
    const nextRepeatStartIndex = measures.findIndex((measure, index) => index >= measureIndex && measure.repeatStart);
    if (nextRepeatEndIndex < 0) {
      expanded.push(...measures.slice(measureIndex));
      break;
    }
    if (nextRepeatStartIndex > measureIndex && nextRepeatStartIndex < nextRepeatEndIndex) {
      expanded.push(...measures.slice(measureIndex, nextRepeatStartIndex));
      measureIndex = nextRepeatStartIndex;
      continue;
    }

    const repeatedMeasures = measures.slice(measureIndex, nextRepeatEndIndex + 1);
    let endingBlockEndIndex = nextRepeatEndIndex;
    while (measures[endingBlockEndIndex + 1]?.ending !== undefined) {
      endingBlockEndIndex += 1;
    }
    const endingBlockMeasures = measures.slice(nextRepeatEndIndex + 1, endingBlockEndIndex + 1);
    const maxEndingPass = Math.max(2, ...repeatedMeasures.map(maxEnding), ...endingBlockMeasures.map(maxEnding));
    for (let pass = 1; pass <= maxEndingPass; pass += 1) {
      const passMeasures = [
        ...repeatedMeasures.filter((repeatedMeasure) => shouldPlayOnPass(repeatedMeasure, pass)),
        ...endingBlockMeasures.filter((endingMeasure) => shouldPlayOnPass(endingMeasure, pass)),
      ];
      expanded.push(...(pass === 1 ? passMeasures : passMeasures.map(clearRepeatFlags)));
    }
    measureIndex = endingBlockEndIndex + 1;
  }

  return expanded;
}

function compileMeasures(document: Document, measures: Measure[], program: number): Melody {
  const baseNoteMap = C_MAJOR_NOTE_MAP.map((note) => note + document.header.keySignature);
  const notes: MelodyNote[] = [];
  const sourceNotes: Note[] = [];
  for (const measure of expandRepeatedMeasures(measures)) {
    compileMeasure(measure, baseNoteMap, program, notes, sourceNotes);
  }
  applyHairpinVelocities(notes, sourceNotes);

  return {
    notes,
    ...melodyBase(document),
  };
}

function programForTrack(document: Document, trackName: string, defaultProgram: number): number {
  const program = document.header.trackPrograms[trackName] ?? document.header.program ?? defaultProgram;
  if (isPercussionTrackLabel(trackName) && program < 128) {
    return 128;
  }
  return program;
}

function volumeForTrack(document: Document, trackName: string): number {
  return document.header.trackVolumes[trackName] ?? document.header.volume ?? 1;
}

function singleTrackName(document: Document): string {
  return document.header.trackNames.T1 !== undefined ? "T1" : "";
}

export function compileMelody(document: Document, program = 0): Melody {
  const defaultProgram = document.header.program ?? program;
  assertProgram(defaultProgram);
  return compileMeasures(
    document,
    document.score.flatMap((line) => line.measures),
    defaultProgram,
  );
}

function noteDuration(notes: MelodyNote[]): number {
  return notes.reduce((sum, note) => sum + note.duration, 0);
}

function restMeasure(duration: number, range: Measure["range"]): Measure {
  return {
    notes: [
      {
        kind: "rest",
        tie: false,
        duration: { dashes: 0, halves: 0, dots: 0, value: duration },
        index: -1,
        range,
      },
    ],
    range,
  };
}

function arrangementLineGroups(lines: ScoreLine[]): ScoreLine[][] {
  const groups: ScoreLine[][] = [];
  let current: ScoreLine[] = [];
  for (const line of lines) {
    if (line.label === "T1" && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
}

interface ArrangementSegment {
  name: string;
  measures: Measure[];
  start: number;
}

export function compileArrangement(document: Document, program = 0): Arrangement {
  const defaultProgram = document.header.program ?? program;
  assertProgram(defaultProgram);
  const base = melodyBase(document);
  const hasLabels = document.score.some((line) => line.label !== undefined);
  if (!hasLabels) {
    const name = singleTrackName(document);
    const trackProgram = programForTrack(document, "T1", defaultProgram);
    const trackVolume = volumeForTrack(document, "T1");
    return {
      tracks: [{ name, program: trackProgram, volume: trackVolume, ...compileMeasures(document, document.score.flatMap((line) => line.measures), trackProgram) }],
      ...base,
    };
  }

  const trackMeasures = new Map<string, Measure[]>();
  const segments: ArrangementSegment[] = [];
  let groupStart = 0;
  for (const group of arrangementLineGroups(document.score)) {
    const lines = group.map((line) => ({
      name: line.label ?? "",
      measures: line.measures,
    }));
    const groupDuration = Math.max(0, ...lines.map((line) => noteDuration(compileMeasures(document, line.measures, programForTrack(document, line.name, defaultProgram)).notes)));
    for (const line of lines) {
      segments.push({ ...line, start: groupStart });
    }
    groupStart += groupDuration;
  }

  for (const segment of segments) {
    const measures = trackMeasures.get(segment.name) ?? [];
    const trackProgram = programForTrack(document, segment.name, defaultProgram);
    const gap = segment.start - noteDuration(compileMeasures(document, measures, trackProgram).notes);
    const firstMeasure = segment.measures[0];
    if (gap > 1e-9 && firstMeasure) {
      measures.push(restMeasure(gap, firstMeasure.range));
    }
    measures.push(...segment.measures);
    trackMeasures.set(segment.name, measures);
  }

  return {
    tracks: [...trackMeasures].map(([name, measures]) => ({
      name,
      program: programForTrack(document, name, defaultProgram),
      volume: volumeForTrack(document, name),
      notes: compileMeasures(document, measures, programForTrack(document, name, defaultProgram)).notes,
      ...base,
    })),
    ...base,
  };
}

function leadingRestDuration(notes: MelodyNote[]): number | null {
  let duration = 0;
  for (const note of notes) {
    if (note.chord !== "rest") {
      return duration;
    }
    duration += note.duration;
  }
  return null;
}

function trimNotesAt(notes: MelodyNote[], offset: number): MelodyNote[] {
  if (offset <= 0) {
    return notes;
  }
  const trimmed: MelodyNote[] = [];
  let elapsed = 0;
  for (const note of notes) {
    const end = elapsed + note.duration;
    if (end <= offset) {
      elapsed = end;
      continue;
    }
    trimmed.push(elapsed < offset ? { ...note, duration: end - offset } : note);
    elapsed = end;
  }
  return trimmed;
}

export function arrangementDuration(arrangement: Arrangement): number {
  return Math.max(0, ...arrangement.tracks.map((track) => noteDuration(track.notes)));
}

export function arrangementNoteCount(arrangement: Arrangement): number {
  return arrangement.tracks.reduce((sum, track) => sum + track.notes.length, 0);
}

export function skipInitialArrangementRests(arrangement: Arrangement): Arrangement {
  const soundingOffsets = arrangement.tracks.map((track) => leadingRestDuration(track.notes)).filter((duration): duration is number => duration !== null);
  if (soundingOffsets.length === 0) {
    return {
      ...arrangement,
      tracks: arrangement.tracks.map((track) => ({ ...track, notes: [] })),
    };
  }
  const offset = Math.min(...soundingOffsets);
  return {
    ...arrangement,
    tracks: arrangement.tracks.map((track) => ({ ...track, notes: trimNotesAt(track.notes, offset) })),
  };
}

export function trimArrangementAtNote(arrangement: Arrangement, noteIndex: number): Arrangement {
  let startOffset: number | null = null;
  for (const track of arrangement.tracks) {
    let elapsed = 0;
    for (const note of track.notes) {
      if (note.index === noteIndex) {
        startOffset = elapsed;
        break;
      }
      elapsed += note.duration;
    }
    if (startOffset !== null) {
      break;
    }
  }
  if (startOffset === null || startOffset <= 0) {
    return arrangement;
  }
  return {
    ...arrangement,
    tracks: arrangement.tracks.map((track) => ({ ...track, notes: trimNotesAt(track.notes, startOffset) })),
  };
}

export function skipInitialRests(melody: Melody): Melody {
  const firstSoundingIndex = melody.notes.findIndex((note) => note.chord !== "rest");
  return {
    ...melody,
    notes: firstSoundingIndex < 0 ? [] : melody.notes.slice(firstSoundingIndex),
  };
}
