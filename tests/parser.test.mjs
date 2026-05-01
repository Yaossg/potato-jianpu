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

test("parses empty files with default header values", () => {
  const result = parse("");
  assert.equal(result.ok, true);
  assert.equal(result.value.score.length, 0);
  assert.equal(result.value.header.keySignatureText, "C");
  assert.equal(result.value.header.tempo, 120);
});

test("accepts multiple header separator characters", () => {
  const result = parse(`title: "Separator"\n===\n1 2`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, "Separator");
  assert.equal(result.value.score[0].measures[0].notes.length, 2);
});

test("accepts optional leading and trailing bars", () => {
  const result = parse("| 1 2 | 3 4 |");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures.length, 2);
  assert.equal(result.value.score[0].measures[0].notes[0].index, 0);
  assert.equal(result.value.score[0].measures[1].notes[1].index, 3);
});

test("keeps comment boundaries between header and score lines", () => {
  const result = parse(`title: "Comments" ; header comment\n=\n1 2 ; score comment\n; whole-line comment\n3 4`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, "Comments");
  assert.equal(result.value.score.length, 2);
  assert.equal(result.value.score[0].measures[0].notes.length, 2);
  assert.equal(result.value.score[1].measures[0].notes.length, 2);
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

test("rejects empty chords and non-pitch chord members", () => {
  const empty = parse("{}");
  assert.equal(empty.ok, false);
  assert.match(empty.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected at least one pitch in chord/);

  const restMember = parse("{1 0 3}");
  assert.equal(restMember.ok, false);
  assert.match(restMember.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected pitch note inside chord/);
});

test("rejects unterminated chords with a specific diagnostic", () => {
  const result = parse("{1 3 5");
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Unterminated chord/);
  assert.doesNotMatch(messages, /Expected '\}' after chord/);
});

test("stops unterminated chords at the current line", () => {
  const result = parse("{1 3\n2 4");
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Unterminated chord; expected '\}' before end of line/);
  assert.doesNotMatch(messages, /Expected pitch note inside chord/);
});

test("rejects mixed dash and slash duration marks with a specific diagnostic", () => {
  const dashThenSlash = parse("1-/ 2");
  assert.equal(dashThenSlash.ok, false);
  assert.match(dashThenSlash.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Dash duration marks cannot be combined/);
  assert.doesNotMatch(dashThenSlash.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected note, rest, drum note, chord, or tie/);

  const slashThenDash = parse("1/- 2");
  assert.equal(slashThenDash.ok, false);
  assert.match(slashThenDash.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Dash duration marks cannot be combined/);
  assert.doesNotMatch(slashThenDash.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected note, rest, drum note, chord, or tie/);
});

test("reports invalid compact notation characters at their source position", () => {
  const result = parse("18");
  assert.equal(result.ok, false);
  const diagnostic = result.diagnostics.find((item) => item.message.includes("Unexpected character '8'"));
  assert.ok(diagnostic?.range);
  assert.equal(diagnostic.range.start.line, 1);
  assert.equal(diagnostic.range.start.column, 2);
  assert.equal(diagnostic.range.end.column, 3);
  assert.doesNotMatch(result.diagnostics.map((item) => item.message).join("\n"), /Expected note, rest, drum note, chord, or tie/);
});

test("reports specific diagnostics for stray compact duration and chord markers", () => {
  const duration = parse("/1");
  assert.equal(duration.ok, false);
  assert.match(duration.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Duration mark must follow/);
  assert.doesNotMatch(duration.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected note, rest, drum note, chord, or tie/);

  const chordEnd = parse("1}2");
  assert.equal(chordEnd.ok, false);
  assert.match(chordEnd.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unexpected '\}' without matching chord start/);
  assert.doesNotMatch(chordEnd.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected note, rest, drum note, chord, or tie/);
});


test("rejects invalid header values", () => {
  const result = parse(`tempo: "-1"\ntime: "5/4"\nkey: "H"\n=\n1234`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid tempo/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid time signature/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid key signature/);
});

test("accepts accidental-first key spellings", () => {
  const sharp = parse(`key: "#C"\n=\n1`);
  assert.equal(sharp.ok, true);
  assert.equal(sharp.value.header.keySignature, 1);
  assert.equal(sharp.value.header.keySignatureText, "#C");

  const flat = parse(`key: "bB"\n=\n1`);
  assert.equal(flat.ok, true);
  assert.equal(flat.value.header.keySignature, 10);
  assert.equal(flat.value.header.keySignatureText, "bB");
});

test("keeps raw header string escape text", () => {
  const result = parse(`title: "A \\"quoted\\" title"\n=\n1`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, `A \\"quoted\\" title`);
});

test("reports unterminated header strings", () => {
  const result = parse(`title: "unterminated\n=\n1 2`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Unterminated string literal/);
  assert.match(messages, /Expected quoted string header value/);
  const diagnostic = result.diagnostics.find((item) => item.message === "Unterminated string literal.");
  assert.ok(diagnostic?.range);
  assert.equal(diagnostic.range.start.line, 1);
  assert.equal(diagnostic.range.start.column, 8);
});

test("recovers malformed header lines without score-syntax cascades", () => {
  const result = parse("title: Missing Quotes\ncomposer: \"Ada\"\n=\n1 2 3 4");
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Expected quoted string header value/);
  assert.match(messages, /Expected newline after header property/);
  assert.doesNotMatch(messages, /Expected note, rest, drum note, chord, or tie/);
});

test("preserves unknown header fields in raw metadata", () => {
  const result = parse(`arranger: "Ada"\ntitle: "Raw Header"\n=\n1 2 3 4`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.raw.arranger, "Ada");
  assert.equal(result.value.header.title, "Raw Header");
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
