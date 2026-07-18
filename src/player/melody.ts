import type { Document, Measure, Note, Pitch, ScoreLine } from "../core/index.js";
import { isPercussionTrackLabel } from "../parser/header.js";

export interface MelodyNote {
  chord: number[] | "rest";
  duration: number;
  index: number;
  velocity?: number;
  sustained?: number[];
  legatoToIndex?: number;
}

export interface MelodyPitchSpan {
  note: number;
  offset: number;
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
const TRILL_SEGMENT_DURATION = 1 / 32;
const FERMATA_DURATION_FACTOR = 1.5;
const SLUR_OVERLAP_RATIO = 0.05;

function assertProgram(program: number) {
  if (!Number.isInteger(program) || program < MIN_PROGRAM || program > MAX_PROGRAM) {
    throw new Error(`Program must be an integer from ${MIN_PROGRAM} to ${MAX_PROGRAM}.`);
  }
}

function pitchToMidi(pitch: Pitch, noteMap: number[]): number {
  return noteMap[pitch.note - 1]! + pitch.octave * 12;
}

function ornamentPitchToMidi(pitch: Pitch, noteMap: number[]): number {
  return noteMap[pitch.note - 1]! + (pitch.accidental ?? 0) + pitch.octave * 12;
}

function adjacentPitch(pitch: Pitch, direction: "upper" | "lower"): Pitch {
  if (direction === "upper") {
    return pitch.note === 7 ? { ...pitch, note: 1, octave: pitch.octave + 1, accidental: undefined } : { ...pitch, note: (pitch.note + 1) as Pitch["note"], accidental: undefined };
  }
  return pitch.note === 1 ? { ...pitch, note: 7, octave: pitch.octave - 1, accidental: undefined } : { ...pitch, note: (pitch.note - 1) as Pitch["note"], accidental: undefined };
}

function withSustainedTransitions(notes: MelodyNote[]): MelodyNote[] {
  return notes.map((note, index) => {
    if (index === 0 || note.chord === "rest") {
      return note;
    }
    const previous = notes[index - 1]?.chord;
    if (previous === undefined || previous === "rest") {
      return note;
    }
    const sustained = note.chord.filter((pitch) => previous.includes(pitch));
    return sustained.length > 0 ? { ...note, sustained } : note;
  });
}

function replaceChordPitch(chord: number[], index: number, pitch: number): number[] {
  return chord.map((member, memberIndex) => memberIndex === index ? pitch : member);
}

function compilePitchNoteEvents(note: Extract<Note, { kind: "pitch" }>, noteMap: number[], slideTarget?: number): MelodyNote[] {
  const velocity = note.velocity;
  const anchor = note.chord.map((pitch) => pitchToMidi(pitch, noteMap));
  const duration = note.duration.value * (note.ornament?.kind === "fermata" ? FERMATA_DURATION_FACTOR : 1);
  const base: MelodyNote = { chord: anchor, duration, index: note.index, velocity };
  if (!note.ornament) {
    return [base];
  }

  if (note.ornament.kind === "fermata") {
    return [base];
  }

  if (note.ornament.kind === "slide") {
    const start = anchor[0]!;
    const distance = slideTarget === undefined ? 0 : slideTarget - start;
    const stepCount = Math.abs(distance);
    if (stepCount === 0) {
      return [base];
    }
    const slideDuration = note.duration.value / 4;
    const sustain = note.duration.value - slideDuration;
    const direction = Math.sign(distance);
    return [
      { ...base, duration: sustain },
      ...Array.from({ length: stepCount }, (_, index) => ({
        chord: [start + direction * (index + 1)],
        duration: slideDuration / stepCount,
        index: note.index,
        velocity,
      })),
    ];
  }

  if (note.ornament.kind === "grace") {
    const ornamentDuration = note.duration.value / 4;
    const segment = ornamentDuration / note.ornament.pitches.length;
    const sustain = note.duration.value - ornamentDuration;
    const graceNotes = note.ornament.pitches.map((pitch) => ({
      chord: [ornamentPitchToMidi(pitch, noteMap)],
      duration: segment,
      index: note.index,
      velocity,
    }));
    return note.ornament.placement === "before"
      ? [...graceNotes, { ...base, duration: sustain }]
      : [{ ...base, duration: sustain }, ...graceNotes];
  }

  const mainPitchIndex = anchor.reduce(
    (highestIndex, pitch, index) => pitch > anchor[highestIndex]! ? index : highestIndex,
    0,
  );
  const mainPitch = note.chord[mainPitchIndex]!;
  if (note.ornament.kind === "trill") {
    const upper = pitchToMidi(adjacentPitch(mainPitch, "upper"), noteMap);
    const upperChord = replaceChordPitch(anchor, mainPitchIndex, upper);
    const pairCount = Math.max(1, Math.floor(note.duration.value / (TRILL_SEGMENT_DURATION * 2)));
    const segment = note.duration.value / (pairCount * 2);
    return withSustainedTransitions(Array.from({ length: pairCount * 2 }, (_, index) => ({
      chord: index % 2 === 0 ? anchor : upperChord,
      duration: segment,
      index: note.index,
      velocity,
    })));
  }

  if (note.ornament.kind === "turn") {
    const upper = pitchToMidi(adjacentPitch(mainPitch, "upper"), noteMap);
    const lower = pitchToMidi(adjacentPitch(mainPitch, "lower"), noteMap);
    const ornamentDuration = note.duration.value / 2;
    const segment = ornamentDuration / 4;
    const sustain = note.duration.value - ornamentDuration;
    const upperChord = replaceChordPitch(anchor, mainPitchIndex, upper);
    const lowerChord = replaceChordPitch(anchor, mainPitchIndex, lower);
    const turnChords = note.ornament.direction === "upper"
      ? [upperChord, anchor, lowerChord, anchor]
      : [lowerChord, anchor, upperChord, anchor];
    return withSustainedTransitions([
      ...turnChords.map((chord) => ({ chord, duration: segment, index: note.index, velocity })),
      { chord: anchor, duration: sustain, index: note.index, velocity },
    ]);
  }

  const auxiliary = pitchToMidi(adjacentPitch(mainPitch, note.ornament.direction), noteMap);
  const auxiliaryChord = replaceChordPitch(anchor, mainPitchIndex, auxiliary);
  const ornamentDuration = note.duration.value / 2;
  const segment = ornamentDuration / 3;
  const sustain = note.duration.value - ornamentDuration;
  return withSustainedTransitions([
    { chord: anchor, duration: segment, index: note.index, velocity },
    { chord: auxiliaryChord, duration: segment, index: note.index, velocity },
    { chord: anchor, duration: segment, index: note.index, velocity },
    { chord: anchor, duration: sustain, index: note.index, velocity },
  ]);
}

export function melodyPitchSpans(notes: MelodyNote[]): MelodyPitchSpan[] {
  const spans: MelodyPitchSpan[] = [];
  const active = new Map<number, MelodyPitchSpan>();
  let offset = 0;

  for (const [noteIndex, note] of notes.entries()) {
    const chord = note.chord === "rest" ? [] : [...new Set(note.chord)];
    const sustained = new Set(note.sustained ?? []);
    const nextActive = new Map<number, MelodyPitchSpan>();

    for (const pitch of chord) {
      const current = active.get(pitch);
      if (current && sustained.has(pitch)) {
        current.duration += note.duration;
        nextActive.set(pitch, current);
      } else {
        const span = { note: pitch, offset, duration: note.duration, index: note.index, velocity: note.velocity };
        spans.push(span);
        nextActive.set(pitch, span);
      }
    }

    const next = notes[noteIndex + 1];
    if (next && note.legatoToIndex === next.index && next.chord !== "rest") {
      const nextChord = new Set(next.chord);
      const overlap = Math.min(note.duration, next.duration) * SLUR_OVERLAP_RATIO;
      for (const [pitch, span] of nextActive) {
        if (!nextChord.has(pitch)) {
          span.duration += overlap;
        }
      }
    }

    active.clear();
    for (const [pitch, span] of nextActive) {
      active.set(pitch, span);
    }
    offset += note.duration;
  }

  return spans;
}

function compileNoteEvents(note: Note, noteMap: number[], program: number, slideTarget?: number): MelodyNote[] {
  const velocity = note.velocity;
  const duration = note.duration.value * (note.ornament?.kind === "fermata" ? FERMATA_DURATION_FACTOR : 1);
  switch (note.kind) {
    case "rest":
      return [{ chord: "rest", duration, index: note.index, velocity }];
    case "drum":
      return [{
        chord: [program < 128 ? 60 : program - 128 + 35],
        duration,
        index: note.index,
        velocity,
      }];
    case "pitch":
      return compilePitchNoteEvents(note, noteMap, slideTarget);
  }
}

interface PlaybackNoteContext {
  note: Note;
  noteMap: number[];
  slideTarget?: number;
}

interface SourceNoteEventGroup {
  note: Note;
  startIndex: number;
  endIndex: number;
}

function slurTransitions(document: Document): Map<number, number> {
  const transitions = new Map<number, number>();
  const notesByTrack = new Map<string, Note[]>();
  for (const line of document.score) {
    const track = line.label ?? "T1";
    notesByTrack.set(track, [...(notesByTrack.get(track) ?? []), ...line.measures.flatMap((measure) => measure.notes)]);
  }
  for (const slur of document.slurs) {
    const notes = (notesByTrack.get(slur.track) ?? []).filter(
      (note) => note.index >= slur.startNoteIndex && note.index <= slur.endNoteIndex,
    );
    for (let index = 0; index < notes.length - 1; index += 1) {
      const current = notes[index]!;
      const next = notes[index + 1]!;
      if (current.kind === "pitch" && next.kind === "pitch") {
        transitions.set(current.index, next.index);
      }
    }
  }
  return transitions;
}

function resolvePlaybackNotes(measures: Measure[], baseNoteMap: number[]): PlaybackNoteContext[] {
  const contexts: PlaybackNoteContext[] = [];
  for (const measure of measures) {
    const noteMap = [...baseNoteMap];
    for (const note of measure.notes) {
      if (note.kind === "pitch") {
        for (const pitch of note.chord) {
          if (pitch.accidental !== undefined) {
            noteMap[pitch.note - 1] = baseNoteMap[pitch.note - 1]! + pitch.accidental;
          }
        }
      }
      contexts.push({ note, noteMap: [...noteMap] });
    }
  }
  for (const [index, context] of contexts.entries()) {
    if (context.note.kind !== "pitch" || context.note.ornament?.kind !== "slide") {
      continue;
    }
    const target = contexts[index + 1];
    if (target?.note.kind === "pitch" && target.note.chord.length === 1) {
      context.slideTarget = pitchToMidi(target.note.chord[0]!, target.noteMap);
    }
  }
  return contexts;
}

function compileMeasure(
  measure: Measure,
  program: number,
  output: MelodyNote[],
  sourceGroups: SourceNoteEventGroup[],
  contexts: PlaybackNoteContext[],
  contextStart: number,
  transitions: Map<number, number>,
) {
  for (const [index, note] of measure.notes.entries()) {
    const context = contexts[contextStart + index]!;
    const melodyNotes = compileNoteEvents(note, context.noteMap, program, context.slideTarget);
    if (note.tie) {
      const previous = output.at(-1);
      if (previous) {
        previous.duration += melodyNotes.reduce((sum, melodyNote) => sum + melodyNote.duration, 0);
      }
    } else {
      const startIndex = output.length;
      output.push(...melodyNotes);
      sourceGroups.push({ note, startIndex, endIndex: output.length - 1 });
    }
    const legatoToIndex = transitions.get(note.index);
    const finalEvent = output.at(-1);
    if (legatoToIndex !== undefined && finalEvent) {
      finalEvent.legatoToIndex = legatoToIndex;
    }
  }
}

function clampVelocity(velocity: number): number {
  return Math.max(0, Math.min(127, Math.round(velocity)));
}

function setGroupVelocity(notes: MelodyNote[], group: SourceNoteEventGroup, velocity: number) {
  for (let index = group.startIndex; index <= group.endIndex; index += 1) {
    notes[index]!.velocity = velocity;
  }
}

function interpolateHairpin(
  notes: MelodyNote[],
  sourceGroups: SourceNoteEventGroup[],
  startGroupIndex: number,
  endGroupIndex: number,
  startVelocity: number,
  endVelocity: number,
) {
  const span = Math.max(1, endGroupIndex - startGroupIndex);
  for (let index = startGroupIndex; index <= endGroupIndex; index += 1) {
    const amount = (index - startGroupIndex) / span;
    const velocity = clampVelocity(startVelocity + (endVelocity - startVelocity) * amount);
    setGroupVelocity(notes, sourceGroups[index]!, velocity);
  }
}

function applyHairpinVelocities(notes: MelodyNote[], sourceGroups: SourceNoteEventGroup[]) {
  let lastExplicitVelocity = DEFAULT_VELOCITY;
  let active: { kind: NonNullable<Note["hairpinStart"]>; startGroupIndex: number; startVelocity: number } | null = null;

  for (const [groupIndex, group] of sourceGroups.entries()) {
    const note = group.note;
    const melodyNote = notes[group.startIndex]!;
    if (melodyNote.velocity !== undefined && active === null) {
      lastExplicitVelocity = melodyNote.velocity;
    }

    if (note.hairpinEnd !== undefined && active?.kind === note.hairpinEnd) {
      const fallbackEndVelocity =
        active.kind === "crescendo" ? active.startVelocity + HAIRPIN_DEFAULT_DELTA : active.startVelocity - HAIRPIN_DEFAULT_DELTA;
      const endVelocity = melodyNote.velocity ?? fallbackEndVelocity;
      interpolateHairpin(notes, sourceGroups, active.startGroupIndex, groupIndex, active.startVelocity, endVelocity);
      lastExplicitVelocity = clampVelocity(endVelocity);
      active = null;
    }

    if (note.hairpinStart !== undefined) {
      const startVelocity = melodyNote.velocity ?? lastExplicitVelocity;
      active = { kind: note.hairpinStart, startGroupIndex: groupIndex, startVelocity };
      setGroupVelocity(notes, group, startVelocity);
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

function hasNavigationAfter(measure: Measure, mark: NonNullable<Measure["navigationAfter"]>[number]): boolean {
  return measure.navigationAfter?.includes(mark) === true;
}

function hasNavigationBefore(measure: Measure, mark: NonNullable<Measure["navigationBefore"]>[number]): boolean {
  return measure.navigationBefore?.includes(mark) === true;
}

function navigationAfterIndex(measures: Measure[], marks: Array<NonNullable<Measure["navigationAfter"]>[number]>): number {
  return measures.findIndex((measure) => marks.some((mark) => hasNavigationAfter(measure, mark)));
}

function navigationBeforeIndex(measures: Measure[], mark: NonNullable<Measure["navigationBefore"]>[number]): number {
  return measures.findIndex((measure) => hasNavigationBefore(measure, mark));
}

function expandNavigationMeasures(measures: Measure[]): Measure[] {
  const jumpIndex = navigationAfterIndex(measures, ["dc", "ds"]);
  if (jumpIndex < 0) {
    return measures;
  }

  const jumpMeasure = measures[jumpIndex]!;
  const targetIndex = hasNavigationAfter(jumpMeasure, "ds") ? navigationBeforeIndex(measures, "segno") : 0;
  const codaIndex = navigationBeforeIndex(measures, "coda");
  const expanded: Measure[] = [];
  let jumped = false;
  let codaJumped = false;
  let index = 0;

  while (index < measures.length) {
    const measure = measures[index]!;
    expanded.push(measure);

    if (jumped && hasNavigationAfter(measure, "fine")) {
      break;
    }

    if (jumped && !codaJumped && hasNavigationAfter(measure, "toCoda") && codaIndex >= 0) {
      codaJumped = true;
      index = codaIndex;
      continue;
    }

    if (!jumped && index === jumpIndex && targetIndex >= 0) {
      jumped = true;
      index = targetIndex;
      continue;
    }

    index += 1;
  }

  return expanded;
}

function compileMeasures(document: Document, measures: Measure[], program: number, options: { navigation?: boolean } = {}): Melody {
  const baseNoteMap = C_MAJOR_NOTE_MAP.map((note) => note + document.header.keySignature);
  const notes: MelodyNote[] = [];
  const sourceGroups: SourceNoteEventGroup[] = [];
  const repeatedMeasures = expandRepeatedMeasures(measures);
  const playbackMeasures = options.navigation === false ? repeatedMeasures : expandNavigationMeasures(repeatedMeasures);
  const contexts = resolvePlaybackNotes(playbackMeasures, baseNoteMap);
  const transitions = slurTransitions(document);
  let contextStart = 0;
  for (const measure of playbackMeasures) {
    compileMeasure(measure, program, notes, sourceGroups, contexts, contextStart, transitions);
    contextStart += measure.notes.length;
  }
  applyHairpinVelocities(notes, sourceGroups);

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

function primaryLineInGroup(group: ScoreLine[]): ScoreLine | undefined {
  return group.find((line) => line.label === undefined || line.label === "T1") ?? group[0];
}

function groupHasNavigationAfter(group: ScoreLine[], mark: NonNullable<Measure["navigationAfter"]>[number]): boolean {
  return primaryLineInGroup(group)?.measures.some((measure) => hasNavigationAfter(measure, mark)) === true;
}

function groupHasNavigationBefore(group: ScoreLine[], mark: NonNullable<Measure["navigationBefore"]>[number]): boolean {
  return primaryLineInGroup(group)?.measures.some((measure) => hasNavigationBefore(measure, mark)) === true;
}

function navigationAfterGroupIndex(groups: ScoreLine[][], marks: Array<NonNullable<Measure["navigationAfter"]>[number]>): number {
  return groups.findIndex((group) => marks.some((mark) => groupHasNavigationAfter(group, mark)));
}

function navigationBeforeGroupIndex(groups: ScoreLine[][], mark: NonNullable<Measure["navigationBefore"]>[number]): number {
  return groups.findIndex((group) => groupHasNavigationBefore(group, mark));
}

function expandNavigationGroups(groups: ScoreLine[][]): ScoreLine[][] {
  const jumpIndex = navigationAfterGroupIndex(groups, ["dc", "ds"]);
  if (jumpIndex < 0) {
    return groups;
  }

  const targetIndex = groupHasNavigationAfter(groups[jumpIndex]!, "ds") ? navigationBeforeGroupIndex(groups, "segno") : 0;
  const codaIndex = navigationBeforeGroupIndex(groups, "coda");
  const expanded: ScoreLine[][] = [];
  let jumped = false;
  let codaJumped = false;
  let index = 0;

  while (index < groups.length) {
    const group = groups[index]!;
    expanded.push(group);

    if (jumped && groupHasNavigationAfter(group, "fine")) {
      break;
    }

    if (jumped && !codaJumped && groupHasNavigationAfter(group, "toCoda") && codaIndex >= 0) {
      codaJumped = true;
      index = codaIndex;
      continue;
    }

    if (!jumped && index === jumpIndex && targetIndex >= 0) {
      jumped = true;
      index = targetIndex;
      continue;
    }

    index += 1;
  }

  return expanded;
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
  for (const group of expandNavigationGroups(arrangementLineGroups(document.score))) {
    const lines = group.map((line) => ({
      name: line.label ?? "",
      measures: line.measures,
    }));
    const groupDuration = Math.max(
      0,
      ...lines.map((line) => noteDuration(compileMeasures(document, line.measures, programForTrack(document, line.name, defaultProgram), { navigation: false }).notes)),
    );
    for (const line of lines) {
      segments.push({ ...line, start: groupStart });
    }
    groupStart += groupDuration;
  }

  for (const segment of segments) {
    const measures = trackMeasures.get(segment.name) ?? [];
    const trackProgram = programForTrack(document, segment.name, defaultProgram);
    const gap = segment.start - noteDuration(compileMeasures(document, measures, trackProgram, { navigation: false }).notes);
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
      notes: compileMeasures(document, measures, programForTrack(document, name, defaultProgram), { navigation: false }).notes,
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
