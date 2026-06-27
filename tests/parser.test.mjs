import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";

test("parses a header and unspaced score", () => {
  const result = parse(`title: "Twinkle"\nkey: D\ntime: 4/4\ntempo: 180\n=\n1155|665-|\n`);
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
  assert.equal(result.value.header.footer, "");
  assert.equal(result.value.header.numbering, false);
  assert.equal(result.value.header.paginate, false);
});

test("parses page rendering header fields", () => {
  const result = parse(`footer: "modern-jianpu"\nnumbering: true\npaginate: true\n=\n1 2`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.footer, "modern-jianpu");
  assert.equal(result.value.header.numbering, true);
  assert.equal(result.value.header.paginate, true);
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

test("parses repeat start and end barlines", () => {
  const result = parse("|: 1 2 | 3 4 :|");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures.length, 2);
  assert.equal(result.value.score[0].measures[0].repeatStart, true);
  assert.equal(result.value.score[0].measures[1].repeatEnd, true);
});

test("parses combined repeat end and start barlines", () => {
  const result = parse("|: 1 :|: 2 :|");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures.length, 2);
  assert.equal(result.value.score[0].measures[0].repeatEnd, true);
  assert.equal(result.value.score[0].measures[1].repeatStart, true);
});

test("parses repeated endings", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 |");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures.length, 3);
  assert.deepEqual(result.value.score[0].measures[1].ending, [1]);
  assert.deepEqual(result.value.score[0].measures[2].ending, [2]);
});

test("parses repeated endings with multiple passes in one ending", () => {
  const result = parse("|: 1 | [1,2] 2 :| [3] 3 |");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures.length, 3);
  assert.deepEqual(result.value.score[0].measures[1].ending, [1, 2]);
  assert.deepEqual(result.value.score[0].measures[2].ending, [3]);
});

test("parses non-contiguous passes in one repeated ending", () => {
  const result = parse("1111|[1,3]2222:|[2]3333:|[4]4444");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].measures[1].ending, [1, 3]);
  assert.deepEqual(result.value.score[0].measures[2].ending, [2]);
  assert.deepEqual(result.value.score[0].measures[3].ending, [4]);
});

test("rejects a repeated ending group without an explicit final pass", () => {
  const result = parse("1111|[1,2]2222:|");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Repeated endings need a final ending without ':|'/);
});

test("rejects repeated endings that rely on unmarked following measures as the final pass", () => {
  const result = parse("1111|[1]2222:|[2]3333:|4444");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Repeated endings need a final ending without ':|'/);
});

test("rejects multi-pass repeated endings without an explicit final ending", () => {
  const result = parse("1111|[1,2]2222:|3333");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Repeated endings need a final ending without ':|'/);
});

test("rejects repeated endings without any repeat end", () => {
  const result = parse("1111|[1,2]2222");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Repeated endings need at least one ending with ':|'/);
});

test("accepts repeated endings with an explicit final pass", () => {
  const result = parse("1111|[1]2222:|[2]3333:|[3]4444");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].measures[1].ending, [1]);
  assert.deepEqual(result.value.score[0].measures[2].ending, [2]);
  assert.deepEqual(result.value.score[0].measures[3].ending, [3]);
});

test("accepts multi-pass repeated endings with an explicit final pass", () => {
  const result = parse("1111|[1,2]2222:|[3]3333");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].measures[1].ending, [1, 2]);
  assert.deepEqual(result.value.score[0].measures[2].ending, [3]);
});

test("rejects a non-final ending that does not end with repeat end", () => {
  const result = parse("|: 1 | [1] 2 | [2] 3 |");
  assert.equal(result.ok, false);
  assert.match(
    result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Ending \[1\] should end with ':|' before ending \[2\]/,
  );
  assert.equal(result.diagnostics.find((diagnostic) => diagnostic.message.includes("Ending [1]"))?.severity, "error");
});

test("rejects a cross-line non-final ending that does not end with repeat end", () => {
  const result = parse("|: 1 | [1] 2\n3 | [2] 4 |");
  assert.equal(result.ok, false);
  assert.match(
    result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Ending \[1\] should end with ':|' before ending \[2\]/,
  );
});

test("rejects a repeated ending that has repeat end before its final measure", () => {
  const result = parse("|: 1 | [1] 2 :| 3 | [2] 4 |");
  assert.equal(result.ok, false);
  assert.match(
    result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Ending \[1\] has ':|' before its last measure; move ':|' to the end of the ending/,
  );
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.message.startsWith("Ending [1] should end with ':|'")), false);
  assert.equal(result.diagnostics.find((diagnostic) => diagnostic.message.includes("move ':|'"))?.severity, "error");
});

test("rejects a single repeated ending", () => {
  const result = parse("|: 1 | [1] 2 :|");
  assert.equal(result.ok, false);
  assert.match(
    result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Repeated endings need at least \[1\] and \[2\]/,
  );
  assert.equal(result.diagnostics.find((diagnostic) => diagnostic.message.includes("at least [1] and [2]"))?.severity, "error");
});

test("rejects skipped repeated ending numbers", () => {
  const result = parse("|: 1 | [1] 2 :| [3] 3 |");
  assert.equal(result.ok, false);
  assert.match(
    result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Ending \[2\] is missing before ending \[3\]/,
  );
  assert.equal(result.diagnostics.find((diagnostic) => diagnostic.message.includes("missing before"))?.severity, "error");
});

test("rejects repeated ending numbers that are out of order", () => {
  const result = parse("|: 1 | [2] 2 :| [1] 3 |");
  assert.equal(result.ok, false);
  assert.match(
    result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Ending \[2\] is out of order; write ending \[1\] before it/,
  );
  assert.equal(result.diagnostics.find((diagnostic) => diagnostic.message.includes("out of order"))?.severity, "error");
});

test("rejects repeated ending numbers that restart after later endings", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 :| [1] 4 |");
  assert.equal(result.ok, false);
  assert.match(
    result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Ending \[1\] appears more than once/,
  );
  assert.equal(result.diagnostics.find((diagnostic) => diagnostic.message.includes("appears more than once"))?.severity, "error");
});

test("rejects repeated ending numbers repeated inside one marker", () => {
  const first = parse("|: 1 | [1,1] 2 :| [2] 3 |");
  assert.equal(first.ok, false);
  assert.match(first.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Ending \[1\] appears more than once/);

  const second = parse("|: 1 | [1] 2 :| [2,2] 3 |");
  assert.equal(second.ok, false);
  assert.match(second.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Ending \[2\] appears more than once/);
});

test("keeps only the first measure in an explicit final ending", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 | 4 |");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].measures[2].ending, [2]);
  assert.equal(result.value.score[0].measures[3].ending, undefined);
  assert.doesNotMatch(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Ending \[2\]/);
});

test("validates repeated endings independently for multiple repeat sections", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 | 4 |: 5 | [1] 6 :| [2] 7 |");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].measures[2].ending, [2]);
  assert.equal(result.value.score[0].measures[3].ending, undefined);
  assert.equal(result.value.score[0].measures[4].ending, undefined);
  assert.deepEqual(result.value.score[0].measures[5].ending, [1]);
  assert.deepEqual(result.value.score[0].measures[6].ending, [2]);
  assert.doesNotMatch(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /appears more than once|out of order|should end with/);
});

test("validates adjacent repeated ending groups independently", () => {
  const result = parse("1111|[1]2222:|[2]3333\n1111|[1]4444:|[2]5555");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].measures[1].ending, [1]);
  assert.deepEqual(result.value.score[0].measures[2].ending, [2]);
  assert.deepEqual(result.value.score[1].measures[1].ending, [1]);
  assert.deepEqual(result.value.score[1].measures[2].ending, [2]);
});

test("validates repeated endings independently for labeled tracks", () => {
  const result = parse("T1: |: 1 | [1] 2 :| [2] 3 |\nT2: |: 5, | [1] 6, :| [2] 7, |");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].measures[2].ending, [2]);
  assert.deepEqual(result.value.score[1].measures[2].ending, [2]);
  assert.doesNotMatch(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /appears more than once|out of order|should end with/);
});

test("warns and ignores empty measures between consecutive bars", () => {
  const result = parse("1 2 || 3 4");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures.length, 2);
  assert.equal(result.value.score[0].measures[0].notes.length, 2);
  assert.equal(result.value.score[0].measures[1].notes.length, 2);
  const diagnostic = result.diagnostics.find((item) => item.message === "Empty measure ignored.");
  assert.equal(diagnostic?.severity, "warning");
});

test("keeps comment boundaries between header and score lines", () => {
  const result = parse(`title: "Comments" ; header comment\n=\n1 2 ; score comment\n; whole-line comment\n3 4`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, "Comments");
  assert.equal(result.value.score.length, 2);
  assert.equal(result.value.score[0].measures[0].notes.length, 2);
  assert.equal(result.value.score[1].measures[0].notes.length, 2);
});

test("parses manual page breaks before score lines", () => {
  const result = parse("1 2\n---\n3 4");
  assert.equal(result.ok, true);
  assert.equal(result.value.score.length, 2);
  assert.equal(result.value.score[0].pageBreakBefore, undefined);
  assert.equal(result.value.score[1].pageBreakBefore, true);
});

test("rejects manual page breaks before lyrics", () => {
  const result = parse('1 2\n---\n"hello"');
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Page breaks must appear before a score line/);
});

test("rejects manual page breaks inside labeled voice groups", () => {
  const result = parse("T1: 1 2\n---\nT2: 5, 6,");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Page breaks in labeled scores must appear before T1/);
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

test("parses adjacent drum notes independently", () => {
  const result = parse("XX X1");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.deepEqual(
    notes.map((note) => note.kind),
    ["drum", "drum", "drum", "pitch"],
  );
});

test("renders empty chords as rests and rejects non-pitch chord members", () => {
  const empty = parse("{}");
  assert.equal(empty.ok, true);
  assert.equal(empty.value.score[0].measures[0].notes[0].kind, "rest");
  const diagnostic = empty.diagnostics.find((item) => item.message === "Empty chord rendered as a rest.");
  assert.equal(diagnostic?.severity, "warning");

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

test("reports invalid score characters at their source position", () => {
  const result = parse("1@");
  assert.equal(result.ok, false);
  const diagnostic = result.diagnostics.find((item) => item.message.includes("Unexpected character '@'"));
  assert.ok(diagnostic?.range);
  assert.equal(diagnostic.range.start.line, 1);
  assert.equal(diagnostic.range.start.column, 2);
  assert.equal(diagnostic.range.end.column, 3);
  assert.doesNotMatch(result.diagnostics.map((item) => item.message).join("\n"), /Expected note, rest, drum note, chord, or tie/);
});

test("reports specific diagnostics for stray duration and chord markers", () => {
  const duration = parse("/1");
  assert.equal(duration.ok, false);
  assert.match(duration.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Duration mark must follow/);
  assert.doesNotMatch(duration.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected note, rest, drum note, chord, or tie/);

  const chordEnd = parse("1}2");
  assert.equal(chordEnd.ok, false);
  assert.match(chordEnd.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unexpected '\}' without matching chord start/);
  assert.doesNotMatch(chordEnd.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected note, rest, drum note, chord, or tie/);
});


test("rejects invalid typed header values", () => {
  const result = parse(`tempo: -1\ntime: 5/4\nkey: H\nhidden: yes\npaginate: yes\n=\n1234`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid tempo/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid time signature/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Unknown key signature/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Expected boolean value for hidden/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Expected boolean value for paginate/);

  const tempo = result.diagnostics.find((diagnostic) => diagnostic.message.includes("Invalid tempo"));
  assert.ok(tempo?.range);
  assert.equal(tempo.range.start.line, 1);
  assert.equal(tempo.range.start.column, 8);
  assert.equal(tempo.range.end.column, 10);

  const time = result.diagnostics.find((diagnostic) => diagnostic.message.includes("Invalid time signature"));
  assert.ok(time?.range);
  assert.equal(time.range.start.line, 2);
  assert.equal(time.range.start.column, 7);
  assert.equal(time.range.end.column, 10);

  const key = result.diagnostics.find((diagnostic) => diagnostic.message.includes("Unknown key signature"));
  assert.ok(key?.range);
  assert.equal(key.range.start.line, 3);
  assert.equal(key.range.start.column, 6);
  assert.equal(key.range.end.column, 7);
});

test("accepts accidental-first key spellings", () => {
  const sharp = parse(`key: #C\n=\n1`);
  assert.equal(sharp.ok, true);
  assert.equal(sharp.value.header.keySignature, 1);
  assert.equal(sharp.value.header.keySignatureText, "#C");

  const flat = parse(`key: bB\n=\n1`);
  assert.equal(flat.ok, true);
  assert.equal(flat.value.header.keySignature, 10);
  assert.equal(flat.value.header.keySignatureText, "bB");
});

test("rejects old string syntax for typed header values", () => {
  const result = parse(`tempo: "120"\ntime: "4/4"\nkey: "D"\nhidden: "yes"\npaginate: "true"\n=\n1 2`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Expected numeric tempo value/);
  assert.match(messages, /Expected time signature value/);
  assert.match(messages, /Expected key signature value/);
  assert.match(messages, /Expected boolean value for hidden/);
  assert.match(messages, /Expected boolean value for paginate/);
});

test("rejects unknown and case-mismatched header keys", () => {
  const result = parse(`arranger2_name: "Ada"\nTempo: 120\nT1.Name: "Melody"\n=\n1 2`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Unknown header key 'arranger2_name'/);
  assert.match(messages, /Unknown header key 'Tempo'/);
  assert.match(messages, /Unknown header key 'T1.Name'/);
});

test("rejects duplicate header properties", () => {
  const result = parse(`tempo: 120\ntempo: 96\nT1.name: "Melody"\nT1: "Other"\nL1.name: "Verse"\nL1: "Other"\n=\n1 2`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Duplicate header property 'tempo'/);
  assert.match(messages, /Duplicate track name definition for 'T1'/);
  assert.match(messages, /Duplicate lyric label definition for 'L1'/);
});

test("keeps quoted header string escape text", () => {
  const result = parse(`title: "A \\"quoted\\" title"\n=\n1`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, `A \\"quoted\\" title`);
});

test("reports unterminated header strings", () => {
  const result = parse(`title: "unterminated\n=\n1 2`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Unterminated string literal/);
  assert.match(messages, /Expected header value/);
  const diagnostic = result.diagnostics.find((item) => item.message === "Unterminated string literal.");
  assert.ok(diagnostic?.range);
  assert.equal(diagnostic.range.start.line, 1);
  assert.equal(diagnostic.range.start.column, 8);
});

test("recovers malformed header lines without score-syntax cascades", () => {
  const result = parse("title: Missing Quotes\ncomposer: \"Ada\"\n=\n1 2 3 4");
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Expected quoted string value for title/);
  assert.doesNotMatch(messages, /Expected note, rest, drum note, chord, or tie/);
});

test("rejects unknown header fields", () => {
  const result = parse(`arranger2_name: "Ada"\ntitle: "Raw Header"\n=\n1 2 3 4`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unknown header key 'arranger2_name'/);
});

test("requires identifiers to start with a letter", () => {
  const result = parse(`_arranger: "Ada"\n=\n1 2 3 4`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unexpected character '_'/);
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

test("validates ties independently for labeled tracks", () => {
  const result = parse("T1: 1\nT2: ~1");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /First note cannot be tied/);

  const sameTrack = parse("T1: 1\nT2: 5,\nT1: ~1\nT2: 6,");
  assert.equal(sameTrack.ok, true);
});

test("rejects score line labels outside the supported MIDI track label range", () => {
  const result = parse("melody: 1 2");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Score line labels must be T1-T9, T11-T16, or P followed by digits/);

  const reservedChannel = parse("T10: 1 2");
  assert.equal(reservedChannel.ok, false);
  assert.match(reservedChannel.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Score line labels must be T1-T9, T11-T16, or P followed by digits/);
});

test("accepts T-prefixed header and score line labels", () => {
  const result = parse(`T1: "Drums"\n=\nT1: X X`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.trackNames.T1, "Drums");
  assert.equal(result.value.score[0].label, "T1");
  assert.equal(result.value.score[0].measures[0].notes[0].kind, "drum");

  const highTrack = parse("T1: 1\nT2: 1\nT3: 1\nT4: 1\nT5: 1\nT6: 1\nT7: 1\nT8: 1\nT9: 1\nT11: 1");
  assert.equal(highTrack.ok, true);
  assert.equal(highTrack.value.score.at(-1).label, "T11");

  const digitHeader = parse(`T1_name: "Drums"\n=\nT1: X1 X2`);
  assert.equal(digitHeader.ok, false);
  assert.match(digitHeader.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unknown header key 'T1_name'/);

  const xHeader = parse(`X_name: "Drums"\n=\nXX`);
  assert.equal(xHeader.ok, false);
  assert.match(xHeader.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unknown header key 'X_name'/);
});

test("parses per-track header programs", () => {
  const result = parse(`T1.program: 40\nT2.program: "Violin"\nT3.program: " flute "\n=\nT1: 1\nT2: 2\nT3: 3`);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.header.trackPrograms, {
    T1: 40,
    T2: 40,
    T3: 73,
  });
});

test("rejects invalid per-track header programs", () => {
  const result = parse(`T1.program: "40"\nT2.program: "Not A Program"\nT3.program: -1\nT4.program: 128\nT5.program: piano\nT1.program: 41\nT10.program: 40\n=\nT1: 1`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Unknown Program name '40'/);
  assert.match(messages, /Unknown Program name 'Not A Program'/);
  assert.match(messages, /Expected Program number 0-127 or quoted Program name/);
  assert.match(messages, /Invalid Program '128'. Expected 0-127/);
  assert.match(messages, /Expected Program number 0-127 or quoted Program name/);
  assert.match(messages, /Duplicate track program definition for 'T1'/);
  assert.match(messages, /Unknown header key 'T10.program'/);
});

test("parses default header program and volume", () => {
  const result = parse(`program: 128\nvolume: 72.5%\n=\nX 1`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.program, 128);
  assert.equal(result.value.header.volume, 0.725);
});

test("parses default header program names", () => {
  const result = parse(`program: "Violin"\n=\n1`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.program, 40);
});

test("rejects invalid default header program and volume", () => {
  const result = parse(`program: -1\nprogram: 0\nvolume: 201%\n=\n1`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Expected Program number 0-174 or quoted Program name/);
  assert.match(messages, /Duplicate header property 'program'/);
  assert.match(messages, /Invalid volume '201%'. Expected 0-2 or 0%-200%/);
});

test("parses per-track header volumes", () => {
  const result = parse(`T1.volume: 0\nT2.volume: 72.5%\nT3.volume: 2\n=\nT1: 1\nT2: 2\nT3: 3`);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.header.trackVolumes, {
    T1: 0,
    T2: 0.725,
    T3: 2,
  });
});

test("rejects invalid per-track header volumes", () => {
  const result = parse(`T1.volume: "1"\nT2.volume: -0.1\nT3.volume: 2.1\nT4.volume: loud\nT5.volume: 201%\nT1.volume: 1\nT10.volume: 1\n=\nT1: 1`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Expected track volume number 0-2 or percentage 0%-200%/);
  assert.match(messages, /Invalid track volume '-0.1'. Expected 0-2 or 0%-200%/);
  assert.match(messages, /Invalid track volume '2.1'. Expected 0-2 or 0%-200%/);
  assert.match(messages, /Invalid track volume 'loud'. Expected 0-2 or 0%-200%/);
  assert.match(messages, /Invalid track volume '201%'. Expected 0-2 or 0%-200%/);
  assert.match(messages, /Duplicate track volume definition for 'T1'/);
  assert.match(messages, /Unknown header key 'T10.volume'/);
});

test("treats unlabeled score lines as T1 when any score line has a track label", () => {
  const result = parse("1 2\nT2: 5, 6,\n3 4");
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.score.map((line) => line.label),
    ["T1", "T2", "T1"],
  );
});

test("parses lyric lines after score groups", () => {
  const result = parse('T1: 1 2\nT2: 5, 6,\nL1: "hello world"\n"fallback lyric"\nT1: 3 4');
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.score[1].lyrics?.map((lyric) => [lyric.label, lyric.text]),
    [
      ["L1", "hello world"],
      ["L1", "fallback lyric"],
    ],
  );
  assert.deepEqual(result.value.score[1].lyrics?.[0]?.syllables, ["hello", "world"]);
  assert.equal(result.value.score[2].lyrics, undefined);
});

test("warns when aligned lyric syllables do not match main voice notes", () => {
  const result = parse('1 2 3 4\n"one two"');
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.message),
    ["Lyric has 2 syllables but the main voice has 4 notes."],
  );
});

test("rejects lyric lines before any score line", () => {
  const result = parse('"too early"\n1 2');
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Lyrics must follow a score line/);
});

test("requires track label groups to start at T1 and increase", () => {
  const valid = parse("T1: 1\nT2: 5,\nT3: 1,\nT1: 2\nT2: 6,");
  assert.equal(valid.ok, true);

  const swapped = parse("T1: 1\nT2: 5,\nT2: 6,\nT1: 2");
  assert.equal(swapped.ok, false);
  assert.match(swapped.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Track labels must start at T1 and increase within each group/);

  const lateVoice = parse("T1: 1\nT1: 2\nT2: 5,");
  assert.equal(lateVoice.ok, true);

  const duplicateAtEnd = parse("T1: 1\nT2: 5,\nT2: 6,");
  assert.equal(duplicateAtEnd.ok, false);
  assert.match(duplicateAtEnd.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Track labels must start at T1 and increase within each group/);

  const skipped = parse("T1: 1\nT3: 5,");
  assert.equal(skipped.ok, false);
  assert.match(skipped.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected T2 or T1/);

  const missingStart = parse("T2: 1");
  assert.equal(missingStart.ok, false);
  assert.match(missingStart.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected T1/);
});

test("warns when measure duration does not match the time signature", () => {
  const complete = parse(`time: 4/4\n=\n1 2 3 4`);
  assert.equal(complete.ok, true);
  assert.equal(complete.diagnostics.some((diagnostic) => diagnostic.message.includes("Measure duration")), false);

  const short = parse(`time: 4/4\n=\n1 2`);
  assert.equal(short.ok, true);
  assert.equal(short.diagnostics.some((diagnostic) => diagnostic.severity === "warning"), true);
  assert.match(short.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Measure duration 0.5 does not match/);

  const compound = parse(`time: 6/8\n=\n1/ 2/ 3/ 4/ 5/ 6/`);
  assert.equal(compound.ok, true);
  assert.equal(compound.diagnostics.some((diagnostic) => diagnostic.message.includes("Measure duration")), false);
});

test("parses per-note velocity markers before pitch notes", () => {
  const result = parse("f 1");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures[0].notes[0].kind, "pitch");
  assert.equal(result.value.score[0].measures[0].notes[0].velocity, 85);
});

test("parses all velocity markers as correct MIDI values", () => {
  const result = parse("ppp 1 pp 2 p 3 mp 4 mf 5 f 6 ff 7 fff 1'");
  assert.equal(result.ok, true);
  const velocities = result.value.score[0].measures[0].notes.map((note) => note.velocity);
  assert.deepEqual(velocities, [16, 33, 49, 61, 73, 85, 102, 118]);
});

test("parses velocity before chords", () => {
  const result = parse("f {1 3 5} -");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures[0].notes[0].kind, "pitch");
  assert.equal(result.value.score[0].measures[0].notes[0].velocity, 85);
});

test("parses tie followed by velocity", () => {
  const result = parse("1 - - - | ~f 1 - - -");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[1].notes;
  assert.equal(notes[0].kind, "pitch");
  assert.equal(notes[0].tie, true);
  assert.equal(notes[0].velocity, 85);
});

test("accepts velocity before rest notes", () => {
  const result = parse("f 0");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures[0].notes[0].kind, "rest");
  assert.equal(result.value.score[0].measures[0].notes[0].velocity, 85);
});

test("parses velocity without space before pitch note", () => {
  const result = parse("f1 p2 mf3");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.equal(notes[0].velocity, 85);
  assert.equal(notes[1].velocity, 49);
  assert.equal(notes[2].velocity, 73);
});

test("parses velocity without space before chord", () => {
  const result = parse("f{1 3 5}");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].measures[0].notes[0].velocity, 85);
});

test("rejects velocity before tie (wrong order)", () => {
  const result = parse("1 f~1");
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.message.includes("Expected")));
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

test("accepts P-prefixed percussion track labels in score lines", () => {
  const result = parse("P1: X X X X");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].label, "P1");
  assert.equal(result.value.score[0].measures[0].notes[0].kind, "drum");

  const multiP = parse("P1: X X\nP2: X X\nP3: X X");
  assert.equal(multiP.ok, true);
  assert.equal(multiP.value.score[0].label, "P1");
  assert.equal(multiP.value.score[1].label, "P2");
  assert.equal(multiP.value.score[2].label, "P3");
});

test("rejects P without digits as a score line label", () => {
  const result = parse("P: X X");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Score line labels must be T1-T9, T11-T16, or P followed by digits/);
});

test("parses P-track header name, program, and volume", () => {
  const result = parse(`P1.name: "Kick"\nP1.program: 128\nP1.volume: 0.8\nP2.name: "Snare"\nP2.program: 130\n=\nP1: X X\nP2: X X`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.trackNames.P1, "Kick");
  assert.equal(result.value.header.trackPrograms.P1, 128);
  assert.equal(result.value.header.trackVolumes.P1, 0.8);
  assert.equal(result.value.header.trackNames.P2, "Snare");
  assert.equal(result.value.header.trackPrograms.P2, 130);
});

test("rejects invalid P-track percussion programs", () => {
  const result = parse(`P1.program: 50\nP2.program: 300\nP3.program: "Bass"\n=\nP1: X`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((d) => d.message).join("\n");
  assert.match(messages, /Invalid Percussion Program '50'. Expected 128-174/);
  assert.match(messages, /Invalid Percussion Program '300'. Expected 128-174/);
  assert.match(messages, /Expected Percussion Program number 128-174/);
});

test("P tracks do not interfere with T label ordering", () => {
  const result = parse("T1: 1 2\nP1: X X\nT2: 3 4\nP5: X X");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].label, "T1");
  assert.equal(result.value.score[1].label, "P1");
  assert.equal(result.value.score[2].label, "T2");
  assert.equal(result.value.score[3].label, "P5");
});

test("P tracks can be used without T tracks", () => {
  const result = parse("P1: X X X X | X X X X |");
  assert.equal(result.ok, true);
  assert.equal(result.value.score[0].label, "P1");
  assert.equal(result.value.score[0].measures.length, 2);
});

test("rejects duplicate P-track program definition", () => {
  const result = parse(`P1.program: 128\nP1.program: 130\n=\nP1: X`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Duplicate track program definition for 'P1'/);
});

test("warns when drum note is used on a melodic track", () => {
  const result = parse("T1.program: 0\n=\nT1: X 1");
  assert.equal(result.ok, true);
  const warnings = result.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(warnings.some((d) => d.message.includes("Drum note 'X' used on a melodic track")));

  const scoreLevel = parse("program: 40\n=\nX 1");
  assert.equal(scoreLevel.ok, true);
  const scoreWarnings = scoreLevel.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(scoreWarnings.some((d) => d.message.includes("Drum note 'X' used on a melodic track")));
});

test("does not warn for drum notes when no program is set", () => {
  const result = parse("X 1 0");
  assert.equal(result.ok, true);
  const warnings = result.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!warnings.some((d) => d.message.includes("Drum note")));
  assert.ok(!warnings.some((d) => d.message.includes("drum track")));
});

test("does not warn for drum notes on a drum-mode track", () => {
  const drumProgram = parse("program: 128\n=\nX X");
  assert.equal(drumProgram.ok, true);
  const warnings = drumProgram.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!warnings.some((d) => d.message.includes("Drum note 'X' used on a melodic track")));

  const pTrack = parse("P1.program: 128\n=\nP1: X X");
  assert.equal(pTrack.ok, true);
  const pWarnings = pTrack.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!pWarnings.some((d) => d.message.includes("Drum note 'X' used on a melodic track")));
});

test("warns when pitch note is used on a drum track", () => {
  const drumProgram = parse("program: 128\n=\n1 2");
  assert.equal(drumProgram.ok, true);
  const warnings = drumProgram.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(warnings.some((d) => d.message.includes("Pitch note used on a drum track")));

  const pTrack = parse("P1.program: 130\n=\nP1: 1 X");
  assert.equal(pTrack.ok, true);
  const pWarnings = pTrack.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(pWarnings.some((d) => d.message.includes("Pitch note used on a drum track")));
});

test("does not warn for pitch notes on a melodic track", () => {
  const noProgram = parse("1 2 3");
  assert.equal(noProgram.ok, true);
  const noWarnings = noProgram.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!noWarnings.some((d) => d.message.includes("Pitch note used on a drum track")));

  const withProgram = parse("T1.program: 0\n=\nT1: 1 2 3");
  assert.equal(withProgram.ok, true);
  const withWarnings = withProgram.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!withWarnings.some((d) => d.message.includes("Pitch note used on a drum track")));
});

test("rests never trigger note-kind warnings on any track", () => {
  const melodic = parse("T1.program: 0\n=\nT1: 0 0");
  assert.equal(melodic.ok, true);
  const melodicWarnings = melodic.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!melodicWarnings.some((d) => d.message.includes("rest")));

  const drum = parse("program: 128\n=\n0 0 X");
  assert.equal(drum.ok, true);
  const drumWarnings = drum.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!drumWarnings.some((d) => d.message.includes("rest")));
});

test("P track without explicit program warns on pitch notes (drum mode default)", () => {
  const result = parse("P1: 1 X");
  assert.equal(result.ok, true);
  const warnings = result.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(warnings.some((d) => d.message.includes("Pitch note used on a drum track")));
  assert.ok(!warnings.some((d) => d.message.includes("Drum note")));
});
