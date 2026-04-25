import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";

test("parses a header and compact score", () => {
  const result = parse(`title: "Twinkle"\nkey: "D"\ntime: "4/4"\ntempo: "180"\n=\n1155|665-|\n`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, "Twinkle");
  assert.equal(result.value.header.keySignature, 2);
  assert.equal(result.value.header.tempo, 180);
  assert.equal(result.value.score.length, 1);
  assert.equal(result.value.score[0].measures.length, 2);
  assert.equal(result.value.score[0].measures[1].notes[2].duration.dashes, 1);
});

test("parses score-only documents", () => {
  const result = parse("1 2 3 4 | 5 6 7 1' |");
  assert.equal(result.ok, true);
  assert.equal(result.value.header.keySignatureText, "C");
  assert.equal(result.value.score[0].measures.length, 2);
});

test("applies measure octave prefixes to pitch notes", () => {
  const result = parse("'' 2' 1'/. 1'//~ 1' 6//");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.equal(notes[0].kind, "pitch");
  assert.equal(notes[0].chord[0].octave, 3);
  assert.equal(notes[1].duration.halves, 1);
  assert.equal(notes[1].duration.dots, 1);
});

test("parses chords, accidentals, rests, and drums", () => {
  const result = parse("{#1 3 b5}/ 0 X//");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.equal(notes[0].kind, "pitch");
  assert.equal(notes[0].chord.length, 3);
  assert.equal(notes[0].chord[0].accidental, 1);
  assert.equal(notes[0].chord[2].accidental, -1);
  assert.equal(notes[1].kind, "rest");
  assert.equal(notes[2].kind, "drum");
});

test("rejects invalid header values", () => {
  const result = parse(`tempo: "-1"\ntime: "5/4"\nkey: "H"\n=\n1234`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid tempo/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid time signature/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid key signature/);
});

test("rejects a tie on the first note", () => {
  const result = parse("~1 2 3 4");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /First note cannot be tied/);
});

