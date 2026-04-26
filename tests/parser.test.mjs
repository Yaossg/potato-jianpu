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

test("validates tied note targets", () => {
  const samePitch = parse("#4 ~4 5 | X ~X");
  assert.equal(samePitch.ok, true);

  const differentPitch = parse("1 ~2");
  assert.equal(differentPitch.ok, false);
  assert.match(differentPitch.diagnostics.map((d) => d.message).join("\n"), /Tied note must match/);

  const afterRest = parse("1 0 ~1");
  assert.equal(afterRest.ok, false);
  assert.match(afterRest.diagnostics.map((d) => d.message).join("\n"), /Tied note must follow/);
});

test("warns when measure duration does not match the time signature", () => {
  const complete = parse(`time: "4/4"\n=\n1 2 3 4`);
  assert.equal(complete.ok, true);
  assert.equal(complete.diagnostics.some((diagnostic) => diagnostic.message.includes("Measure duration")), false);

  const short = parse(`time: "4/4"\n=\n1 2`);
  assert.equal(short.ok, true);
  assert.equal(short.diagnostics.some((diagnostic) => diagnostic.severity === "warning"), true);
  assert.match(short.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Measure duration 0.5 does not match/);

  const compound = parse(`time: "6/8"\n=\n1/ 2/ 3/ 4/ 5/ 6/`);
  assert.equal(compound.ok, true);
  assert.equal(compound.diagnostics.some((diagnostic) => diagnostic.message.includes("Measure duration")), false);
});

test("reports source ranges for parser diagnostics", () => {
  const result = parse("1 2\n@");
  assert.equal(result.ok, false);
  const diagnostic = result.diagnostics.find((item) => item.message.includes("Unexpected character"));
  assert.ok(diagnostic?.range);
  assert.equal(diagnostic.range.start.line, 2);
  assert.equal(diagnostic.range.start.column, 1);
  assert.equal(diagnostic.range.end.line, 2);
  assert.equal(diagnostic.range.end.column, 2);
});
