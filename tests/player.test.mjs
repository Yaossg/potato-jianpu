import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";
import { compileMelody, exportMidiBytes } from "../dist/player/index.js";

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

