import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../dist/parser/index.js";
import { renderSvg } from "../dist/renderer/index.js";

const minimalSnapshot = readFileSync(new URL("./fixtures/snapshots/minimal.svg", import.meta.url), "utf8").replace(/\r?\n$/, "");

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

test("matches the minimal SVG snapshot", () => {
  const result = parse(`title: "Snapshot"\nkey: "C"\ntime: "4/4"\ntempo: "120"\n=\n1 2 | 3 4 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  assert.equal(svg, minimalSnapshot);
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

test("renders explicit export color and background", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { color: "#123456", background: "#f8fafc" });
  assert.match(svg, /<svg[^>]+style="color: #123456"/);
  assert.match(svg, /<rect class="page-background"[^>]+fill="#f8fafc"/);
});
