import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../dist/parser/index.js";
import { analyzeScoreOverwidth, inferContentPageWidth, PAPER_PRESET_LIST, renderSvg, resolvePageSize } from "../dist/renderer/index.js";

function readSnapshot(name) {
  return readFileSync(new URL(`./fixtures/snapshots/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
}

const minimalSnapshot = readSnapshot("minimal.svg");
const fullHeaderSnapshot = readSnapshot("full-header.svg");
const hiddenHeaderSnapshot = readSnapshot("hidden-header.svg");
const notationFeaturesSnapshot = readSnapshot("notation-features.svg");
const wrappedTieSnapshot = readSnapshot("wrapped-tie.svg");

function noteX(svg, noteIndex) {
  const match = svg.match(
    new RegExp(`<g class="note-item(?: active)?" data-note-index="${noteIndex}">[\\s\\S]*?<text class="note" x="([^"]+)"`),
  );
  assert.ok(match, `note ${noteIndex} should render`);
  return Number(match[1]);
}

function lyricSyllableX(svg, text) {
  const match = svg.match(new RegExp(`<text class="lyric-syllable" x="([^"]+)" y="[^"]+" text-anchor="middle">${text}</text>`));
  assert.ok(match, `lyric syllable ${text} should render`);
  return Number(match[1]);
}

function lyricEstimatedWidth(text) {
  return [...text].reduce((sum, char) => {
    if (/\s/u.test(char)) {
      return sum + 4.5;
    }
    if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(char)) {
      return sum + 17;
    }
    if (/[A-Za-z0-9]/u.test(char)) {
      return sum + 8.5;
    }
    if (/[\p{P}\p{S}]/u.test(char)) {
      return sum + 5;
    }
    return sum + 9;
  }, 0);
}

function dashCenterX(svg, noteIndex) {
  const match = svg.match(new RegExp(`<g class="note-item(?: active)?" data-note-index="${noteIndex}">[\\s\\S]*?<line class="dash" x1="([^"]+)" y1="[^"]+" x2="([^"]+)"`));
  assert.ok(match, `note ${noteIndex} should render a dash`);
  return (Number(match[1]) + Number(match[2])) / 2 + 2;
}

function rightVoiceBracketX(svg) {
  const matches = [...svg.matchAll(/<path class="voice-bracket" d="M([^,]+),[^"]+ L([^,]+),[^"]+ V[^"]+ L\1,[^"]+"\/>/g)];
  const right = matches.flatMap((match) => {
    const innerX = Number(match[1]);
    const outerX = Number(match[2]);
    return outerX > innerX ? [outerX] : [];
  });
  assert.equal(right.length, 1, "one right voice bracket should render");
  return right[0];
}

function finalBarXs(svg) {
  return [...svg.matchAll(/<line class="bar-final" x1="([^"]+)"/g)].map((match) => Number(match[1]));
}

function notePosition(svg, noteIndex) {
  const match = svg.match(new RegExp(`<g class="note-item(?: active)?" data-note-index="${noteIndex}"><text class="note" x="([^"]+)" y="([^"]+)"`));
  assert.ok(match, `note ${noteIndex} should render`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

function navigationY(svg, text) {
  const match = svg.match(
    new RegExp(`<text class="navigation-(?:target|instruction)[^"]*" x="[^"]+" y="([^"]+)" text-anchor="(?:start|middle)">${text}</text>`),
  );
  assert.ok(match, `navigation mark ${text} should render`);
  return Number(match[1]);
}

function tiePaths(svg) {
  return [...svg.matchAll(/<path class="tie" d="([^"]+)"/g)].map((match) => match[1]);
}

test("renders a parse result as an SVG document", () => {
  const result = parse(`title: "Render Test"\nkey: F#\n===\n1 #4/ 5-|`);
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
  const result = parse(`time: 4/4\n===\n1 2 3 4`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  assert.match(svg, /<g class="time-signature">/);
  assert.match(svg, /<text x="\d+" y="30" text-anchor="middle" dominant-baseline="central">4<\/text>/);
  assert.match(svg, /<line x1="\d+" y1="40" x2="\d+" y2="40"\/>/);
  assert.match(svg, /<text x="\d+" y="50" text-anchor="middle" dominant-baseline="central">4<\/text>/);
  assert.match(svg, /<text class="tempo-mark" x="\d+" y="40" dominant-baseline="central">/);
  assert.doesNotMatch(svg, />4\/4<\/text>/);
});

test("keeps key, time, and tempo metadata gaps equal as key text changes", () => {
  const result = parse(`key: F#\ntime: 6/8\ntempo: 96\n===\n1 2 3`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  const keyMatch = svg.match(/<text class="metadata" x="(?<x>\d+)" y="40" dominant-baseline="central"> = F&#9839;<\/text>/);
  const timeMatch = svg.match(/<text x="(?<x>\d+)" y="30" text-anchor="middle" dominant-baseline="central">6<\/text>/);
  const tempoMatch = svg.match(
    /<text class="tempo-mark" x="(?<x>\d+)" y="40" dominant-baseline="central">[^<]+<tspan class="tempo-value"> = 96<\/tspan><\/text>/,
  );
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
  const result = parse(`title: "Snapshot"\nkey: C\ntime: 4/4\ntempo: 120\n===\n1 2 | 3 4 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  assert.equal(svg, minimalSnapshot);
});

test("matches the full header SVG snapshot", () => {
  const result = parse(
    `title: "Full Header"\nsubtitle: "Snapshot Case"\ncomposer: "Composer Name"\nkey: Bb\ntime: 6/8\ntempo: 96\n===\n`,
  );
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 500, color: "#111827", background: "#ffffff" });
  assert.equal(svg, fullHeaderSnapshot);
});

test("matches the hidden header SVG snapshot", () => {
  const result = parse(
    `title: "Hidden Title"\nsubtitle: "Hidden Subtitle"\ncomposer: "Hidden Composer"\nhidden: true\n===\n1 2 | 3 4 |`,
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

test("paginates visual lines into fixed-height page groups", () => {
  const result = parse(`title: "Paged"\n===\n1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 120, paginate: true, pageHeight: 160, background: "#ffffff" });
  const pageCount = [...svg.matchAll(/<g class="page" data-page="(\d+)"/g)].length;
  assert.ok(pageCount > 1);
  assert.match(svg, new RegExp(`<svg[^>]+height="${pageCount * 160}"[^>]+viewBox="0 0 120 ${pageCount * 160}"`));
  assert.equal([...svg.matchAll(/<rect class="page-background"/g)].length, pageCount);
  assert.equal([...svg.matchAll(/<rect class="page-boundary"/g)].length, pageCount);
  assert.match(svg, /<rect class="page-background" x="0" y="0" width="120" height="160" fill="#ffffff"\/>/);
  assert.match(svg, /<rect class="page-background" x="0" y="160" width="120" height="160" fill="#ffffff"\/>/);
  assert.match(svg, /<rect class="page-boundary" x="0\.5" y="0\.5" width="119" height="159" fill="none" stroke="#cbd5e1" stroke-width="1"\/>/);
  assert.match(svg, /<rect class="page-boundary" x="0\.5" y="160\.5" width="119" height="159" fill="none" stroke="#cbd5e1" stroke-width="1"\/>/);
  const page2 = svg.match(/<g class="page" data-page="2"[\s\S]*?(?=<g class="page" data-page="3"|<\/svg>)/)?.[0] ?? "";
  assert.match(page2, /<line class="bar-thin" x1="[^"]+" y1="12"/);
  assert.match(page2, /<text class="note" x="[^"]+" y="36"/);
  assert.equal([...svg.matchAll(/Paged/g)].length, 1);
  assert.match(svg, /<g class="page" data-page="1" transform="translate\(0, 0\)">[\s\S]*Paged/);
  assert.doesNotMatch(svg, /<g class="page" data-page="2"[^>]*>[\s\S]*Paged/);
});

test("uses pagination from the header unless render options override it", () => {
  const result = parse(`paginate: true\n===\n1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |`);
  assert.equal(result.ok, true);

  const fromHeader = renderSvg(result.value, { pageWidth: 120, pageHeight: 160, background: "#ffffff" });
  const pageCount = [...fromHeader.matchAll(/<g class="page" data-page="/g)].length;
  assert.ok(pageCount > 1);
  assert.match(fromHeader, new RegExp(`<svg[^>]+height="${pageCount * 160}"`));

  const overridden = renderSvg(result.value, { pageWidth: 120, paginate: false, pageHeight: 160, background: "#ffffff" });
  assert.doesNotMatch(overridden, /<g class="page" data-page="/);
});

test("resolves paper presets before explicit page size overrides", () => {
  assert.deepEqual(PAPER_PRESET_LIST.map((preset) => preset.name), ["a4", "b5", "letter"]);
  assert.deepEqual(resolvePageSize({ paper: "a4" }), { pageWidth: 1190, pageHeight: 1684 });
  assert.deepEqual(resolvePageSize({ paper: "a4", orientation: "landscape" }), { pageWidth: 1684, pageHeight: 1190 });
  assert.deepEqual(resolvePageSize({ paper: "b5" }), { pageWidth: 998, pageHeight: 1418 });
  assert.deepEqual(resolvePageSize({ paper: "b5", orientation: "landscape" }), { pageWidth: 1418, pageHeight: 998 });
  assert.deepEqual(resolvePageSize({ paper: "letter", orientation: "landscape", pageWidth: 700 }), {
    pageWidth: 700,
    pageHeight: 1224,
  });
  assert.deepEqual(resolvePageSize({ orientation: "landscape", pageHeight: 900 }), { pageWidth: 1400, pageHeight: 900 });
});

test("starts a new paginated page at manual page breaks", () => {
  const result = parse("1 2\n---\n3 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160, paginate: true, pageHeight: 180, background: "#ffffff" });
  assert.equal([...svg.matchAll(/<g class="page" data-page="/g)].length, 2);
  const page1 = svg.match(/<g class="page" data-page="1"[\s\S]*?(?=<g class="page" data-page="2")/)?.[0] ?? "";
  const page2 = svg.match(/<g class="page" data-page="2"[\s\S]*?<\/g>\s*<\/svg>/)?.[0] ?? "";
  assert.match(page1, />1<\/text>/);
  assert.match(page1, />2<\/text>/);
  assert.doesNotMatch(page1, />3<\/text>/);
  assert.match(page2, />3<\/text>/);
  assert.match(page2, />4<\/text>/);
});

test("renders score content inside page margins", () => {
  const result = parse(`hidden: true\n===\n1 2 | 3 4 | 5 6 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160, pageMargin: 20, background: "#ffffff" });
  assert.match(svg, /<svg[^>]+width="160"/);
  assert.match(svg, /<rect class="page-background" x="0" y="0" width="160" height="[^"]+" fill="#ffffff"\/>/);
  assert.match(svg, /<g class="page-content" transform="translate\(20, 20\)">/);
  assert.match(svg, /<text class="note" x="18" y="24"/);

  const withoutMargin = renderSvg(result.value, { pageWidth: 120, background: "#ffffff" });
  const marginLines = [...svg.matchAll(/<line class="bar-(?:thin|final)"/g)].length;
  const sameContentWidthLines = [...withoutMargin.matchAll(/<line class="bar-(?:thin|final)"/g)].length;
  assert.equal(marginLines, sameContentWidthLines);
});

test("renders page footers and page numbers", () => {
  const result = parse(`hidden: true\n===\n1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, {
    pageWidth: 140,
    paginate: true,
    pageHeight: 160,
    pageMargin: 20,
    pageFooter: "modern-jianpu",
    pageNumbers: true,
  });
  const pageCount = [...svg.matchAll(/<g class="page" data-page="/g)].length;
  assert.ok(pageCount > 1);
  assert.equal([...svg.matchAll(/class="page-footer"/g)].length, pageCount);
  assert.equal([...svg.matchAll(/class="page-number"/g)].length, pageCount);
  assert.match(svg, /<text class="page-footer" x="20" y="148" text-anchor="start">modern-jianpu<\/text>/);
  assert.match(svg, new RegExp(`<text class="page-number" x="70" y="148" text-anchor="middle">1 / ${pageCount}</text>`));
  assert.match(svg, /<g class="page-content" transform="translate\(20, 20\)">/);
});

test("uses page adornments from the header", () => {
  const result = parse(`hidden: true\nfooter: "from-header"\nnumbering: true\n===\n1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, {
    pageWidth: 140,
    paginate: true,
    pageHeight: 160,
    pageMargin: 20,
  });
  assert.match(svg, /<text class="page-footer"[^>]*>from-header<\/text>/);
  assert.match(svg, /<text class="page-number"[^>]*>1 \/ \d+<\/text>/);
});

test("renders cross-line ties as cut halves after justification", () => {
  const result = parse("1 2 | 3 - | ~3 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160, justifyMode: "all", background: "#ffffff" });
  assert.match(svg, /<path class="tie" d="M[^"]+ Q[^"]+ [^,]+,88 L[^,]+,89\.5 Q[^"]+ Z"/);
  assert.match(svg, /<path class="tie" d="M[^,]+,148 Q[^"]+ Q[^"]+ [^,]+,149\.5 Z"/);
});

test("connects ties to the previous note in the same track", () => {
  const result = parse("T1: 1 2\nT2: 5, -\nT1: 3 4\nT2: ~5, 6,");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 220 });
  const secondT1 = notePosition(svg, 4);
  const secondT2Tied = notePosition(svg, 5);
  const paths = tiePaths(svg);
  const incomingTie = paths.find((path) => path.startsWith("M16,") && path.includes(`${secondT2Tied.x},`));
  assert.ok(incomingTie, "incoming tie should render into the tied T2 note");
  assert.match(incomingTie, new RegExp(` ${secondT2Tied.x},${secondT2Tied.y - 24}(?: |$)`));
  assert.equal(
    paths.some((path) => path.startsWith(`M${secondT1.x},`) && path.includes(` ${secondT2Tied.x},${secondT2Tied.y - 24}`)),
    false,
    "tied T2 note should not connect back to the previous T1 note in the visual group",
  );
});

test("renders tempo without musical glyph codepoints", () => {
  const result = parse(`tempo: 132\ntime: 6/8\n===\n1 2 3`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /class="tempo-mark"/);
  assert.match(svg, /\.tempo-value \{ font-size: 20px; \}/);
  assert.match(svg, />♪<tspan class="tempo-value"> = 132<\/tspan><\/text>/);
  assert.match(svg, /Segoe UI Symbol/);
  assert.doesNotMatch(svg, /&#119100;|&#119101;|&#119102;|&#119104;/);
});

test("uses a single sixteenth note for 16-denominator tempo marks", () => {
  const result = parse(`tempo: 96\ntime: 2/16\n===\n1 2`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, />𝅘𝅥𝅯<tspan class="tempo-value"> = 96<\/tspan><\/text>/);
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

test("reports overwide score layout warnings", () => {
  const single = parse("1--- 2--- 3--- 4---");
  assert.equal(single.ok, true);
  const singleWarnings = analyzeScoreOverwidth(single.value, 120);
  assert.equal(singleWarnings.length, 1);
  assert.equal(singleWarnings[0].multiTrack, false);
  assert.equal(singleWarnings[0].range.start.line, 1);
  assert.ok(singleWarnings[0].naturalWidth > singleWarnings[0].pageWidth);

  const multi = parse("T1: 1--- 2--- 3--- 4---\nT2: 5--- 6--- 7--- 1'---");
  assert.equal(multi.ok, true);
  const multiWarnings = analyzeScoreOverwidth(multi.value, 160);
  assert.ok(multiWarnings.some((warning) => warning.multiTrack));
});

test("reports source lines that auto-wrap into multiple visual lines", () => {
  const result = parse("1 2 | 3 4 | 5 6 | 7 1' |");
  assert.equal(result.ok, true);
  const warnings = analyzeScoreOverwidth(result.value, 120);
  const wrapped = warnings.find((warning) => warning.kind === "wrapped-source-line");
  assert.ok(wrapped);
  assert.equal(wrapped.range.start.line, 1);
  assert.equal(wrapped.multiTrack, false);
  assert.ok(wrapped.visualLineCount > 1);
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

test("renders repeated ending brackets for multiple passes", () => {
  const result = parse("|: 1 | [1,2] 2 :| [3] 3 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /<text class="ending-label" x="\d+" y="\d+" text-anchor="start">1,2\.<\/text>/);
  assert.match(svg, /<text class="ending-label" x="\d+" y="\d+" text-anchor="start">3\.<\/text>/);
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

test("renders navigation marks before and after measures", () => {
  const result = parse("[Segno] 1 | 2 [Fine] [To Coda] | 3 [D.S.] | [Coda] 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /<text class="navigation-target navigation-symbol" x="\d+" y="\d+" text-anchor="start">&#119051;<\/text>/);
  assert.match(svg, /<text class="navigation-target navigation-symbol navigation-coda-symbol" x="\d+" y="\d+" text-anchor="start">&#119052;<\/text>/);
  assert.match(svg, /<text class="navigation-target navigation-target-text" x="\d+" y="\d+" text-anchor="middle">Fine<\/text>/);
  assert.doesNotMatch(svg, />Segno<\/text>|>Coda<\/text>/);
  assert.match(svg, /<text class="navigation-instruction" x="\d+" y="\d+" text-anchor="middle">To Coda<\/text>/);
  assert.match(svg, /<text class="navigation-instruction" x="\d+" y="\d+" text-anchor="middle">D\.S\.<\/text>/);
  assert.match(svg, /\.navigation-target, \.navigation-instruction \{[^}]*font-style: italic/);
  assert.match(svg, /\.navigation-symbol \{[^}]*font-style: normal/);
});

test("keeps navigation marks visible on wrapped output", () => {
  const result = parse("[Segno] 1 | 2 | 3 [D.S.] | 4 [Fine]");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 80 });
  assert.match(svg, /class="navigation-target\b/);
  assert.match(svg, /class="navigation-instruction"/);
});

test("keeps short navigation instructions from adding wide ghost space", () => {
  const result = parse("[Segno] 1 [D.S.] | 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.ok(noteX(svg, 1) < 80);
});

test("keeps navigation marks above dense upper measure decorations", () => {
  const result = parse("[Segno] p < 1''' ~1''' f < 1''' [D.S.] | 2 [Fine]");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const navigationBottom = Math.max(navigationY(svg, "&#119051;"), navigationY(svg, "D\\.S\\."));
  const upperDecorationYs = [
    ...[...svg.matchAll(/<circle class="dot" cx="[^"]+" cy="([^"]+)" r="2"\/>/g)].map((match) => Number(match[1])),
    ...[...svg.matchAll(/<line class="hairpin" x1="[^"]+" y1="([^"]+)" x2="[^"]+" y2="([^"]+)"\/>/g)].flatMap((match) => [
      Number(match[1]),
      Number(match[2]),
    ]),
    ...[...svg.matchAll(/<text class="velocity" x="[^"]+" y="([^"]+)"/g)].map((match) => Number(match[1])),
  ];
  assert.ok(upperDecorationYs.length > 0);
  assert.ok(navigationBottom + 6 < Math.min(...upperDecorationYs));
});

test("keeps navigation marks above repeated ending brackets", () => {
  const result = parse("|: [Segno] [1] 1 :| [2] 2 [Fine]");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const navigationBottom = Math.max(navigationY(svg, "&#119051;"), navigationY(svg, "Fine"));
  const endingTop = Math.min(...[...svg.matchAll(/<path class="ending-line" d="M[^,]+,([^ ]+) /g)].map((match) => Number(match[1])));
  assert.ok(Number.isFinite(endingTop));
  assert.ok(navigationBottom + 6 < endingTop);
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
  const result = parse(`T1: "Verse"\n===\nT1: 1 2 | 3 4 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160 });
  assert.match(svg, /<text class="line-label" x="8" y="[^"]+" text-anchor="start">Verse<\/text>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="79"/);
});

test("renders T1 header label for a single unlabeled score line", () => {
  const result = parse(`T1.name: "Melody"\n===\n1 2 | 3 4 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160 });
  assert.match(svg, /<text class="line-label" x="8" y="[^"]+" text-anchor="start">Melody<\/text>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="87"/);
});

test("sizes label space from rendered label text", () => {
  const short = parse(`T1: "A"\n===\nT1: 1 2`);
  const long = parse(`T1: "Extremely Long Track Label For Width"\n===\nT1: 1 2`);
  assert.equal(short.ok, true);
  assert.equal(long.ok, true);

  assert.equal(noteX(renderSvg(short.value), 0), 45);
  assert.equal(noteX(renderSvg(long.value), 0), 342);
  assert.ok(inferContentPageWidth(long.value, { maxWidth: 1000 }) > inferContentPageWidth(short.value, { maxWidth: 1000 }));
});

test("does not render bare track labels without header-defined names", () => {
  const result = parse("T1: 1 2 | 3 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160 });
  assert.doesNotMatch(svg, /class="line-label"/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="18"/);
});

test("renders voice brackets around simultaneous track groups", () => {
  const result = parse(`T1: "High"\nT2: "Low"\n===\nT1: 1 2\nT2: 5, 6,\nT1: 3`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 220 });
  const bracketCount = svg.match(/class="voice-bracket"/g)?.length ?? 0;
  assert.equal(bracketCount, 2);
  assert.match(svg, /<text class="line-label" x="8" y="[^"]+" text-anchor="start">High<\/text>/);
  assert.match(svg, /<path class="voice-bracket" d="M69,[^"]+ L60,[^"]+ V[^"]+ L69,[^"]+"\/>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="86"/);
});

test("aligns voice brackets with group-level justification", () => {
  const result = parse("T1: 1 2\nT2: 5, 6,\nT1: 3 4\nT2: 1, 2,");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 320, justifyMode: "except-last" });
  assert.match(svg, /<path class="voice-bracket" d="M303,[^"]+ L312,[^"]+ V[^"]+ L303,[^"]+"\/>/);
  assert.match(svg, /<path class="voice-bracket" d="M\d+,[^"]+ L\d+,[^"]+ V[^"]+ L\d+,[^"]+"\/>/);
  assert.equal(svg.match(/L312,/g)?.length ?? 0, 1);
});

test("keeps right voice brackets on the rendered score width", () => {
  const result = parse('T1: 1\nT2: 5,\n"a very very very very long lyric line"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360 });

  assert.equal(rightVoiceBracketX(svg), 70);
});

test("aligns notes across simultaneous tracks by rhythmic position", () => {
  const result = parse("T1: 1 2 3 4 | 5 6 7 1'\nT2: 5, - 6, - | 1, - 2, -");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260, justifyMode: "all" });

  assert.equal(noteX(svg, 8), noteX(svg, 0));
  assert.equal(dashCenterX(svg, 8), noteX(svg, 1));
  assert.equal(noteX(svg, 9), noteX(svg, 2));
  assert.equal(dashCenterX(svg, 9), noteX(svg, 3));
  assert.equal(noteX(svg, 10), noteX(svg, 4));
  assert.equal(dashCenterX(svg, 10), noteX(svg, 5));
  assert.equal(noteX(svg, 11), noteX(svg, 6));
  assert.equal(dashCenterX(svg, 11), noteX(svg, 7));
});

test("aligns differing simultaneous track rhythms when beat boundaries match", () => {
  const result = parse("T1: 1 2 3 4\nT2: 5,/ 5,/ 6,/ 6,/ 7, 1,");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });

  assert.equal(noteX(svg, 4), noteX(svg, 0));
  assert.equal(noteX(svg, 6), noteX(svg, 1));
  assert.equal(noteX(svg, 8), noteX(svg, 2));
  assert.equal(noteX(svg, 9), noteX(svg, 3));
  assert.equal(new Set(finalBarXs(svg)).size, 1);
});

test("falls back to measure-level alignment when track rhythms miss beat boundaries", () => {
  const result = parse('time: 2/4\n===\nT1: 1/ 2 1/\nT2: 5, 6,');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });

  assert.equal(noteX(svg, 3), noteX(svg, 0));
  assert.notEqual(noteX(svg, 4), noteX(svg, 1));
  assert.equal(new Set(finalBarXs(svg)).size, 1);
});

test("aligns simultaneous tracks only within matching wrapped measure spans", () => {
  const result = parse("T1: 1 2 3 4 | 5 6 7 1'\nT2: 5, - 6, - | 1, - 2, -");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 112 });

  assert.equal(noteX(svg, 8), noteX(svg, 0));
  assert.equal(noteX(svg, 9), noteX(svg, 2));
  assert.equal(noteX(svg, 10), noteX(svg, 4));
  assert.equal(noteX(svg, 11), noteX(svg, 6));
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
  const result = parse('T1: "High"\nT2: "Low"\n===\nT1: 1 2\nT2: 5, 6,\nL1: "hello & goodbye"\n"second line"\nT1: 3 4');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 240 });
  assert.match(svg, /<text class="lyric-line" x="\d+" y="\d+" text-anchor="start">hello &amp; goodbye<\/text>/);
  assert.equal(lyricSyllableX(svg, "second"), noteX(svg, 0));
  assert.equal(lyricSyllableX(svg, "line"), noteX(svg, 1));
  assert.ok(svg.indexOf("hello &amp; goodbye") < svg.indexOf('data-note-index="4"'));
});

test("renders header-defined lyric labels with reserved horizontal space", () => {
  const result = parse('L1: "Verse"\n===\n1 2\nL1: "hello"\n"again"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.match(svg, /<text class="line-label" x="8" y="\d+" text-anchor="start">Verse<\/text><text class="lyric-line" x="79" y="\d+" text-anchor="start">hello<\/text>/);
  assert.match(svg, /<text class="lyric-line" x="79" y="\d+" text-anchor="start">again<\/text>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="79"/);
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
  assert.equal(lyricSyllableX(svg, "one"), noteX(svg, 0));
  assert.equal(lyricSyllableX(svg, "two"), noteX(svg, 1));
  assert.equal(lyricSyllableX(svg, "three"), noteX(svg, 2));
});

test("aligns fewer lyric syllables under leading main voice notes", () => {
  const result = parse('1 2 3 4\n"one two"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.equal(lyricSyllableX(svg, "one"), noteX(svg, 0));
  assert.equal(lyricSyllableX(svg, "two"), noteX(svg, 1));
  assert.doesNotMatch(svg, /<text class="lyric-line"[^>]*>one two<\/text>/);
});

test("renders lyric spacing placeholders as empty aligned slots", () => {
  const result = parse('1 2 3 4\n"one _ three four"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.equal(lyricSyllableX(svg, "one"), noteX(svg, 0));
  assert.equal(lyricSyllableX(svg, "three"), noteX(svg, 2));
  assert.equal(lyricSyllableX(svg, "four"), noteX(svg, 3));
  assert.doesNotMatch(svg, /<text class="lyric-syllable"[^>]*>_<\/text>/);
});

test("renders lyric merge placeholders without filler text", () => {
  const result = parse('1 2 3 4\n"held ~ next _"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.equal(lyricSyllableX(svg, "held"), (noteX(svg, 0) + noteX(svg, 1)) / 2);
  assert.equal(lyricSyllableX(svg, "next"), noteX(svg, 2));
  assert.doesNotMatch(svg, /<text class="lyric-syllable"[^>]*>~<\/text>/);
  assert.doesNotMatch(svg, /<text class="lyric-syllable"[^>]*>_<\/text>/);
});

test("aligns automatic Chinese lyric syllables under notes", () => {
  const result = parse('1 2 3\n@"春天来"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.equal(lyricSyllableX(svg, "春"), noteX(svg, 0));
  assert.equal(lyricSyllableX(svg, "天"), noteX(svg, 1));
  assert.equal(lyricSyllableX(svg, "来"), noteX(svg, 2));
});

test("renders automatic hyphenated English lyric syllables", () => {
  const result = parse('1 2 3 4 5\n@"sev-en glo-ri-a"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });
  assert.equal(lyricSyllableX(svg, "sev-"), noteX(svg, 0));
  assert.equal(lyricSyllableX(svg, "en"), noteX(svg, 1));
  assert.equal(lyricSyllableX(svg, "glo-"), noteX(svg, 2));
  assert.equal(lyricSyllableX(svg, "ri-"), noteX(svg, 3));
  assert.equal(lyricSyllableX(svg, "a"), noteX(svg, 4));
});

test("does not expand note spacing for lyric merge placeholder targets", () => {
  const blank = parse('1 2 3 4\n"shine _ on _"');
  const merged = parse('1 2 3 4\n"shine ~ on _"');
  assert.equal(blank.ok, true);
  assert.equal(merged.ok, true);
  const blankSvg = renderSvg(blank.value, { pageWidth: 180 });
  const mergedSvg = renderSvg(merged.value, { pageWidth: 180 });
  assert.equal(noteX(mergedSvg, 1), noteX(blankSvg, 1));
  assert.equal(lyricSyllableX(mergedSvg, "shine"), (noteX(mergedSvg, 0) + noteX(mergedSvg, 1)) / 2);
  assert.equal(lyricSyllableX(mergedSvg, "on"), noteX(mergedSvg, 2));
});

test("keeps excess lyric syllables as a normal lyric line", () => {
  const result = parse('1 2\n"one two three"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.match(svg, /<text class="lyric-line" x="18" y="\d+" text-anchor="start">one two three<\/text>/);
  assert.doesNotMatch(svg, /<text class="lyric-syllable"/);
});

test("keeps excess automatic lyric syllables as a normal lyric line", () => {
  const result = parse('1 2\n@"春天来"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.match(svg, /<text class="lyric-line" x="18" y="\d+" text-anchor="start">春天来<\/text>/);
  assert.doesNotMatch(svg, /<text class="lyric-syllable"/);
});

test("expands lyric syllable anchors to avoid English lyric overlap", () => {
  const result = parse('1 2\n"wonderful evening"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });
  const wonderfulX = lyricSyllableX(svg, "wonderful");
  const eveningX = lyricSyllableX(svg, "evening");
  assert.ok(eveningX - wonderfulX >= 70);
});

test("reserves left space for the first aligned lyric syllable", () => {
  const result = parse('1 2\n"wonderful evening"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });
  const leftEdge = lyricSyllableX(svg, "wonderful") - lyricEstimatedWidth("wonderful") / 2;
  assert.ok(leftEdge >= 18);
});

test("keeps aligned lyric syllables inside page margins", () => {
  const result = parse('1 2\n"wonderful evening"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, pageMargin: 40 });
  assert.match(svg, /<g class="page-content" transform="translate\(40, 40\)">/);
  const leftEdge = lyricSyllableX(svg, "wonderful") - lyricEstimatedWidth("wonderful") / 2;
  assert.ok(leftEdge >= 18);
});

test("reserves right space for the final aligned lyric syllable", () => {
  const result = parse('1 2\n"wonderful evening"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });
  const rightEdge = lyricSyllableX(svg, "evening") + lyricEstimatedWidth("evening") / 2;
  assert.ok(rightEdge <= 260);
});

test("uses the widest lyric syllable in each aligned slot", () => {
  const result = parse('1 2\n"hi evening"\n"wonderful by"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });
  assert.ok(lyricSyllableX(svg, "evening") - lyricSyllableX(svg, "hi") >= 70);
  assert.equal(lyricSyllableX(svg, "wonderful"), lyricSyllableX(svg, "hi"));
  assert.equal(lyricSyllableX(svg, "by"), lyricSyllableX(svg, "evening"));
});

test("keeps lyric-expanded multi-track rhythm anchors aligned", () => {
  const result = parse('T1: 1 2\nT2: 5, 6,\n"wonderful evening"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });
  assert.equal(noteX(svg, 0), noteX(svg, 2));
  assert.equal(noteX(svg, 1), noteX(svg, 3));
  assert.ok(noteX(svg, 1) - noteX(svg, 0) >= 70);
});

test("renders overwide aligned lyrics as a normal lyric line", () => {
  const result = parse('1 2\n"supercalifragilisticexpialidocious tiny"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 100 });
  assert.match(svg, /<text class="lyric-line" x="18" y="\d+" text-anchor="start">supercalifragilisticexpialidocious tiny<\/text>/);
  assert.doesNotMatch(svg, /<text class="lyric-syllable"/);
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

test("renders velocity text in SVG for notes with dynamic markings", () => {
  const result = parse("f 1 p 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /<text class="velocity"[^>]*>f<\/text>/);
  assert.match(svg, /<text class="velocity"[^>]*>p<\/text>/);
});

test("renders hairpins in SVG", () => {
  const result = parse("p < 1 2 3 f < 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /\.hairpin \{ stroke: currentColor/);
  assert.equal(svg.match(/class="hairpin"/g)?.length, 2);
  assert.match(svg, /<line class="hairpin" x1="18" y1="[^"]+" x2="90" y2="[^"]+"\/>/);
});

test("renders hairpins split across visual lines as separate hairpins", () => {
  const result = parse("p < 1 2 | 3 f < 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 70 });
  assert.ok((svg.match(/class="hairpin"/g)?.length ?? 0) >= 4);
});

test("renders hairpins across source lines on the same track", () => {
  const result = parse("p < 1 2\n3 f < 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.equal(svg.match(/class="hairpin"/g)?.length, 4);
});

test("separates opposite hairpins that meet on one note", () => {
  const result = parse("p < 1 2 f <> 3 4 p > 5");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const hairpinLines = [...svg.matchAll(/<line class="hairpin" x1="([^"]+)" y1="[^"]+" x2="([^"]+)"/g)];
  assert.equal(hairpinLines.length, 4);
  const firstEndX = Number(hairpinLines[0][2]);
  const secondStartX = Number(hairpinLines[2][1]);
  assert.equal(firstEndX, noteX(svg, 2) - 3);
  assert.equal(secondStartX, noteX(svg, 2) + 3);
});

test("raises hairpins above colocated dynamic markings", () => {
  const result = parse("p < 1 f < 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const hairpinYs = [...svg.matchAll(/<line class="hairpin" x1="[^"]+" y1="([^"]+)" x2="[^"]+" y2="([^"]+)"/g)].flatMap((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
  const velocityY = Number(svg.match(/<text class="velocity" x="18" y="([^"]+)"/)?.[1]);
  assert.ok(Number.isFinite(velocityY));
  assert.ok(Math.max(...hairpinYs) <= velocityY - 14);
});
