import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";
import { compileMelody, exportMidiBytes, midiToFrequency, SYNTH_WAVEFORM, triangleWave } from "../dist/player/index.js";

test("compiles pitch notes to MIDI notes with key and octave", () => {
  const result = parse(`key: "D"\n=\n1 2 1'`);
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

test("exports a standard MIDI header", () => {
  const result = parse(`tempo: "120"\n=\n1 2 3 4`);
  assert.equal(result.ok, true);
  const bytes = exportMidiBytes(result.value);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "MThd");
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), "MTrk");
  assert.equal(bytes[8], 0);
  assert.equal(bytes[9], 1);
});

test("exports tempo and time signature MIDI meta events", () => {
  const result = parse(`tempo: "120"\ntime: "6/8"\n=\n1/ 2/ 3/ 4/ 5/ 6/`);
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

test("exposes shared synth constants for playback and WAV export", () => {
  assert.equal(SYNTH_WAVEFORM, "triangle");
  assert.equal(midiToFrequency(69), 440);
  assert.equal(triangleWave(0), 0);
  assert.ok(triangleWave(Math.PI / 2) > 0.99);
  assert.ok(triangleWave((3 * Math.PI) / 2) < -0.99);
});
