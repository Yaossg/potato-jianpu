import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";

test("parses a header and unspaced score", () => {
  const result = parse(`title: "Twinkle"\nkey: D\ntime: 4/4\ntempo: 180\n===\n1155|665-|\n`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, "Twinkle");
  assert.equal(result.value.header.keySignature, 2);
  assert.equal(result.value.header.tempo, 180);
  assert.equal(result.value.score.length, 1);
  assert.equal(result.value.score[0].measures.length, 2);
  assert.equal(result.value.score[0].measures[1].notes[2].duration.dashes, 1);
});

test('warns and ignores slides between notes at the same pitch', () => {
  for (const source of ['1(~) 1 0 0', '#1(~) 1 0 0', '#1(~) b2 0 0']) {
    const result = parse(source);
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.diagnostics.map(({ severity, message }) => ({ severity, message })),
      [{ severity: 'warning', message: 'Slide between notes at the same pitch is ignored.' }],
    );
    assert.equal(result.value.score[0].measures[0].notes[0].ornament, undefined);
  }

  const resetAccidental = parse('0 0 0 #1(~) | 1 0 0 0');
  assert.equal(resetAccidental.ok, true);
  assert.equal(resetAccidental.diagnostics.length, 0);
  assert.equal(resetAccidental.value.score[0].measures[0].notes[3].ornament?.kind, 'slide');
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
  assert.equal(result.value.header.pageNumbers, false);
  assert.equal(result.value.header.measureNumbers, false);
  assert.equal(result.value.header.paginate, false);
});

test("parses page rendering header fields", () => {
  const result = parse(`footer: "modern-jianpu"\npageNumbers: true\nmeasureNumbers: true\npaginate: true\n===\n1 2`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.footer, "modern-jianpu");
  assert.equal(result.value.header.pageNumbers, true);
  assert.equal(result.value.header.measureNumbers, true);
  assert.equal(result.value.header.paginate, true);
});

test("parses pageNumbers boolean values and rejects invalid or duplicate values", () => {
  for (const value of [true, false]) {
    const result = parse(`pageNumbers: ${value}\n===\n1 2 3 4`);
    assert.equal(result.ok, true);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.value.header.pageNumbers, value);
  }
  for (const value of ['"true"', 'yes', '1']) {
    const result = parse(`pageNumbers: ${value}\n===\n1 2 3 4`);
    assert.equal(result.ok, false);
    assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Expected boolean value for pageNumbers/);
  }
  const duplicate = parse("pageNumbers: true\npageNumbers: false\n===\n1 2 3 4");
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.diagnostics.map((d) => d.message).join("\n"), /Duplicate header property 'pageNumbers'/);
});

test("rejects the former numbering header name", () => {
  const result = parse("numbering: true\n===\n1 2 3 4");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Unknown header key 'numbering'/);
});

test("parses omitted measure numbers and explicit true and false", () => {
  for (const value of [undefined, true, false]) {
    const source = value === undefined ? "1 2 3 4" : `measureNumbers: ${value}\n===\n1 2 3 4`;
    const result = parse(source);
    assert.equal(result.ok, true);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.value.header.measureNumbers, value ?? false);
  }
});

test("accepts the exact triple-equals header separator", () => {
  const result = parse(`title: "Separator"\n===\n1 2`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, "Separator");
  assert.equal(result.value.score[0].measures[0].notes.length, 2);
});

test("rejects header separators that are not exactly three equals", () => {
  for (const separator of ["=", "==", "===="]) {
    const result = parse(`title: "Separator"\n${separator}\n1 2`);
    assert.equal(result.ok, false, `${separator} should be rejected`);
    assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected '===' header separator/);
  }
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

test("parses navigation marks before and after measures", () => {
  const result = parse("[Segno] 1 | 2 [Fine] [To Coda] | 3 [D.S.] | [Coda] 4 [D.C.]");
  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.message).filter((message) => message.includes("Only one [D.C.]")), [
    "Only one [D.C.] or [D.S.] navigation jump is supported.",
  ]);

  const valid = parse("[Segno] 1 | 2 [Fine] [To Coda] | 3 [D.S.] | [Coda] 4");
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.value.score[0].measures[0].navigationBefore, ["segno"]);
  assert.deepEqual(valid.value.score[0].measures[1].navigationAfter, ["fine", "toCoda"]);
  assert.deepEqual(valid.value.score[0].measures[2].navigationAfter, ["ds"]);
  assert.deepEqual(valid.value.score[0].measures[3].navigationBefore, ["coda"]);
});

test("keeps repeated ending markers distinct from navigation brackets", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 [Fine] [D.C.]");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].measures[1].ending, [1]);
  assert.deepEqual(result.value.score[0].measures[2].ending, [2]);
  assert.deepEqual(result.value.score[0].measures[2].navigationAfter, ["fine", "dc"]);
});

test("rejects navigation marks in the wrong measure position", () => {
  const prefixInstruction = parse("[D.C.] 1");
  assert.equal(prefixInstruction.ok, false);
  assert.match(prefixInstruction.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /must appear after a measure/);

  const prefixFine = parse("[Fine] 1");
  assert.equal(prefixFine.ok, false);
  assert.match(prefixFine.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /must appear after a measure/);

  const suffixTarget = parse("1 [Segno]");
  assert.equal(suffixTarget.ok, false);
  assert.match(suffixTarget.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /must appear before a measure/);

  const suffixEnding = parse("1 [1]");
  assert.equal(suffixEnding.ok, false);
  assert.match(suffixEnding.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Ending markers such as \[1\] must appear before a measure/);
});

test("rejects invalid navigation graphs", () => {
  const duplicateFine = parse("1 [Fine] | 2 [Fine]");
  assert.equal(duplicateFine.ok, false);
  assert.match(duplicateFine.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /\[Fine\] appears more than once/);

  const missingSegno = parse("1 [D.S.]");
  assert.equal(missingSegno.ok, false);
  assert.match(missingSegno.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /\[D\.S\.\] needs a \[Segno\] target/);

  const missingCoda = parse("[Segno] 1 | 2 [To Coda] | 3 [D.S.]");
  assert.equal(missingCoda.ok, false);
  assert.match(missingCoda.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /\[To Coda\] needs a \[Coda\] target/);

  const duplicateToCoda = parse("[Segno] 1 | 2 [To Coda] | 3 [To Coda] | 4 [D.S.] | [Coda] 5");
  assert.equal(duplicateToCoda.ok, false);
  assert.match(duplicateToCoda.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Only one \[To Coda\]/);

  const backwardCoda = parse("[Coda] 1 | [Segno] 2 | 3 [To Coda] | 4 [D.S.]");
  assert.equal(backwardCoda.ok, false);
  assert.match(backwardCoda.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /jump backward to \[Coda\]/);
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

test("rejects empty measures between consecutive bars", () => {
  const result = parse("1 2 || 3 4");
  assert.equal(result.ok, false);
  const diagnostics = result.diagnostics.filter((item) => item.message.includes("Empty measures are not allowed"));
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.severity, "error");
});

test("reports one empty-measure error for each consecutive boundary run", () => {
  const result = parse("1 ||| 2 || 3");
  assert.equal(result.ok, false);
  const diagnostics = result.diagnostics.filter((item) => item.message.includes("Empty measures are not allowed"));
  assert.equal(diagnostics.length, 2);
});

test("rejects empty measures around repeat boundaries without diagnostic cascades", () => {
  const result = parse("1111 :|: || 2222 :|");
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((item) => item.message);
  assert.equal(messages.filter((message) => message.includes("Empty measures are not allowed")).length, 1);
  assert.equal(messages.some((message) => message.includes("Repeated ending")), false);
});

test("distinguishes adjacent repeat boundaries from a combined repeat boundary", () => {
  for (const source of ["1 |::| 2", "|::|", "1 :| |: 2"]) {
    const result = parse(source);
    assert.equal(result.ok, false, `${source} should contain an empty measure`);
    const diagnostics = result.diagnostics.filter((item) => item.message.includes("Empty measures are not allowed"));
    assert.equal(diagnostics.length, 1, `${source} should report one empty-measure error`);
  }

  const combined = parse("1 :|: 2");
  assert.equal(combined.ok, true);
  assert.equal(combined.value.score[0].measures[0].repeatEnd, true);
  assert.equal(combined.value.score[0].measures[1].repeatStart, true);
});

test("continues parsing diagnostics after an empty measure", () => {
  const result = parse("1111 || 2222 ? 3333");
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((item) => item.message).join("\n");
  assert.match(messages, /Empty measures are not allowed/);
  assert.match(messages, /Unexpected character '\?'/);
});

test("rejects a score line that contains only barlines", () => {
  const result = parse("|");
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((item) => item.message).join("\n"), /Empty measures are not allowed/);
});

test("uses explicit rests instead of empty measures for measure-long silence", () => {
  const result = parse("0 - - - |");
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.value.score[0].measures[0].notes[0].kind, "rest");
  assert.equal(result.value.score[0].measures[0].notes[0].duration.value, 1);
});

test("keeps comment boundaries between header and score lines", () => {
  const result = parse(`title: "Comments" ; header comment\n===\n1 2 ; score comment\n; whole-line comment\n3 4`);
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

test("parses slurs as document-level track spans", () => {
  const source = `$(1(^) 2 | 3 ~3
"one two three four"
---
4 5)`;
  const result = parse(source);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.slurs.map(({ startNoteIndex, endNoteIndex, track, placement }) => ({ startNoteIndex, endNoteIndex, track, placement })), [
    { startNoteIndex: 0, endNoteIndex: 5, track: "T1", placement: "auto" },
  ]);
  assert.equal(result.value.slurs[0].range.start.offset, 0);
  assert.equal(result.value.slurs[0].range.end.offset, source.length);
});

test("parses nested, chord, and independently tracked slurs", () => {
  const nested = parse(`$($(1 2) {3 5})`);
  assert.equal(nested.ok, true);
  assert.deepEqual(nested.value.slurs.map((slur) => [slur.startNoteIndex, slur.endNoteIndex]), [[0, 2], [0, 1]]);

  const tracked = parse(`T1: $(1 2)
T2: $({1 3} {2 4})`);
  assert.equal(tracked.ok, true);
  assert.deepEqual(tracked.value.slurs.map((slur) => slur.track), ["T1", "T2"]);
});

test("parses branched slurs into alternate endings", () => {
  const result = parse("1 2 $(3 4 | [1] 1 2) 3 4 $(:| [2] 1 2) 3 4 |");
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.slurs.map((slur) => ({
    start: slur.startNoteIndex,
    end: slur.endNoteIndex,
    role: slur.branch?.role,
    commonEnd: slur.branch?.commonEndNoteIndex,
    endings: slur.branch?.endings,
  })), [
    { start: 2, end: 5, role: "primary", commonEnd: 3, endings: [1] },
    { start: 8, end: 9, role: "continuation", commonEnd: 3, endings: [2] },
  ]);
});

test("validates alternate-ending slur continuations", () => {
  const source = "1 | [1] 2 $(:| [2] 3)";
  const result = parse(source);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /needs a matching slur/);
});

test("uses the common predecessor for ties entering every ending", () => {
  const valid = parse("|: 1 | [1] ~1 :| [2] ~1");
  assert.equal(valid.ok, true);
  assert.equal(valid.value.score[0].measures[2].notes[0].tieFromEnding, true);

  const incompatibleCommon = parse("|: 1 | [1] 2 :| [2] ~2");
  assert.equal(incompatibleCommon.ok, false);
  assert.match(incompatibleCommon.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /must match the previous sounding note/);

  const compatibleCommon = parse("|: 1 | [1] 2 :| [2] ~1");
  assert.equal(compatibleCommon.ok, true);
});

test("warns for rests inside slurs while keeping the visual span", () => {
  const result = parse("$(1 0 2)");
  assert.equal(result.ok, true);
  assert.equal(result.value.slurs.length, 1);
  assert.deepEqual(result.diagnostics.map((diagnostic) => [diagnostic.severity, diagnostic.message]), [
    ["warning", "Slur contains a rest; the arc will still be rendered."],
    ["warning", "Measure duration 0.75 does not match time signature duration 1."],
  ]);
});

test("reports invalid and unmatched slur syntax", () => {
  const cases = [
    ["$ (1 2)", /Unexpected character '\$'/],
    ["$()", /must be followed by a note/],
    ["$(1)", /at least two pitch notes or chords/],
    ["$(0 1)", /must start on a pitch note or chord/],
    ["$(1 0)", /must end on a pitch note or chord/],
    ["$(1 X 2)", /cannot contain drum notes/],
    ["1 2)", /without matching slur start/],
    ["$(1 2", /Unclosed slur/],
    [`T1: $(1 2
T2: 5 6)`, /without matching slur start/],
  ];
  for (const [source, expected] of cases) {
    const result = parse(source);
    assert.equal(result.ok, false, source);
    assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), expected, source);
  }
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

test("parses note-attached mordents before duration suffixes", () => {
  const result = parse("1(^)- 1(v)/");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.deepEqual(
    notes.map((note) => note.ornament?.kind),
    ["mordent", "mordent"],
  );
  assert.equal(notes[0].ornament.direction, "upper");
  assert.equal(notes[1].ornament.direction, "lower");
  assert.equal(notes[0].duration.dashes, 1);
  assert.equal(notes[1].duration.halves, 1);
});

test("parses note-attached turns before duration suffixes", () => {
  const result = parse("1(z)- 1(s)/");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.deepEqual(
    notes.map((note) => note.ornament?.kind),
    ["turn", "turn"],
  );
  assert.equal(notes[0].ornament.direction, "upper");
  assert.equal(notes[1].ornament.direction, "lower");
  assert.equal(notes[0].duration.dashes, 1);
  assert.equal(notes[1].duration.halves, 1);
});

test("parses visual-only fermatas on notes, chords, rests, drums, and tied notes", () => {
  const result = parse("1(.)- {1 3 5}(.) 0(.) X(.) 2 ~2(.)");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.deepEqual(notes.map((note) => note.ornament?.kind), ["fermata", "fermata", "fermata", "fermata", undefined, "fermata"]);
  assert.equal(notes[0].duration.dashes, 1);
  assert.equal(notes[5].tie, true);
});

test("parses short and long trills before duration suffixes", () => {
  const source = "1(tr) 2(tr~) 3(tr~)-";
  const result = parse(source);
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.deepEqual(
    notes.map((note) => note.ornament?.kind),
    ["trill", "trill", "trill"],
  );
  assert.equal(notes[0].ornament.extension, undefined);
  assert.equal(notes[1].ornament.extension, "wavy");
  assert.equal(notes[2].ornament.extension, "wavy");
  assert.equal(notes[2].duration.dashes, 1);
  const extensionOffset = source.indexOf("~");
  assert.ok(notes[1].ornament.range.start.offset <= extensionOffset);
  assert.ok(notes[1].ornament.range.end.offset > extensionOffset);
  const shortExtensionWarning = result.diagnostics.find((diagnostic) =>
    diagnostic.message.includes("Long trill extension needs at least one duration dash"),
  );
  assert.equal(shortExtensionWarning?.severity, "warning");
  assert.deepEqual(shortExtensionWarning?.range, notes[1].ornament.range);

  const duplicate = parse("1(tr~~)");
  assert.equal(duplicate.ok, false);
  assert.match(
    duplicate.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Long trill accepts only one '~' extension marker/,
  );

  const obsolete = parse("1(t)");
  assert.equal(obsolete.ok, false);
  assert.match(obsolete.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected.*'tr'/);
});

test("parses note-attached grace ornaments before duration suffixes", () => {
  const result = parse("1(<2)- 1(>23)/ 1(<#2') 1(<2345)");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.deepEqual(
    notes.map((note) => note.ornament?.kind),
    ["grace", "grace", "grace", "grace"],
  );
  assert.equal(notes[0].ornament.placement, "before");
  assert.deepEqual(notes[0].ornament.pitches.map((pitch) => pitch.note), [2]);
  assert.equal(notes[0].duration.dashes, 1);
  assert.equal(notes[1].ornament.placement, "after");
  assert.deepEqual(notes[1].ornament.pitches.map((pitch) => pitch.note), [2, 3]);
  assert.equal(notes[1].duration.halves, 1);
  assert.equal(notes[2].ornament.pitches[0].accidental, 1);
  assert.equal(notes[2].ornament.pitches[0].octave, 1);
  assert.deepEqual(notes[3].ornament.pitches.map((pitch) => pitch.note), [2, 3, 4, 5]);
});

test("parses ornaments attached to whole chords except slides", () => {
  const result = parse("{1 3 5}(^) {1 3 5}(z) {1 3 5}(tr~)- {1 3 5}(<2) {1 3 5}(>6)");
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.value.score[0].measures[0].notes.map((note) => note.ornament?.kind),
    ["mordent", "turn", "trill", "grace", "grace"],
  );

  const slide = parse("{1 3 5}(~) 6");
  assert.equal(slide.ok, false);
  assert.match(slide.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Slides cannot be attached to chords/);
});

test("parses slides and validates their immediate targets", () => {
  const result = parse("1(~) 5 | 5(~) 1");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures.flatMap((measure) => measure.notes);
  assert.deepEqual(notes.map((note) => note.ornament?.kind), ["slide", undefined, "slide", undefined]);

  for (const [source, message] of [
    ["1(~)", "Slide must be followed by a target pitch note"],
    ["1(~) 0", "Slide target must be a single pitch note"],
    ["1(~) {1 3}", "Slide target must be a single pitch note"],
    ["1(~) ~2", "Slide target cannot be a tied note"],
  ]) {
    const invalid = parse(source);
    assert.equal(invalid.ok, false);
    assert.match(invalid.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), new RegExp(message));
  }
});

test("reports diagnostics for unsupported ornament attachments", () => {
  const result = parse("0(^) X(^) ~1(^) 0(tr~) X(tr~) ~1(tr~) 1(^)(v) 1() 1(q) 1(gl) 1(2) 1(2 1(<) 1(>0) 1(<234)");
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Ornaments can only be attached to pitch notes/);
  assert.match(messages, /Ornaments cannot be attached to tied notes/);
  assert.match(messages, /Only one ornament can be attached to a note/);
  assert.match(messages, /Ornament parentheses cannot be empty/);
  assert.match(messages, /Expected '\.', '\^', 'v', 'z', 's', 'tr', '~', '<', or '>'/);
  assert.match(messages, /Grace ornaments must include at least one pitch note/);
  assert.match(messages, /Grace ornaments must contain 1, 2, 4, or another power-of-two number of pitch notes/);
  assert.match(messages, /Grace ornament pitches must use note syntax 1-7/);
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
  const result = parse(`tempo: -1\ntime: 5/4\nkey: H\nhidden: yes\nmeasureNumbers: yes\npaginate: yes\n===\n1234`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid tempo/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Invalid time signature/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Unknown key signature/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Expected boolean value for hidden/);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Expected boolean value for measureNumbers/);
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
  const sharp = parse(`key: #C\n===\n1`);
  assert.equal(sharp.ok, true);
  assert.equal(sharp.value.header.keySignature, 1);
  assert.equal(sharp.value.header.keySignatureText, "#C");

  const flat = parse(`key: bB\n===\n1`);
  assert.equal(flat.ok, true);
  assert.equal(flat.value.header.keySignature, 10);
  assert.equal(flat.value.header.keySignatureText, "bB");
});

test("rejects old string syntax for typed header values", () => {
  const result = parse(`tempo: "120"\ntime: "4/4"\nkey: "D"\nhidden: "yes"\nmeasureNumbers: "true"\npaginate: "true"\n===\n1 2`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Expected numeric tempo value/);
  assert.match(messages, /Expected time signature value/);
  assert.match(messages, /Expected key signature value/);
  assert.match(messages, /Expected boolean value for hidden/);
  assert.match(messages, /Expected boolean value for measureNumbers/);
  assert.match(messages, /Expected boolean value for paginate/);
});

test("rejects unknown and case-mismatched header keys", () => {
  const result = parse(`arranger2_name: "Ada"\nTempo: 120\nT1.Name: "Melody"\n===\n1 2`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Unknown header key 'arranger2_name'/);
  assert.match(messages, /Unknown header key 'Tempo'/);
  assert.match(messages, /Unknown header key 'T1.Name'/);
});

test("rejects duplicate header properties", () => {
  const result = parse(`tempo: 120\ntempo: 96\nT1.name: "Melody"\nT1: "Other"\nL1.name: "Verse"\nL1: "Other"\n===\n1 2`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Duplicate header property 'tempo'/);
  assert.match(messages, /Duplicate track name definition for 'T1'/);
  assert.match(messages, /Duplicate lyric label definition for 'L1'/);
});

test("keeps quoted header string escape text", () => {
  const result = parse(`title: "A \\"quoted\\" title"\n===\n1`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.title, `A \\"quoted\\" title`);
});

test("reports unterminated header strings", () => {
  const result = parse(`title: "unterminated\n===\n1 2`);
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
  const result = parse("title: Missing Quotes\ncomposer: \"Ada\"\n===\n1 2 3 4");
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Expected quoted string value for title/);
  assert.doesNotMatch(messages, /Expected note, rest, drum note, chord, or tie/);
});

test("rejects unknown header fields", () => {
  const result = parse(`arranger2_name: "Ada"\ntitle: "Raw Header"\n===\n1 2 3 4`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unknown header key 'arranger2_name'/);
});

test("requires identifiers to start with a letter", () => {
  const result = parse(`_arranger: "Ada"\n===\n1 2 3 4`);
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
  const result = parse(`T1: "Drums"\n===\nT1: X X`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.trackNames.T1, "Drums");
  assert.equal(result.value.score[0].label, "T1");
  assert.equal(result.value.score[0].measures[0].notes[0].kind, "drum");

  const highTrack = parse("T1: 1\nT2: 1\nT3: 1\nT4: 1\nT5: 1\nT6: 1\nT7: 1\nT8: 1\nT9: 1\nT11: 1");
  assert.equal(highTrack.ok, true);
  assert.equal(highTrack.value.score.at(-1).label, "T11");

  const digitHeader = parse(`T1_name: "Drums"\n===\nT1: X1 X2`);
  assert.equal(digitHeader.ok, false);
  assert.match(digitHeader.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unknown header key 'T1_name'/);

  const xHeader = parse(`X_name: "Drums"\n===\nXX`);
  assert.equal(xHeader.ok, false);
  assert.match(xHeader.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unknown header key 'X_name'/);
});

test("parses per-track header programs", () => {
  const result = parse(`T1.program: 40\nT2.program: "Violin"\nT3.program: " flute "\n===\nT1: 1\nT2: 2\nT3: 3`);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.header.trackPrograms, {
    T1: 40,
    T2: 40,
    T3: 73,
  });
});

test("rejects invalid per-track header programs", () => {
  const result = parse(`T1.program: "40"\nT2.program: "Not A Program"\nT3.program: -1\nT4.program: 128\nT5.program: piano\nT1.program: 41\nT10.program: 40\n===\nT1: 1`);
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
  const result = parse(`program: 128\nvolume: 72.5%\n===\nX 1`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.program, 128);
  assert.equal(result.value.header.volume, 0.725);
});

test("parses default header program names", () => {
  const result = parse(`program: "Violin"\n===\n1`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.program, 40);
});

test("rejects invalid default header program and volume", () => {
  const result = parse(`program: -1\nprogram: 0\nvolume: 201%\n===\n1`);
  assert.equal(result.ok, false);
  const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
  assert.match(messages, /Expected Program number 0-174 or quoted Program name/);
  assert.match(messages, /Duplicate header property 'program'/);
  assert.match(messages, /Invalid volume '201%'. Expected 0-2 or 0%-200%/);
});

test("parses per-track header volumes", () => {
  const result = parse(`T1.volume: 0\nT2.volume: 72.5%\nT3.volume: 2\n===\nT1: 1\nT2: 2\nT3: 3`);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.header.trackVolumes, {
    T1: 0,
    T2: 0.725,
    T3: 2,
  });
});

test("rejects invalid per-track header volumes", () => {
  const result = parse(`T1.volume: "1"\nT2.volume: -0.1\nT3.volume: 2.1\nT4.volume: loud\nT5.volume: 201%\nT1.volume: 1\nT10.volume: 1\n===\nT1: 1`);
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

test("allows aligned lyric syllables to omit trailing main voice notes", () => {
  const result = parse('1 2 3 4\n"one two"');
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
});

test("parses lyric alignment placeholders", () => {
  const result = parse('1 2 3 4\n"one _ held ~"');
  assert.equal(result.ok, true);
  const lyric = result.value.score[0].lyrics?.[0];
  assert.deepEqual(lyric?.syllables, ["one", "held"]);
  assert.deepEqual(lyric?.alignment, [
    { kind: "syllable", text: "one" },
    { kind: "space" },
    { kind: "syllable", text: "held" },
    { kind: "merge" },
  ]);
});

test("parses automatic Chinese lyric syllables", () => {
  const result = parse('1 2 3\n@"春天来"');
  assert.equal(result.ok, true);
  const lyric = result.value.score[0].lyrics?.[0];
  assert.equal(lyric?.text, "春天来");
  assert.deepEqual(lyric?.syllables, ["春", "天", "来"]);
  assert.deepEqual(lyric?.alignment, [
    { kind: "syllable", text: "春" },
    { kind: "syllable", text: "天" },
    { kind: "syllable", text: "来" },
  ]);
});

test("parses automatic hyphenated English lyric syllables", () => {
  const result = parse('1 2 3 4 5\n@"sev-en glo-ri-a"');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].lyrics?.[0]?.syllables, ["sev-", "en", "glo-", "ri-", "a"]);
});

test("parses mixed automatic lyric punctuation and manual placeholders", () => {
  const result = parse('1 2 3 4 5 6\nL1: @"春天 glo-ri-a! _ ~"');
  assert.equal(result.ok, true);
  const lyric = result.value.score[0].lyrics?.[0];
  assert.deepEqual(lyric?.syllables, ["春", "天", "glo-", "ri-", "a!"]);
  assert.deepEqual(lyric?.alignment, [
    { kind: "syllable", text: "春" },
    { kind: "syllable", text: "天" },
    { kind: "syllable", text: "glo-" },
    { kind: "syllable", text: "ri-" },
    { kind: "syllable", text: "a!" },
    { kind: "space" },
    { kind: "merge" },
  ]);
});

test("keeps normal lyric strings manually tokenized", () => {
  const result = parse('1 2 3\n"春天来"');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.score[0].lyrics?.[0]?.syllables, ["春天来"]);
});

test("rejects automatic lyric strings as header quoted strings", () => {
  const result = parse('title: @"Song"\n===\n1 2 3 4');
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Expected quoted string value for title/);
});

test("rejects lyric merge placeholders before visible syllables", () => {
  const result = parse('1 2\n"~ first"');
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Lyric merge placeholder '~' must follow a visible syllable/);
});

test("warns when lyric syllables exceed main voice notes", () => {
  const result = parse('1 2 3 4\n"one two three four five"');
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.message),
    ["Lyric has 5 syllables but the main voice has 4 notes."],
  );
});

test("warns when lyric alignment slots exceed main voice notes", () => {
  const result = parse('time: 2/4\n===\n1 0\n"one _ two"');
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.message),
    ["Lyric has 3 aligned slots but the main voice has 1 notes."],
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
  const complete = parse(`time: 4/4\n===\n1 2 3 4`);
  assert.equal(complete.ok, true);
  assert.equal(complete.diagnostics.some((diagnostic) => diagnostic.message.includes("Measure duration")), false);

  const short = parse(`time: 4/4\n===\n1 2`);
  assert.equal(short.ok, true);
  assert.equal(short.diagnostics.some((diagnostic) => diagnostic.severity === "warning"), true);
  assert.match(short.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Measure duration 0.5 does not match/);

  const compound = parse(`time: 6/8\n===\n1/ 2/ 3/ 4/ 5/ 6/`);
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

test("parses hairpin markers on durable notes", () => {
  const result = parse("p < 1 2 3 f < 4");
  assert.equal(result.ok, true);
  const notes = result.value.score[0].measures[0].notes;
  assert.equal(notes[0].hairpinStart, "crescendo");
  assert.equal(notes[3].hairpinEnd, "crescendo");
  assert.equal(notes[3].velocity, 85);
});

test("validates hairpin pairing per track", () => {
  const incomplete = parse("< 1 2");
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Hairpin must end with a matching '<'/);

  const overlapping = parse("< 1 > 2 < 3");
  assert.equal(overlapping.ok, false);
  assert.match(overlapping.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Hairpins cannot overlap/);

  const transition = parse("p < 1 2 f <> 3 4 p > 5");
  assert.equal(transition.ok, true);
  const transitionNotes = transition.value.score[0].measures[0].notes;
  assert.equal(transitionNotes[2].hairpinEnd, "crescendo");
  assert.equal(transitionNotes[2].hairpinStart, "diminuendo");

  const reverseTransition = parse("f > 1 2 p >< 3 4 f < 5");
  assert.equal(reverseTransition.ok, true);
  const reverseNotes = reverseTransition.value.score[0].measures[0].notes;
  assert.equal(reverseNotes[2].hairpinEnd, "diminuendo");
  assert.equal(reverseNotes[2].hairpinStart, "crescendo");

  const separateTracks = parse("T1: < 1 2\nT2: > 5, 6,\nT1: < 3\nT2: > 7,");
  assert.equal(separateTracks.ok, true);

  const noTarget = parse("< | 1");
  assert.equal(noTarget.ok, false);
  assert.match(noTarget.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Hairpin markers must be followed/);
  assert.equal(noTarget.diagnostics.some((diagnostic) => diagnostic.message.includes("Expected pitch note 1-7")), false);
});

test("warns when hairpin direction disagrees with explicit dynamics", () => {
  const crescendo = parse("f < 1 2 p < 3");
  assert.equal(crescendo.ok, true);
  const crescendoWarnings = crescendo.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  assert.ok(crescendoWarnings.some((diagnostic) => diagnostic.message.includes("Crescendo '<' should end louder")));

  const diminuendo = parse("p > 1 2 f > 3");
  assert.equal(diminuendo.ok, true);
  const diminuendoWarnings = diminuendo.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  assert.ok(diminuendoWarnings.some((diagnostic) => diagnostic.message.includes("Diminuendo '>' should end softer")));

  const inferredEndpoint = parse("p < 1 2 < 3");
  assert.equal(inferredEndpoint.ok, true);
  assert.equal(inferredEndpoint.diagnostics.some((diagnostic) => diagnostic.message.includes("should end")), false);
});

test("rejects obsolete hairpin end markers", () => {
  const strayEnd = parse("! 1");
  assert.equal(strayEnd.ok, false);
  assert.match(strayEnd.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unexpected character '!'/);
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
  const result = parse(`P1.name: "Kick"\nP1.program: 128\nP1.volume: 0.8\nP2.name: "Snare"\nP2.program: 130\n===\nP1: X X\nP2: X X`);
  assert.equal(result.ok, true);
  assert.equal(result.value.header.trackNames.P1, "Kick");
  assert.equal(result.value.header.trackPrograms.P1, 128);
  assert.equal(result.value.header.trackVolumes.P1, 0.8);
  assert.equal(result.value.header.trackNames.P2, "Snare");
  assert.equal(result.value.header.trackPrograms.P2, 130);
});

test("rejects invalid P-track percussion programs", () => {
  const result = parse(`P1.program: 50\nP2.program: 300\nP3.program: "Bass"\n===\nP1: X`);
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
  const result = parse(`P1.program: 128\nP1.program: 130\n===\nP1: X`);
  assert.equal(result.ok, false);
  assert.match(result.diagnostics.map((d) => d.message).join("\n"), /Duplicate track program definition for 'P1'/);
});

test("warns when drum note is used on a melodic track", () => {
  const result = parse("T1.program: 0\n===\nT1: X 1");
  assert.equal(result.ok, true);
  const warnings = result.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(warnings.some((d) => d.message.includes("Drum note 'X' used on a melodic track")));

  const scoreLevel = parse("program: 40\n===\nX 1");
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
  const drumProgram = parse("program: 128\n===\nX X");
  assert.equal(drumProgram.ok, true);
  const warnings = drumProgram.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!warnings.some((d) => d.message.includes("Drum note 'X' used on a melodic track")));

  const pTrack = parse("P1.program: 128\n===\nP1: X X");
  assert.equal(pTrack.ok, true);
  const pWarnings = pTrack.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!pWarnings.some((d) => d.message.includes("Drum note 'X' used on a melodic track")));
});

test("warns when pitch note is used on a drum track", () => {
  const drumProgram = parse("program: 128\n===\n1 2");
  assert.equal(drumProgram.ok, true);
  const warnings = drumProgram.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(warnings.some((d) => d.message.includes("Pitch note used on a drum track")));

  const pTrack = parse("P1.program: 130\n===\nP1: 1 X");
  assert.equal(pTrack.ok, true);
  const pWarnings = pTrack.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(pWarnings.some((d) => d.message.includes("Pitch note used on a drum track")));
});

test("does not warn for pitch notes on a melodic track", () => {
  const noProgram = parse("1 2 3");
  assert.equal(noProgram.ok, true);
  const noWarnings = noProgram.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!noWarnings.some((d) => d.message.includes("Pitch note used on a drum track")));

  const withProgram = parse("T1.program: 0\n===\nT1: 1 2 3");
  assert.equal(withProgram.ok, true);
  const withWarnings = withProgram.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!withWarnings.some((d) => d.message.includes("Pitch note used on a drum track")));
});

test("rests never trigger note-kind warnings on any track", () => {
  const melodic = parse("T1.program: 0\n===\nT1: 0 0");
  assert.equal(melodic.ok, true);
  const melodicWarnings = melodic.diagnostics.filter((d) => d.severity === "warning");
  assert.ok(!melodicWarnings.some((d) => d.message.includes("rest")));

  const drum = parse("program: 128\n===\n0 0 X");
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

test("repeated composer properties preserve ordered credit lines and empty entries", () => {
  const result = parse('composer: ""\ncomposer: "张三 作词"\ntempo: 96\ncomposer: "李四 作曲"\ncomposer: ""\n===\n1 2 3 4');
  assert.equal(result.ok, true);
  assert.equal(result.value.header.composer, '\n张三 作词\n李四 作曲\n');
  assert.deepEqual(result.diagnostics, []);
  for (const key of ["title", "subtitle"]) {
    const duplicate = parse(key + ': "A"\n' + key + ': "B"\n===\n1 2 3 4');
    assert.equal(duplicate.ok, false);
    assert.ok(duplicate.diagnostics.some((d) => d.message.includes("Duplicate header property")));
  }
  assert.equal(parse('composer: Unquoted\n===\n1 2 3 4').ok, false);
});
