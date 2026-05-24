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
  assert.match(svg, /1=F&#9839;/);
  assert.match(svg, /&#9839;/);
  assert.match(svg, /class="dash"/);
  assert.match(svg, /font-family: Arial, Helvetica, sans-serif/);
});

test("renders time signatures as stacked digits", () => {
  const result = parse(`time: "4/4"\n=\n1 2 3 4`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  assert.match(svg, /<g class="time-signature">/);
  assert.match(svg, /<text x="88" y="30" text-anchor="middle" dominant-baseline="central">4<\/text>/);
  assert.match(svg, /<line x1="80" y1="40" x2="96" y2="40"\/>/);
  assert.match(svg, /<text x="88" y="50" text-anchor="middle" dominant-baseline="central">4<\/text>/);
  assert.doesNotMatch(svg, />4\/4<\/text>/);
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

test("marks active notes for preview highlighting", () => {
  const result = parse("1 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { activeNoteIndex: 1 });
  assert.match(svg, /<g class="note-item" data-note-index="0">/);
  assert.match(svg, /<g class="note-item active" data-note-index="1">/);
});

test("renders score line labels with reserved horizontal space", () => {
  const result = parse("verse: 1 2 | 3 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160 });
  assert.match(svg, /<text class="line-label" x="8" y="[^"]+" text-anchor="start">verse<\/text>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="72"/);
});

test("renders explicit export color and background", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { color: "#123456", background: "#f8fafc" });
  assert.match(svg, /<svg[^>]+style="color: #123456"/);
  assert.match(svg, /<rect class="page-background"[^>]+fill="#f8fafc"/);
});
