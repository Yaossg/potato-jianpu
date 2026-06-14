import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";
import {
  arrangementDuration,
  compileArrangement,
  compileMelody,
  exportMidiBytes,
  midiToFrequency,
  sampleWave,
  skipInitialArrangementRests,
  skipInitialRests,
  SYNTH_WAVEFORM,
  triangleWave,
  waveformForProgram,
} from "../dist/player/index.js";

test("compiles pitch notes to MIDI notes with key and octave", () => {
  const result = parse(`key: D\n=\n1 2 1'`);
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[62], [64], [74]],
  );
});

test("keeps accidentals for the current measure only", () => {
  const result = parse("#4 4 | 4");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[66], [66], [65]],
  );
});

test("merges tied notes into previous melody note", () => {
  const result = parse("1 ~1/ 2");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.equal(melody.notes.length, 2);
  assert.equal(melody.notes[0].duration, 3 / 8);
});

test("expands repeat barlines for melody playback", () => {
  const result = parse("|: 1 | 2 :| 3");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [62], [64]],
  );
});

test("expands implicit repeat starts from the line beginning", () => {
  const result = parse("1 | 2 :| 3");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [62], [64]],
  );
});

test("expands combined repeat end and start barlines for melody playback", () => {
  const result = parse("|: 1 :|: 2 :|");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [60], [62], [62]],
  );
});

test("plays repeated endings on the matching pass", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [64]],
  );
});

test("plays repeated endings beyond the second pass", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 :| [3] 4 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [64], [60], [65]],
  );
});

test("plays one repeated ending on multiple passes", () => {
  const result = parse("|: 1 | [1,2] 2 :| [3] 3 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [62], [60], [64]],
  );
});

test("plays non-contiguous passes in one repeated ending", () => {
  const result = parse("1111|[1,3]2222:|[2]3333:|[4]4444");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [64],
      [64],
      [64],
      [64],
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [65],
      [65],
      [65],
      [65],
    ],
  );
});

test("plays a multi-pass ending before an explicit final pass", () => {
  const result = parse("1111|[1,2]2222:|[3]3333");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [64],
      [64],
      [64],
      [64],
    ],
  );
});

test("plays repeated endings across source lines", () => {
  const result = parse("|: 1 | [1] 2\n3 :| [2] 4 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [64], [60], [65]],
  );
});

test("plays repeated endings in multiple repeat sections", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 | 4 |: 5 | [1] 6 :| [2] 7 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [64], [65], [67], [69], [67], [71]],
  );
});

test("plays adjacent repeated ending groups independently", () => {
  const result = parse("1111|[1]2222:|[2]3333\n1111|[1]4444:|[2]5555");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [64],
      [64],
      [64],
      [64],
      [60],
      [60],
      [60],
      [60],
      [65],
      [65],
      [65],
      [65],
      [60],
      [60],
      [60],
      [60],
      [67],
      [67],
      [67],
      [67],
    ],
  );
});

test("keeps unlabeled scores as one sequential arrangement track", () => {
  const result = parse("1 2\n3 4");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.equal(arrangement.tracks.length, 1);
  assert.equal(arrangement.tracks[0].name, "");
  assert.deepEqual(
    arrangement.tracks[0].notes.map((note) => note.chord),
    [[60], [62], [64], [65]],
  );
});

test("groups labeled score lines into simultaneous arrangement tracks", () => {
  const result = parse("T1: 1 2\nT2: 5, 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.name),
    ["T1", "T2"],
  );
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [62]],
      [[55], [57]],
    ],
  );
  assert.equal(arrangementDuration(arrangement), 1 / 2);
});

test("uses per-track header programs with global fallback", () => {
  const result = parse(`T2.program: "Violin"\nT3.program: "Flute"\n=\nT1: 1\nT2: 5,\nT3: 3`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value, 24);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.program]),
    [
      ["T1", 24],
      ["T2", 40],
      ["T3", 73],
    ],
  );
});

test("uses T1 program and name for a single unlabeled arrangement track", () => {
  const result = parse(`T1.name: "Melody"\nT1.program: "Violin"\n=\n1 2\n3 4`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value, 24);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.program]),
    [["T1", 40]],
  );
});

test("ignores unused per-track programs for unlabeled arrangements", () => {
  const result = parse(`T3.program: "Flute"\n=\n1 2 3`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value, 24);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.program]),
    [["", 24]],
  );
});

test("concatenates repeated labels and treats unlabeled lines as T1 in labeled scores", () => {
  const result = parse("T1: 1\nT2: 5,\n3\nT1: 2\nT2: 6,\n4");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.name),
    ["T1", "T2"],
  );
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [64], [62], [65]],
      [[55], "rest", [57]],
    ],
  );
});

test("schedules incomplete track groups sequentially instead of overlapping later voices", () => {
  const result = parse("T1: 1\nT1: 2\nT2: 5,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.name),
    ["T1", "T2"],
  );
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [62]],
      ["rest", [55]],
    ],
  );
});

test("expands repeats independently inside each arrangement track", () => {
  const result = parse("T1: |: 1 :| 2\nT2: |: 5, :| 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [60], [62]],
      [[55], [55], [57]],
    ],
  );
});

test("expands labeled repeats across later groups in the same track", () => {
  const result = parse("T1: |: 1\nT2: 5,\nT1: 2 :|\nT2: 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [62], [60], [62]],
      [[55], [57]],
    ],
  );
});

test("keeps later groups after earlier in-line repeats finish", () => {
  const result = parse("T1: |: 1 :|\nT2: 5,\nT1: 2\nT2: 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [60], [62]],
      [[55], "rest", [57]],
    ],
  );
});

test("omits shared initial arrangement rests only up to the first sounding track", () => {
  const result = parse("T1: 0 1\nT2: 0 0 5,");
  assert.equal(result.ok, true);
  const arrangement = skipInitialArrangementRests(compileArrangement(result.value));
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [[[60]], ["rest", [55]]],
  );
});

test("exports a standard MIDI header", () => {
  const result = parse(`tempo: 120\n=\n1 2 3 4`);
  assert.equal(result.ok, true);
  const bytes = exportMidiBytes(result.value);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "MThd");
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), "MTrk");
  assert.equal(bytes[8], 0);
  assert.equal(bytes[9], 1);
});

test("exports labeled arrangement tracks as separate MIDI tracks", () => {
  const result = parse("T1: 1\nT2: 5,\nT3: 3");
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  assert.equal(bytes[10] * 256 + bytes[11], 4);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc0 && bytes[index + 1] === 0), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc1 && bytes[index + 1] === 0), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc2 && bytes[index + 1] === 0), -1);
});

test("exports separate MIDI program changes for per-track programs", () => {
  const result = parse(`T1.program: 24\nT2.program: "Violin"\n=\nT1: 1\nT2: 5,`);
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value, 0)];
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc0 && bytes[index + 1] === 24), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc1 && bytes[index + 1] === 40), -1);
  assert.equal(bytes.findIndex((byte, index) => byte === 0xc1 && bytes[index + 1] === 0), -1);
});

test("reserves labeled MIDI channels before assigning unlabeled arrangement tracks", () => {
  const result = parse("T1: 5,\n1");
  assert.equal(result.ok, true);
  result.value.score[0].label = "T2";
  result.value.score[1].label = undefined;
  const bytes = [...exportMidiBytes(result.value)];
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc1 && bytes[index + 1] === 0), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc0 && bytes[index + 1] === 0), -1);
});

test("rejects MIDI exports with too many melodic arrangement tracks", () => {
  const result = parse("T1: 1\nT2: 1\nT3: 1\nT4: 1\nT5: 1\nT6: 1\nT7: 1\nT8: 1\nT9: 1\nT11: 1\nT12: 1\nT13: 1\nT14: 1\nT15: 1\nT16: 1");
  assert.equal(result.ok, true);
  result.value.score.push({ ...result.value.score[0], label: undefined });
  assert.throws(() => exportMidiBytes(result.value), /at most 15 melodic tracks/);
});

test("can omit initial rests from compiled melody and MIDI export", () => {
  const result = parse("0 0 1 2");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  const skipped = skipInitialRests(melody);
  assert.deepEqual(
    skipped.notes.map((note) => note.chord),
    [[60], [62]],
  );
  assert.ok(exportMidiBytes(result.value, 0, { omitInitialRests: true }).length < exportMidiBytes(result.value).length);
});

test("omitting initial rests preserves all-rest melodies as empty", () => {
  const result = parse("0 0");
  assert.equal(result.ok, true);
  assert.deepEqual(skipInitialRests(compileMelody(result.value)).notes, []);
});

test("exports tempo and time signature MIDI meta events", () => {
  const result = parse(`tempo: 120\ntime: 6/8\n=\n1/ 2/ 3/ 4/ 5/ 6/`);
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];

  const tempoIndex = bytes.findIndex((byte, index) => byte === 0xff && bytes[index + 1] === 0x51);
  assert.notEqual(tempoIndex, -1);
  assert.deepEqual(bytes.slice(tempoIndex, tempoIndex + 6), [0xff, 0x51, 0x03, 0x0f, 0x42, 0x40]);

  const timeSignatureIndex = bytes.findIndex((byte, index) => byte === 0xff && bytes[index + 1] === 0x58);
  assert.notEqual(timeSignatureIndex, -1);
  assert.deepEqual(bytes.slice(timeSignatureIndex, timeSignatureIndex + 7), [0xff, 0x58, 0x04, 0x06, 0x03, 0x24, 0x08]);
});

test("maps drum programs to percussion channel notes", () => {
  const result = parse("X X");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value, 128);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[35], [35]],
  );

  const bytes = [...exportMidiBytes(result.value, 128)];
  assert.equal(bytes.includes(0xc9), false);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0x99 && bytes[index + 1] === 35), -1);
});

test("rejects out-of-range programs in player APIs", () => {
  const result = parse("X");
  assert.equal(result.ok, true);
  assert.throws(() => compileMelody(result.value, 221), /Program must be an integer from 0 to 220/);
  assert.throws(() => exportMidiBytes(result.value, -1), /Program must be an integer from 0 to 220/);
});

test("exposes lightweight WAV synth constants", () => {
  assert.equal(SYNTH_WAVEFORM, "triangle");
  assert.equal(midiToFrequency(69), 440);
  assert.equal(triangleWave(0), 0);
  assert.ok(triangleWave(Math.PI / 2) > 0.99);
  assert.ok(triangleWave((3 * Math.PI) / 2) < -0.99);
});

test("maps programs to deterministic synth waveforms", () => {
  assert.equal(waveformForProgram(0), "triangle");
  assert.equal(waveformForProgram(24), "sawtooth");
  assert.equal(waveformForProgram(56), "sawtooth");
  assert.equal(waveformForProgram(80), "square");
  assert.equal(waveformForProgram(104), "sine");
  assert.equal(waveformForProgram(128), "square");
  assert.equal(sampleWave(Math.PI / 2, "sine"), 1);
  assert.equal(sampleWave(Math.PI / 2, "square"), 1);
});
