import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../dist/parser/index.js";
import { inferContentPageWidth, renderSvg } from "../dist/renderer/index.js";

function readSnapshot(name) {
  return readFileSync(new URL(`./fixtures/snapshots/${name}`, import.meta.url), "utf8").replace(/\r?\n$/, "");
}

const minimalSnapshot = readSnapshot("minimal.svg");
const fullHeaderSnapshot = readSnapshot("full-header.svg");
const hiddenHeaderSnapshot = readSnapshot("hidden-header.svg");
const notationFeaturesSnapshot = readSnapshot("notation-features.svg");
const wrappedTieSnapshot = readSnapshot("wrapped-tie.svg");

test("renders a parse result as an SVG document", () => {
  const result = parse(`title: "Render Test"\nkey: "F#"\n=\n1 #4/ 5-|`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 640 });
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg[^>]+width="640"/);
  assert.match(svg, /Render Test/);
  assert.match(svg, /<g class="key-signature">/);
  assert.match(svg, /<text class="note" x="10" y="80" text-anchor="start" dominant-baseline="central">1<\/text>/);
  assert.match(svg, /<text class="metadata" x="\d+" y="80" dominant-baseline="central"> = F&#9839;<\/text>/);
  assert.match(svg, /&#9839;/);
  assert.match(svg, /class="dash"/);
  assert.match(svg, /font-family: Arial, Helvetica, sans-serif/);
});

test("renders time signatures as stacked digits", () => {
  const result = parse(`time: "4/4"\n=\n1 2 3 4`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  assert.match(svg, /<g class="time-signature">/);
  assert.match(svg, /<text x="\d+" y="32" text-anchor="middle" dominant-baseline="central">4<\/text>/);
  assert.match(svg, /<line x1="\d+" y1="40" x2="\d+" y2="40"\/>/);
  assert.match(svg, /<text x="\d+" y="48" text-anchor="middle" dominant-baseline="central">4<\/text>/);
  assert.match(svg, /<text class="tempo-mark" x="\d+" y="40" dominant-baseline="central">/);
  assert.doesNotMatch(svg, />4\/4<\/text>/);
});

test("keeps key, time, and tempo metadata gaps equal as key text changes", () => {
  const result = parse(`key: "F#"\ntime: "6/8"\ntempo: "96"\n=\n1 2 3`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  const keyMatch = svg.match(/<text class="metadata" x="(?<x>\d+)" y="40" dominant-baseline="central"> = F&#9839;<\/text>/);
  const timeMatch = svg.match(/<text x="(?<x>\d+)" y="32" text-anchor="middle" dominant-baseline="central">6<\/text>/);
  const tempoMatch = svg.match(/<text class="tempo-mark" x="(?<x>\d+)" y="40" dominant-baseline="central">[^<]+ = 96<\/text>/);
  assert.ok(keyMatch?.groups);
  assert.ok(timeMatch?.groups);
  assert.ok(tempoMatch?.groups);

  const keyRightX = Number(keyMatch.groups.x) + 42;
  const timeLeftX = Number(timeMatch.groups.x) - 10;
  const tempoX = Number(tempoMatch.groups.x);
  const timeRightX = timeLeftX + 20;
  assert.equal(timeLeftX - keyRightX, tempoX - timeRightX);
});

test("matches the minimal SVG snapshot", () => {
  const result = parse(`title: "Snapshot"\nkey: "C"\ntime: "4/4"\ntempo: "120"\n=\n1 2 | 3 4 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  assert.equal(svg, minimalSnapshot);
});

test("matches the full header SVG snapshot", () => {
  const result = parse(
    `title: "Full Header"\nsubtitle: "Snapshot Case"\ncomposer: "Composer Name"\nkey: "Bb"\ntime: "6/8"\ntempo: "96"\n=\n`,
  );
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 500, color: "#111827", background: "#ffffff" });
  assert.equal(svg, fullHeaderSnapshot);
});

test("matches the hidden header SVG snapshot", () => {
  const result = parse(
    `title: "Hidden Title"\nsubtitle: "Hidden Subtitle"\ncomposer: "Hidden Composer"\nhidden: "yes"\n=\n1 2 | 3 4 |`,
  );
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 320, color: "#111827", background: "#ffffff" });
  assert.equal(svg, hiddenHeaderSnapshot);
  assert.doesNotMatch(svg, /Hidden Title|Hidden Subtitle|Hidden Composer|class="metadata"/);
});

test("matches the notation features SVG snapshot", () => {
  const result = parse(`{#1 3 5'}/. 0 X// | b7, - ~b7,/ |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 420, color: "#111827", background: "#ffffff" });
  assert.equal(svg, notationFeaturesSnapshot);
});

test("matches the wrapped tie SVG snapshot", () => {
  const result = parse("1 - | ~1 - | 2 3 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 70, color: "#111827", background: "#ffffff" });
  assert.equal(svg, wrappedTieSnapshot);
});

test("renders cross-line ties as cut halves after justification", () => {
  const result = parse("1 2 | 3 - | ~3 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160, justifyMode: "all", background: "#ffffff" });
  assert.match(svg, /<path class="tie" d="M[^"]+ Q[^"]+ [^,]+,88 L[^,]+,89\.5 Q[^"]+ Z"/);
  assert.match(svg, /<path class="tie" d="M[^,]+,148 Q[^"]+ Q[^"]+ [^,]+,149\.5 Z"/);
});

test("renders tempo without musical glyph codepoints", () => {
  const result = parse(`tempo: "132"\ntime: "6/8"\n=\n1 2 3`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /class="tempo-mark"/);
  assert.match(svg, />♪ = 132<\/text>/);
  assert.match(svg, /Segoe UI Symbol/);
  assert.doesNotMatch(svg, /&#119100;|&#119101;|&#119102;|&#119104;/);
});

test("uses a single sixteenth note for 16-denominator tempo marks", () => {
  const result = parse(`tempo: "96"\ntime: "2/16"\n=\n1 2`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, />𝅘𝅥𝅯 = 96<\/text>/);
  assert.doesNotMatch(svg, /♬ = 96/);
});

test("wraps score measures when page width is narrow", () => {
  const result = parse("1 2 | 3 4 | 5 6 | 7 1' |");
  assert.equal(result.ok, true);
  const wide = renderSvg(result.value, { pageWidth: 1000 });
  const narrow = renderSvg(result.value, { pageWidth: 120 });
  const wideHeight = Number(wide.match(/height="([^"]+)"/)?.[1]);
  const narrowHeight = Number(narrow.match(/height="([^"]+)"/)?.[1]);
  assert.ok(narrowHeight > wideHeight);
});

test("justifies all score lines by stretching note positions", () => {
  const result = parse("1//2//3//4// 5- 6/ | 7 |\n5 6 7 |");
  assert.equal(result.ok, true);
  const natural = renderSvg(result.value, { pageWidth: 320, background: "#ffffff" });
  assert.match(natural, /<g class="note-item" data-note-index="1"><text class="note" x="42" y="104" text-anchor="middle">2<\/text>/);
  assert.match(natural, /<g class="note-item" data-note-index="5"><text class="note" x="162" y="104" text-anchor="middle">6<\/text>/);
  assert.match(natural, /<line class="dash" x1="128" y1="95" x2="144" y2="95"/);
  assert.match(natural, /<line class="underline" x1="152" y1="109" x2="176" y2="109"/);
  assert.match(natural, /<g class="note-item" data-note-index="8"><text class="note" x="42" y="158" text-anchor="middle">6<\/text><\/g>/);

  const justified = renderSvg(result.value, { pageWidth: 320, justifyMode: "except-last", background: "#ffffff" });
  assert.match(justified, /<g class="note-item" data-note-index="1"><text class="note" x="42" y="104" text-anchor="middle">2<\/text>/);
  assert.match(justified, /<g class="note-item" data-note-index="5"><text class="note" x="[^"]+" y="104" text-anchor="middle">6<\/text>/);
  assert.doesNotMatch(justified, /<g class="note-item" data-note-index="5"><text class="note" x="162" y="104" text-anchor="middle">6<\/text>/);
  assert.match(justified, /<line class="dash" x1="[^"]+" y1="95" x2="[^"]+" y2="95"/);
  assert.doesNotMatch(justified, /<line class="dash" x1="128" y1="95" x2="144" y2="95"/);
  assert.match(justified, /<line class="underline" x1="[^"]+" y1="109" x2="[^"]+" y2="109"/);
  assert.doesNotMatch(justified, /<line class="underline" x1="152" y1="109" x2="176" y2="109"/);
  assert.match(justified, /<g class="note-item" data-note-index="8"><text class="note" x="42" y="158" text-anchor="middle">6<\/text><\/g>/);
  assert.match(justified, /<line class="bar-thin" x1="314"/);

  const allLines = renderSvg(result.value, { pageWidth: 320, justifyMode: "all", background: "#ffffff" });
  assert.match(allLines, /<g class="note-item" data-note-index="8"><text class="note" x="[^"]+" y="158" text-anchor="middle">6<\/text><\/g>/);
  assert.doesNotMatch(allLines, /<g class="note-item" data-note-index="8"><text class="note" x="42" y="158" text-anchor="middle">6<\/text><\/g>/);
});

test("infers page width from natural score content", () => {
  const short = parse("1 2 |");
  const long = parse("1 2 | 3 4 | 5 6 | 7 1' |");
  assert.equal(short.ok, true);
  assert.equal(long.ok, true);
  assert.ok(inferContentPageWidth(long.value) > inferContentPageWidth(short.value));
  assert.equal(inferContentPageWidth(long.value, { minWidth: 600, maxWidth: 620 }), 600);
  assert.equal(inferContentPageWidth(long.value, { minWidth: 1, maxWidth: 120 }), 120);
});

test("scales a single overwide score line into the page width", () => {
  const result = parse("1--- 2--- 3--- 4---");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 120 });
  assert.match(svg, /<svg[^>]+width="120"/);
  assert.match(svg, /<g class="score-line scaled" transform="scale\(0\.\d+,1\)">/);
});

test("renders chord notes as stacked text instead of slash-joined text", () => {
  const result = parse("{1 3 5}/");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.doesNotMatch(svg, />1\/3\/5</);
  assert.match(svg, />1</);
  assert.match(svg, />3</);
  assert.match(svg, />5</);
});

test("shortens underline at beat boundaries", () => {
  const result = parse("1//1//1//1//");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /class="underline" x1="8" y1="109" x2="32" y2="109"/);
  assert.match(svg, /class="underline" x1="80" y1="109" x2="100" y2="109"/);
});

test("distinguishes regular and final bars", () => {
  const result = parse("1 | 2 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /class="bar-thin"/);
  assert.match(svg, /class="bar-final"/);
  assert.doesNotMatch(svg, /&#119047;|&#119049;/);
});

test("renders repeat barlines with dots", () => {
  const result = parse("|: 1 2 | 3 4 :|");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /class="repeat-dot"/);
  assert.match(svg, /<line class="bar-final"/);
  assert.match(svg, /<line class="bar-thin"/);
});

test("renders combined repeat end and start barlines", () => {
  const result = parse("|: 1 :|: 2 :|");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const dots = [...svg.matchAll(/<circle class="repeat-dot" cx="(\d+)"/g)].map((match) => Number(match[1]));
  assert.equal(dots.filter((x) => x === 60).length, 2);
  assert.equal(dots.filter((x) => x === 86).length, 2);
  assert.match(svg, /<line class="bar-thin" x1="66"/);
  assert.match(svg, /<line class="bar-final" x1="73"/);
  assert.match(svg, /<line class="bar-thin" x1="80"/);
  assert.match(svg, /<text class="note" x="106" y="\d+" text-anchor="middle">2<\/text>/);
});

test("keeps repeat end spacing before following notes", () => {
  const result = parse("|: 1 :| 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /<line class="bar-final" x1="73"/);
  assert.match(svg, /<text class="note" x="94" y="\d+" text-anchor="middle">2<\/text>/);
});

test("renders repeated ending brackets", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /<path class="ending-line"/);
  assert.match(svg, /<text class="ending-label" x="\d+" y="\d+" text-anchor="start">1\.<\/text>/);
  assert.match(svg, /<text class="ending-label" x="\d+" y="\d+" text-anchor="start">2\.<\/text>/);
});

test("renders ending brackets open at wrapped line ends", () => {
  const result = parse("|: 1 | [1] 2 | 3 | 4 :| [2] 5 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 80 });
  const openEnding = svg.match(/<path class="ending-line" d="M\d+,\d+ V\d+ H(?<x>\d+)"\/>/);
  assert.ok(openEnding?.groups);
  assert.ok(Number(openEnding.groups.x) < 70);
});

test("renders ending brackets open across source line breaks", () => {
  const result = parse("|: 1 | [1] 2\n3 :| [2] 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /<path class="ending-line" d="M\d+,\d+ V\d+ H\d+"\/>/);
});

test("renders the final ending as one open measure", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 | 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const openEndings = [...svg.matchAll(/<path class="ending-line" d="M\d+,\d+ V\d+ H(?<x>\d+)"\/>/g)];
  const followingNote = svg.match(/<text class="note" x="(?<x>\d+)" y="\d+" text-anchor="middle">4<\/text>/);
  assert.equal(openEndings.length, 1);
  assert.ok(openEndings[0]?.groups);
  assert.ok(followingNote?.groups);
  assert.ok(Number(openEndings[0].groups.x) < Number(followingNote.groups.x));
});

test("renders final endings open in multiple repeat sections", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 | 4 |: 5 | [1] 6 :| [2] 7 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const openEndings = [...svg.matchAll(/<path class="ending-line" d="M\d+,\d+ V\d+ H\d+"\/>/g)];
  assert.equal(openEndings.length, 2);
});

test("keeps repeat start spacing consistent at the beginning of a line", () => {
  const result = parse("|: 1 | 2 :|");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const repeatStart = svg.match(/<line class="bar-final" x1="(\d+)"/);
  const firstNote = svg.match(/<text class="note" x="(\d+)" y="\d+" text-anchor="middle">1<\/text>/);
  assert.ok(repeatStart);
  assert.ok(firstNote);
  assert.equal(Number(firstNote[1]) - Number(repeatStart[1]), 34);
});

test("keeps inline repeat start spacing consistent", () => {
  const result = parse("1 2 |: 3 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const repeatStart = svg.match(/<line class="bar-final" x1="(\d+)"/);
  const firstNote = svg.match(/<text class="note" x="(\d+)" y="\d+" text-anchor="middle">3<\/text>/);
  assert.ok(repeatStart);
  assert.ok(firstNote);
  assert.doesNotMatch(svg, new RegExp(`<line class="bar-thin" x1="${repeatStart[1]}"`));
  assert.equal(Number(firstNote[1]) - Number(repeatStart[1]), 34);
});

test("marks active notes for preview highlighting", () => {
  const result = parse("1 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { activeNoteIndex: 1 });
  assert.match(svg, /<g class="note-item" data-note-index="0">/);
  assert.match(svg, /<g class="note-item active" data-note-index="1">/);
});

test("marks multiple active notes for arrangement preview highlighting", () => {
  const result = parse("T1: 1 2\nT2: 5, 6,");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { activeNoteIndices: [0, 2] });
  assert.match(svg, /<g class="note-item active" data-note-index="0">/);
  assert.match(svg, /<g class="note-item" data-note-index="1">/);
  assert.match(svg, /<g class="note-item active" data-note-index="2">/);
});

test("renders header-defined track labels with reserved horizontal space", () => {
  const result = parse(`T1: "Verse"\n=\nT1: 1 2 | 3 4 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160 });
  assert.match(svg, /<text class="line-label" x="8" y="[^"]+" text-anchor="start">Verse<\/text>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="72"/);
});

test("does not render bare track labels without header-defined names", () => {
  const result = parse("T1: 1 2 | 3 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160 });
  assert.doesNotMatch(svg, /class="line-label"/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="18"/);
});

test("renders voice brackets around simultaneous track groups", () => {
  const result = parse(`T1: "High"\nT2: "Low"\n=\nT1: 1 2\nT2: 5, 6,\nT1: 3`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 220 });
  const bracketCount = svg.match(/class="voice-bracket"/g)?.length ?? 0;
  assert.equal(bracketCount, 2);
  assert.match(svg, /<text class="line-label" x="8" y="[^"]+" text-anchor="start">High<\/text>/);
  assert.match(svg, /<path class="voice-bracket" d="M71,[^"]+ L62,[^"]+ V[^"]+ L71,[^"]+"\/>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="88"/);
});

test("aligns voice brackets with group-level justification", () => {
  const result = parse("T1: 1 2\nT2: 5, 6,\nT1: 3 4\nT2: 1, 2,");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 320, justifyMode: "except-last" });
  assert.match(svg, /<path class="voice-bracket" d="M303,[^"]+ L312,[^"]+ V[^"]+ L303,[^"]+"\/>/);
  assert.match(svg, /<path class="voice-bracket" d="M\d+,[^"]+ L\d+,[^"]+ V[^"]+ L\d+,[^"]+"\/>/);
  assert.equal(svg.match(/L312,/g)?.length ?? 0, 1);
});

test("does not render voice brackets for single-voice groups", () => {
  const result = parse("T1: 1\nT1: 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.doesNotMatch(svg, /class="voice-bracket"/);
});

test("renders final bars on every line of the final voice group", () => {
  const result = parse("T1: 1\nT2: 5,\nT1: 2\nT2: 6,");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.equal(svg.match(/class="bar-final"/g)?.length ?? 0, 2);
});

test("renders lyrics below the preceding voice group", () => {
  const result = parse('T1: "High"\nT2: "Low"\n=\nT1: 1 2\nT2: 5, 6,\nL1: "hello & goodbye"\n"second line"\nT1: 3 4');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 240 });
  assert.match(svg, /<text class="lyric-line" x="\d+" y="\d+" text-anchor="start">hello &amp; goodbye<\/text>/);
  assert.match(svg, /<text class="lyric-syllable" x="\d+" y="\d+" text-anchor="middle">second<\/text><text class="lyric-syllable" x="\d+" y="\d+" text-anchor="middle">line<\/text>/);
  assert.ok(svg.indexOf("hello &amp; goodbye") < svg.indexOf('data-note-index="4"'));
});

test("renders header-defined lyric labels with reserved horizontal space", () => {
  const result = parse('L1: "Verse"\n=\n1 2\nL1: "hello"\n"again"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.match(svg, /<text class="line-label" x="8" y="\d+" text-anchor="start">Verse<\/text><text class="lyric-line" x="72" y="\d+" text-anchor="start">hello<\/text>/);
  assert.match(svg, /<text class="lyric-line" x="72" y="\d+" text-anchor="start">again<\/text>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="72"/);
});

test("justifies lyric text with its score group", () => {
  const result = parse('1 2\n"hello"\n3 4\n"tail"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 240, justifyMode: "except-last" });
  assert.match(svg, /<text class="lyric-line" x="18" y="\d+" text-anchor="start" textLength="222" lengthAdjust="spacing">hello<\/text>/);
  assert.match(svg, /<text class="lyric-line" x="18" y="\d+" text-anchor="start">tail<\/text>/);
});

test("aligns lyric syllables under main voice notes", () => {
  const result = parse('T1: 1 2 3\nT2: 5, 6, 7,\n"one two three"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 240, justifyMode: "all" });
  assert.match(svg, /<text class="lyric-syllable" x="34" y="\d+" text-anchor="middle">one<\/text>/);
  assert.match(svg, /<text class="lyric-syllable" x="97\.08571428571429" y="\d+" text-anchor="middle">two<\/text>/);
  assert.match(svg, /<text class="lyric-syllable" x="160\.17142857142858" y="\d+" text-anchor="middle">three<\/text>/);
});

test("keeps multi-line lyric syllables as a normal lyric line", () => {
  const result = parse('1 2 | 3 4 |\n"one two three four"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 90 });
  assert.match(svg, /<text class="lyric-line" x="18" y="\d+" text-anchor="start">one two three four<\/text>/);
  assert.doesNotMatch(svg, /<text class="lyric-syllable"/);
});

test("renders explicit export color and background", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { color: "#123456", background: "#f8fafc" });
  assert.match(svg, /<svg[^>]+style="color: #123456"/);
  assert.match(svg, /<rect class="page-background"[^>]+fill="#f8fafc"/);
});
