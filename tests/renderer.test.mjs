import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "../dist/parser/index.js";
import { analyzeScoreLayout, analyzeScoreOverwidth, embedBravuraFontFace, inferContentPageWidth, PAPER_PRESET_LIST, renderSvg, renderSvgPages, resolvePageSize, svgUsesSmuflSymbols } from "../dist/renderer/index.js";

function readSnapshot(name) {
  return readFileSync(new URL(`./fixtures/snapshots/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
}

const minimalSnapshot = readSnapshot("minimal.svg");
const fullHeaderSnapshot = readSnapshot("full-header.svg");
const hiddenHeaderSnapshot = readSnapshot("hidden-header.svg");
const notationFeaturesSnapshot = readSnapshot("notation-features.svg");

function parseWithSlurCounts(source, counts) {
  const result = parse(source);
  assert.equal(result.ok, true);
  assert.equal(result.value.slurs.length, counts.length);
  result.value.slurs.forEach((slur, index) => {
    slur.noteCount = counts[index];
  });
  return result;
}

function noteX(svg, noteIndex) {
  const match = svg.match(
    new RegExp(`<g class="note-item(?: active)?" data-note-index="${noteIndex}">[\\s\\S]*?<text class="note" x="([^"]+)"`),
  );
  assert.ok(match, `note ${noteIndex} should render`);
  return Number(match[1]);
}

function lyricSyllableX(svg, text) {
  const match = svg.match(new RegExp(`<text class="lyric-syllable(?: lyric-latin)?" x="([^"]+)" y="[^"]+" text-anchor="middle">${text}</text>`));
  assert.ok(match, `lyric syllable ${text} should render`);
  return Number(match[1]);
}

function lyricEstimatedWidth(text) {
  return [...text].reduce((sum, char) => {
    if (/\s/u.test(char)) {
      return sum + 3.5;
    }
    if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(char)) {
      return sum + 17;
    }
    if (/\p{Script=Latin}|\p{N}/u.test(char)) {
      return sum + 6.5;
    }
    if (/[\p{P}\p{S}]/u.test(char)) {
      return sum + 4;
    }
    return sum + 8;
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

function scoreHorizontalScale(svg) {
  return Number(svg.match(/<g class="score-group scaled" transform="scale\(([^,]+),1\)">/)?.[1] ?? 1);
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

function pathYValues(path) {
  return [...path.matchAll(/,(-?\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
}

function slurPaths(svg) {
  return [...svg.matchAll(/<path class="slur" d="([^"]+)"/g)].map((match) => match[1]);
}

function slurCounts(svg) {
  return [...svg.matchAll(/<text class="slur-count" x="([^"]+)" y="([^"]+)"[^>]*>(\d+)<\/text>/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    count: Number(match[3]),
  }));
}

function slidePaths(svg) {
  return [...svg.matchAll(/<path class="ornament slide" d="([^"]+)"\/>/g)].map((match) => match[1]);
}

function slideArrowPaths(svg) {
  return [...svg.matchAll(/<path class="slide-arrow" d="([^"]+)"/g)].map((match) => match[1]);
}

function pathEnd(path) {
  const match = path.match(/ ([^, ]+),([^ ]+)$/);
  assert.ok(match, "slide path should have an endpoint");
  return [Number(match[1]), Number(match[2])];
}

function pathStart(path) {
  const match = path.match(/^M([^,]+),([^ ]+)/);
  assert.ok(match, "slide path should have a start point");
  return [Number(match[1]), Number(match[2])];
}

function pathPoints(path) {
  return [...path.matchAll(/(?:M|L)([^,]+),([^ ]+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
}

function arrowBaseCenter(path) {
  const match = path.match(/M[^ ]+ L([^,]+),([^ ]+) L([^,]+),([^ ]+) Z$/);
  assert.ok(match, "slide arrow should have two base corners");
  return [(Number(match[1]) + Number(match[3])) / 2, (Number(match[2]) + Number(match[4])) / 2];
}

function slideArcRadii(path) {
  const match = path.match(/ A([^,]+),([^ ]+) /);
  assert.ok(match, "slide should use an SVG arc with explicit radii");
  return [Number(match[1]), Number(match[2])];
}

function trillExtension(svg) {
  const match = svg.match(/<path class="ornament trill-extension" d="M([^,]+),([^ ]+) ([^"]+)"\/>/);
  assert.ok(match, "long trill extension should render");
  const end = match[3].match(/ ([^, ]+),([^ ]+)$/);
  assert.ok(end, "long trill extension should end on its baseline");
  return {
    startX: Number(match[1]),
    startY: Number(match[2]),
    endX: Number(end[1]),
    endY: Number(end[2]),
    path: match[0],
  };
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

test('does not render slides between notes at the same pitch', () => {
  const result = parse('1(~) 1 0 0');
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics[0]?.severity, 'warning');
  const svg = renderSvg(result.value);
  assert.equal(slidePaths(svg).length, 0);
  assert.equal(slideArrowPaths(svg).length, 0);
});

test("renders time signatures as stacked digits", () => {
  const result = parse(`time: 4/4\n===\n1 2 3 4`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 360, color: "#111827", background: "#ffffff" });
  assert.match(svg, /<g class="time-signature">/);
  assert.match(svg, /<text x="\d+" y="30" text-anchor="middle" dominant-baseline="central">4<\/text>/);
  assert.match(svg, /<line class="time-signature-line" x1="\d+" y1="40" x2="\d+" y2="40"\/>/);
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

test("keeps an overwide tied source line intact", () => {
  const result = parse("1 - | ~1 - | 2 3 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 70, color: "#111827", background: "#ffffff" });
  assert.equal(svg.match(/class="score-group scaled"/g)?.length, 1);
  assert.equal(tiePaths(svg).length, 1);
  assert.equal(svg.match(/class="note-item"/g)?.length, 4);
});

test("keeps an overwide slurred source line intact", () => {
  const result = parse("$(1 2 | 3 4 | 5 6)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 100, color: "#111827", background: "#ffffff" });
  assert.equal(svg.match(/class="score-group scaled"/g)?.length, 1);
  assert.equal(slurPaths(svg).length, 1);
  assert.equal(svg.match(/class="note-item"/g)?.length, 6);
});

test("paginates source-line groups into fixed-height page groups", () => {
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
  assert.match(page2, /<g class="score-group scaled"/);
  assert.match(page2, /<text class="note" x="[^"]+" y="41"/);
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

test("renders cumulative measure numbers above the first measure of each score line", () => {
  const result = parse(`measureNumbers: true\n===\n1 2 | 3 4 |\n5 6 | 7 1' |`);
  assert.equal(result.ok, true);

  const fromHeader = renderSvg(result.value, { pageWidth: 320 });
  assert.deepEqual([...fromHeader.matchAll(/class="measure-number"[^>]*>\((\d+)\)<\/text>/g)].map((match) => match[1]), ["1", "3"]);
  assert.match(fromHeader, /<text class="measure-number" x="0" y="\d+" text-anchor="start">\(1\)<\/text>/);

  const overridden = renderSvg(result.value, { pageWidth: 320, measureNumbers: false });
  assert.doesNotMatch(overridden, /class="measure-number"/);
});

test("renders one measure number for each simultaneous score group", () => {
  const result = parse(`T1: 1 | 2 |\nT2: 3 | 4 |\nT1: 5 |\nT2: 6 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 320, measureNumbers: true });
  assert.deepEqual([...svg.matchAll(/class="measure-number"[^>]*>\((\d+)\)<\/text>/g)].map((match) => match[1]), ["1", "3"]);
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
  const result = parse("1 2 | 3 - |\n~3 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 160, justifyMode: "all", background: "#ffffff" });
  const paths = tiePaths(svg);
  assert.equal(paths.length, 2);
  assert.match(paths[0], /^M[^ ]+ Q[^ ]+ [^ ]+ L[^ ]+ Q[^ ]+ [^ ]+ Z$/);
  assert.match(paths[1], /^M0\.5,[^ ]+ Q[^ ]+ [^ ]+ Q[^ ]+ [^ ]+ Z$/);
});

test("keeps short slurs close to their notes and adjacent slurs separate", () => {
  const result = parse("$(11)$(22)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const paths = slurPaths(svg);
  assert.equal(paths.length, 2);
  assert.equal(pathStart(paths[0])[0], noteX(svg, 0) - 4);
  assert.equal(pathEnd(paths[0])[0], noteX(svg, 1) + 4);
  assert.ok(pathEnd(paths[0])[0] < pathStart(paths[1])[0]);
  assert.equal(pathStart(paths[0])[1], pathStart(paths[1])[1]);
});

test("keeps a short slur curved when an unrelated tall chord shares its line", () => {
  const render = (source) => {
    const result = parse(source);
    assert.equal(result.ok, true);
    const svg = renderSvg(result.value);
    const path = slurPaths(svg)[0];
    const baseline = notePosition(svg, 0).y;
    return pathYValues(path).map((y) => baseline - y);
  };
  assert.deepEqual(render("$(11) 2 3 {1 3 5}"), render("$(11)"));
});

test("renders slurs outside ties and ornaments", () => {
  const result = parse("$(1(^) 2 ~2 3)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /\.slur \{ fill: none; stroke: currentColor; stroke-width: 1\.5; stroke-linecap: butt; \}/);
  assert.equal(slurPaths(svg).length, 1);
  assert.equal(tiePaths(svg).length, 1);
  const slurPath = slurPaths(svg)[0];
  const startNote = notePosition(svg, 0);
  const endNote = notePosition(svg, 3);
  assert.match(slurPath, /^M[^ ]+ Q[^ ]+ [^ ]+ L[^ ]+ Q[^ ]+ [^ ]+$/);
  assert.ok(pathStart(slurPath)[0] <= startNote.x - 16);
  assert.equal(pathEnd(slurPath)[0], endNote.x + 4);
  const slurControlY = Number(slurPath.match(/Q[^,]+,([^ ]+)/)?.[1]);
  const tieTopY = Math.min(...tiePaths(svg)[0].match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, index) => index % 2 === 1));
  assert.ok(slurControlY < tieTopY);
});

test("stacks nested slurs in separate lanes", () => {
  const result = parse("$($(1 2) 3 4)");
  assert.equal(result.ok, true);
  const paths = slurPaths(renderSvg(result.value));
  assert.equal(paths.length, 2);
  const controlYs = paths.map((path) => Number(path.match(/Q[^,]+,([^ ]+)/)?.[1]));
  assert.ok(Math.min(...controlYs) < Math.max(...controlYs));
  const startXs = paths.map((path) => pathStart(path)[0]);
  const endXs = paths.map((path) => pathEnd(path)[0]);
  assert.ok(Math.min(...startXs) < Math.max(...startXs));
  assert.ok(Math.min(...endXs) < Math.max(...endXs));
  assert.equal(pathStart(paths[0])[1], pathStart(paths[1])[1]);
  assert.equal(pathEnd(paths[0])[1], pathEnd(paths[1])[1]);
});

test("keeps slur endpoint curves outside anchored upper marks", () => {
  const sources = [
    "$(1(^) 2)",
    "$(1 2(^))",
    "$(1(.) 2)",
    "$(1 2(.))",
    "$(1(tr) 2(v))",
    "$(1(<2345) 2)",
    "$(1 2(>2345))",
    "$(p1 f2)",
    "$(<1 <2)",
  ];
  for (const source of sources) {
    const result = parse(source);
    assert.equal(result.ok, true, source);
    const svg = renderSvg(result.value);
    const path = slurPaths(svg)[0];
    const firstX = noteX(svg, 0);
    const lastX = noteX(svg, 1);
    assert.ok(pathStart(path)[0] <= firstX - 4, `${source} start should clear its anchor`);
    assert.ok(pathEnd(path)[0] >= lastX + 4, `${source} end should clear its anchor`);
    const notes = result.value.score[0].measures.flatMap((measure) => measure.notes);
    if (notes[0].ornament || notes[0].velocity !== undefined) {
      assert.ok(pathStart(path)[0] <= firstX - 16, `${source} start should clear its upper mark`);
    }
    if (notes[1].ornament || notes[1].velocity !== undefined) {
      assert.ok(pathEnd(path)[0] >= lastX + 16, `${source} end should clear its upper mark`);
    }
  }
});

test("renders a note count including endpoints in a gap on a counted slur platform", () => {
  const result = parseWithSlurCounts("$(1 {2 4} 3 4)", [4]);
  const ordinary = parse("$(1 {2 4} 3 4)");
  assert.equal(result.ok, true);
  assert.equal(ordinary.ok, true);
  const svg = renderSvg(result.value);
  const ordinarySvg = renderSvg(ordinary.value);
  assert.match(svg, /\.slur-count \{ fill: currentColor;[^}]*font-size: 12px;/);
  assert.deepEqual(slurCounts(svg).map(({ count }) => count), [4]);
  assert.match(slurPaths(svg)[0], /^M[^ ]+ Q[^ ]+ [^ ]+ L[^ ]+ M[^ ]+ L[^ ]+ Q[^ ]+ [^ ]+$/);
  assert.equal(Number(svg.match(/<svg[^>]* height="([^"]+)"/)?.[1]), Number(ordinarySvg.match(/<svg[^>]* height="([^"]+)"/)?.[1]) + 5.25);

  const nested = parseWithSlurCounts("$($(1 2 3) 4)", [4, 3]);
  const nestedCounts = slurCounts(renderSvg(nested.value));
  assert.deepEqual(nestedCounts.map(({ count }) => count), [4, 3]);
  assert.notEqual(nestedCounts[0].y, nestedCounts[1].y);
});

test("keeps a slur on its source line when the group moves to a new page", () => {
  const result = parse("$(1 2 | 3 4 | 5 6 | 7 1')");
  assert.equal(result.ok, true);
  const narrow = renderSvg(result.value, { pageWidth: 100, justifyMode: "all" });
  const narrowPaths = slurPaths(narrow);
  assert.equal(narrowPaths.length, 1);
  assert.match(narrowPaths[0], /^M[^ ]+ Q[^ ]+ [^ ]+ L[^ ]+ Q[^ ]+ [^ ]+$/);
  const paged = renderSvg(result.value, { pageWidth: 100, paginate: true, pageHeight: 100 });
  assert.ok((paged.match(/class="page" data-page=/g)?.length ?? 0) > 1);
  assert.equal(slurPaths(paged).length, 1);
});

test("keeps cross-page slur continuation strokes inside the page viewport", () => {
  const result = parseWithSlurCounts("$(1\n---\n2)", [2]);
  const pages = renderSvgPages(result.value, { pageWidth: 220, paginate: true, pageHeight: 160 });
  assert.equal(pages.length, 2);
  assert.match(pages[1].svg, /\.slur \{[^}]*stroke-width: 1\.5;/);
  assert.match(slurPaths(pages[1].svg)[0], /^M0\.75,/);
});

test("renders a counted slur label once on its midpoint source line", () => {
  const result = parseWithSlurCounts("$(1 2 | 3 4 | 5 6 | 7 1')", [8]);
  const svg = renderSvg(result.value, { pageWidth: 100, justifyMode: "all" });
  assert.deepEqual(slurCounts(svg).map(({ count }) => count), [8]);
  assert.equal(slurPaths(svg).filter((path) => / M[^ ]+ L/.test(path)).length, 1);
});

test("keeps slurs on their own track in multi-voice groups", () => {
  const result = parse(`T1: 1 2
T2: $(5, 6,
T1: 3 4
T2: 7, 1)`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 220 });
  assert.equal(slurPaths(svg).length, 2);
  const firstT2 = notePosition(svg, 2);
  assert.equal(pathStart(slurPaths(svg)[0])[0], firstT2.x - 4);
});

test("connects ties to the previous note in the same track", () => {
  const result = parse("T1: 1 2\nT2: 5, -\nT1: 3 4\nT2: ~5, 6,");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 220 });
  const secondT1 = notePosition(svg, 4);
  const secondT2Tied = notePosition(svg, 5);
  const paths = tiePaths(svg);
  const incomingTie = paths.find((path) => path.startsWith("M16.5,") && path.includes(`${secondT2Tied.x},`));
  assert.ok(incomingTie, "incoming tie should render into the tied T2 note");
  const tiedEndpoint = incomingTie.match(new RegExp(` ${secondT2Tied.x},([^ ]+)(?: |$)`));
  assert.ok(tiedEndpoint);
  assert.ok(Number(tiedEndpoint[1]) < secondT2Tied.y - 24);
  assert.equal(
    paths.some((path) => path.startsWith(`M${secondT1.x},`) && path.includes(` ${secondT2Tied.x},${tiedEndpoint[1]}`)),
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

test("keeps score measures on one source line when page width is narrow", () => {
  const result = parse("1 2 | 3 4 | 5 6 | 7 1' |");
  assert.equal(result.ok, true);
  const wide = renderSvg(result.value, { pageWidth: 1000 });
  const narrow = renderSvg(result.value, { pageWidth: 120 });
  const wideHeight = Number(wide.match(/height="([^"]+)"/)?.[1]);
  const narrowHeight = Number(narrow.match(/height="([^"]+)"/)?.[1]);
  assert.equal(narrowHeight, wideHeight);
  assert.equal(narrow.match(/class="score-group scaled"/g)?.length, 1);
});

test("justifies all score lines by stretching note positions", () => {
  const result = parse("1//2//3//4// 5- 6/ | 7 |\n5 6 7 |");
  assert.equal(result.ok, true);
  const natural = renderSvg(result.value, { pageWidth: 320, background: "#ffffff" });
  assert.match(natural, /<g class="note-item" data-note-index="1"><text class="note" x="42" y="104" text-anchor="middle">2<\/text>/);
  assert.match(natural, /<g class="note-item" data-note-index="5"><text class="note" x="162" y="104" text-anchor="middle">6<\/text>/);
  assert.match(natural, /<line class="dash" x1="128" y1="95" x2="144" y2="95"/);
  assert.match(natural, /<line class="underline" x1="152" y1="109" x2="172" y2="109"/);
  assert.match(natural, /<g class="note-item" data-note-index="8"><text class="note" x="42" y="158" text-anchor="middle">6<\/text><\/g>/);

  const justified = renderSvg(result.value, { pageWidth: 320, justifyMode: "except-last", background: "#ffffff" });
  assert.match(justified, /<g class="note-item" data-note-index="1"><text class="note" x="42" y="104" text-anchor="middle">2<\/text>/);
  assert.match(justified, /<g class="note-item" data-note-index="5"><text class="note" x="[^"]+" y="104" text-anchor="middle">6<\/text>/);
  assert.doesNotMatch(justified, /<g class="note-item" data-note-index="5"><text class="note" x="162" y="104" text-anchor="middle">6<\/text>/);
  assert.match(justified, /<line class="dash" x1="[^"]+" y1="95" x2="[^"]+" y2="95"/);
  assert.doesNotMatch(justified, /<line class="dash" x1="128" y1="95" x2="144" y2="95"/);
  assert.match(justified, /<line class="underline" x1="[^"]+" y1="109" x2="[^"]+" y2="109"/);
  assert.doesNotMatch(justified, /<line class="underline" x1="152" y1="109" x2="172" y2="109"/);
  assert.match(justified, /<g class="note-item" data-note-index="8"><text class="note" x="42" y="158" text-anchor="middle">6<\/text><\/g>/);
  assert.match(justified, /<line class="bar-thin" x1="314"/);

  const allLines = renderSvg(result.value, { pageWidth: 320, justifyMode: "all", background: "#ffffff" });
  assert.match(allLines, /<g class="note-item" data-note-index="8"><text class="note" x="[^"]+" y="158" text-anchor="middle">6<\/text><\/g>/);
  assert.doesNotMatch(allLines, /<g class="note-item" data-note-index="8"><text class="note" x="42" y="158" text-anchor="middle">6<\/text><\/g>/);
});

test("keeps duration dashes aligned after accidentals", () => {
  const result = parse("#1- 2 |");
  assert.equal(result.ok, true);
  const natural = renderSvg(result.value, { pageWidth: 160, background: "#ffffff" });
  assert.equal(dashCenterX(natural, 0) - noteX(natural, 0), 24);

  const justified = renderSvg(result.value, { pageWidth: 260, justifyMode: "all", background: "#ffffff" });
  assert.equal(dashCenterX(justified, 0) - noteX(justified, 0), 24);
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
  assert.match(svg, /<g class="score-group scaled" transform="scale\(0\.\d+,1\)">/);
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

test("reports unified score lyric and page layout warnings", () => {
  const result = parse('1--- 2--- 3--- 4---\n"supercalifragilisticexpialidocious"');
  assert.equal(result.ok, true);
  const warnings = analyzeScoreLayout(result.value, {
    pageWidth: 100,
    paginate: true,
    pageHeight: 180,
    pageMargin: 50,
    pageNumbers: true,
  });
  assert.ok(warnings.some((warning) => warning.kind === "overwide-score-group"));
  assert.ok(warnings.some((warning) => warning.kind === "overwide-lyric"));
  assert.ok(warnings.some((warning) => warning.kind === "overheight-group"));
  assert.ok(warnings.some((warning) => warning.kind === "small-usable-page-height"));
});

test("does not report automatic source-line wrapping", () => {
  const result = parse("1 2 | 3 4 | 5 6 | 7 1' |");
  assert.equal(result.ok, true);
  const warnings = analyzeScoreOverwidth(result.value, 120);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].kind, "overwide-line");
  assert.equal(warnings[0].range.start.line, 1);
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

test("renders conventional mordent glyphs and keeps ornaments spaced", () => {
  const result = parse("#1'(^) 2(v)- 3(z) 4(s) 5(tr)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 220 });
  assert.doesNotMatch(svg, /data:font\/woff2;base64,/);
  assert.match(svg, /<text class="ornament mordent smufl-symbol" x="[^"]+" y="[^"]+" text-anchor="middle">&#xE56C;<\/text>/);
  assert.match(svg, /<text class="ornament mordent smufl-symbol" x="[^"]+" y="[^"]+" text-anchor="middle">&#xE56D;<\/text>/);
  assert.ok(svg.indexOf("&#xE56C;") < svg.indexOf("&#xE56D;"), "upper mordent should use the plain glyph before the lower crossed glyph");
  assert.match(svg, /<text class="ornament turn smufl-symbol" x="[^"]+" y="[^"]+" text-anchor="middle">&#xE567;<\/text>/);
  assert.match(svg, /<text class="ornament turn smufl-symbol" x="[^"]+" y="[^"]+" text-anchor="middle">&#xE569;<\/text>/);
  assert.match(svg, /<text class="ornament trill smufl-symbol" x="[^"]+" y="[^"]+" text-anchor="middle">&#xE566;<\/text>/);
  assert.doesNotMatch(svg, /<path class="ornament mordent"/);
  assert.match(svg, /\.smufl-symbol \{[^}]*pointer-events: none;/);
  assert.ok(noteX(svg, 1) - noteX(svg, 0) >= 24);
});

test("renders fermatas above notes, chords, rests, and drums", () => {
  const result = parse("1(.) {1 3 5}(.) 0(.) X(.)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const fermatas = [...svg.matchAll(/<text class="ornament fermata smufl-symbol" x="([^"]+)" y="([^"]+)" text-anchor="middle">&#xE4C0;<\/text>/g)];
  assert.equal(fermatas.length, 4);
  for (const match of fermatas) {
    assert.ok(Number(match[2]) < notePosition(svg, fermatas.indexOf(match)).y);
  }
});

test("renders whole-chord ornaments above the chord", () => {
  const result = parse("{1 3 5}(^) {1 3 5}(tr~)- {1 3 5}(<2)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const chordTopY = Math.min(...[...svg.matchAll(/<text class="note" x="[^"]+" y="([^"]+)" text-anchor="middle">[135]<\/text>/g)].map((match) => Number(match[1])));
  const ornamentY = Number(svg.match(/<text class="ornament mordent smufl-symbol" x="[^"]+" y="([^"]+)"/)?.[1]);
  assert.ok(ornamentY < chordTopY);
  assert.match(svg, /<text class="ornament trill smufl-symbol"/);
  assert.match(svg, /<g class="grace-note-group"/);
});

test("renders rising, falling, and horizontally scaled slide segments", () => {
  const result = parse("1(~) 5 5(~) 1");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const paths = slidePaths(svg);
  assert.equal(paths.length, 2);
  assert.match(paths[0], / A[^ ]+,[^ ]+ 0 0 0 /, "rising slide should use an upward quarter-circle arc");
  assert.match(paths[1], / A[^ ]+,[^ ]+ 0 0 1 /, "falling slide should use a downward quarter-circle arc");
  const arrows = slideArrowPaths(svg);
  assert.equal(arrows.length, 2);
  assert.deepEqual(pathEnd(paths[0]), arrowBaseCenter(arrows[0]));
  assert.deepEqual(pathEnd(paths[1]), arrowBaseCenter(arrows[1]));
  for (const [sourceIndex, slideIndex] of [[0, 0], [2, 1]]) {
    const source = notePosition(svg, sourceIndex);
    const points = [pathStart(paths[slideIndex]), pathEnd(paths[slideIndex]), ...pathPoints(arrows[slideIndex])];
    assert.ok(Math.min(...points.map(([x]) => x)) > source.x, "slide mark should stay to the right of its source note");
    assert.ok(Math.max(...points.map(([, y]) => y)) <= source.y - 12, "slide mark should stay in the source note's upper-right area");
  }

  const narrow = parse("1 2 3 4(~) | 5 6 7 1'");
  assert.equal(narrow.ok, true);
  const narrowSvg = renderSvg(narrow.value, { pageWidth: 120 });
  const narrowPaths = slidePaths(narrowSvg);
  assert.equal(narrowPaths.length, 1);
  assert.equal(slideArrowPaths(narrowSvg).length, 1);
});

test("keeps slide radius fixed when the target note position changes", () => {
  const compact = parse("1(~) 5");
  const extended = parse("1(~)--- 5");
  assert.equal(compact.ok, true);
  assert.equal(extended.ok, true);
  const compactPath = slidePaths(renderSvg(compact.value))[0];
  const extendedPath = slidePaths(renderSvg(extended.value))[0];
  const extendedSvg = renderSvg(extended.value);
  const justifiedPath = slidePaths(renderSvg(compact.value, { pageWidth: 320, justifyMode: "all" }))[0];
  assert.deepEqual(slideArcRadii(compactPath), [6, 6]);
  assert.deepEqual(slideArcRadii(extendedPath), [6, 6]);
  assert.deepEqual(slideArcRadii(justifiedPath), [6, 6]);
  const extendedArrow = slideArrowPaths(extendedSvg)[0];
  const arrowCoordinates = [...extendedArrow.matchAll(/(?:M|L)([^,]+),([^ ]+)/g)].map((match) => Number(match[1]));
  const firstDashX = Number(extendedSvg.match(/<line class="dash" x1="([^"]+)"/)?.[1]);
  assert.ok(firstDashX > Math.max(...arrowCoordinates), "duration dash should start after the fixed slide mark");
});

test("renders long trill extensions within their visual duration slots", () => {
  const plain = parse("1(tr) 2");
  assert.equal(plain.ok, true);
  assert.doesNotMatch(renderSvg(plain.value), /<path class="ornament trill-extension"/);

  const tooShort = parse("1(tr~) 2");
  assert.equal(tooShort.ok, true);
  assert.match(
    tooShort.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Long trill extension needs at least one duration dash/,
  );
  assert.doesNotMatch(renderSvg(tooShort.value), /<path class="ornament trill-extension"/);

  const beforeNote = parse("1(tr~)- 2-");
  assert.equal(beforeNote.ok, true);
  const beforeNoteSvg = renderSvg(beforeNote.value, { pageWidth: 180 });
  const nextOnsetExtension = trillExtension(beforeNoteSvg);
  const trillGlyphY = Number(
    beforeNoteSvg.match(/<text class="ornament trill smufl-symbol" x="[^"]+" y="([^"]+)"/)?.[1],
  );
  assert.equal(nextOnsetExtension.startX, noteX(beforeNoteSvg, 0) + 9);
  assert.equal(nextOnsetExtension.endX, noteX(beforeNoteSvg, 1) - 8);
  assert.equal(nextOnsetExtension.startY, trillGlyphY - 4);
  assert.equal(nextOnsetExtension.startY, nextOnsetExtension.endY);
  assert.match(nextOnsetExtension.path, / Q/);

  const short = parse("1(tr~)- | 2");
  const long = parse("1(tr~)-- | 2");
  assert.equal(short.ok, true);
  assert.equal(long.ok, true);
  const shortSvg = renderSvg(short.value, { pageWidth: 180 });
  const longSvg = renderSvg(long.value, { pageWidth: 180 });
  const shortExtension = trillExtension(shortSvg);
  const longExtension = trillExtension(longSvg);
  assert.ok(longExtension.endX - longExtension.startX > shortExtension.endX - shortExtension.startX);
  const firstBarX = Number(longSvg.match(/<line class="bar-thin" x1="([^"]+)"/)?.[1]);
  assert.equal(longExtension.endX, firstBarX - 8);

  const final = parse("1(tr~)-");
  assert.equal(final.ok, true);
  const finalSvg = renderSvg(final.value, { pageWidth: 180 });
  const finalBarX = Number(finalSvg.match(/<line class="bar-thin" x1="([^"]+)"/)?.[1]);
  assert.equal(trillExtension(finalSvg).endX, finalBarX - 8);

  const justified = parse("1(tr~)- 2- | 3");
  assert.equal(justified.ok, true);
  const justifiedSvg = renderSvg(justified.value, { pageWidth: 260, justifyMode: "all" });
  assert.equal(trillExtension(justifiedSvg).endX, noteX(justifiedSvg, 1) - 8);
});

test("renders grace ornaments beside their anchor notes", () => {
  const result = parse("1(<2) 3(>4)- 5");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 140 });
  const firstAnchor = noteX(svg, 0);
  const secondAnchor = noteX(svg, 1);
  const followingAnchor = noteX(svg, 2);
  const graceGroups = [...svg.matchAll(/<g class="grace-note-group" transform="translate\(([^,]+), ([^)]+)\) scale\(([^)]+)\)">([\s\S]*?)<\/g>/g)]
    .map((match) => {
      const localNote = match[4].match(/<text class="note" x="([^"]+)" y="[^"]+" text-anchor="middle">([1-7])<\/text>/);
      const localUnderline = match[4].match(/<line class="underline" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="[^"]+"\/>/);
      assert.ok(localNote);
      assert.ok(localUnderline);
      const translateX = Number(match[1]);
      const translateY = Number(match[2]);
      const scale = Number(match[3]);
      return {
        text: localNote[2],
        x: translateX + Number(localNote[1]) * scale,
        underlineMiddleX: translateX + ((Number(localUnderline[1]) + Number(localUnderline[3])) / 2) * scale,
        underlineBottomY: translateY + (Number(localUnderline[2]) + 1.25) * scale,
      };
    });
  const beforeGrace = graceGroups.find((note) => note.text === "2");
  const afterGrace = graceGroups.find((note) => note.text === "4");
  assert.ok(beforeGrace);
  assert.ok(afterGrace);
  assert.ok(beforeGrace.x < firstAnchor);
  assert.ok(afterGrace.x > secondAnchor);
  assert.ok(followingAnchor > secondAnchor);
  assert.equal(graceGroups.length, 2);
  assert.match(svg, /<g class="grace-note-group" transform="translate\([^"]+\) scale\([^"]+\)">/);
  assert.match(svg, /<line class="underline"/);
  assert.match(svg, /\.grace-arc \{ stroke-width: 1; stroke-linecap: butt; stroke-linejoin: miter; \}/);
  const graceArcs = [...svg.matchAll(/<path class="ornament grace-arc" d="M([^,]+),([^ ]+) A([^,]+),\3 0 0 0 ([^,]+),([^"]+)"/g)]
    .map((match) => ({
      startX: Number(match[1]),
      startY: Number(match[2]),
      radius: Number(match[3]),
      endX: Number(match[4]),
      endY: Number(match[5]),
    }));
  assert.equal(graceArcs.length, 2);
  assert.ok(Math.abs(graceArcs[0].startX - beforeGrace.underlineMiddleX) < 0.0001);
  assert.ok(Math.abs(graceArcs[0].startY - beforeGrace.underlineBottomY) < 0.0001);
  assert.ok(Math.abs(graceArcs[1].endX - afterGrace.underlineMiddleX) < 0.0001);
  assert.ok(Math.abs(graceArcs[1].endY - afterGrace.underlineBottomY) < 0.0001);
  assert.equal(graceArcs[0].endX - graceArcs[0].startX, graceArcs[0].radius);
  assert.equal(graceArcs[0].endY - graceArcs[0].startY, graceArcs[0].radius);
  assert.equal(graceArcs[1].endX - graceArcs[1].startX, graceArcs[1].radius);
  assert.equal(graceArcs[1].startY - graceArcs[1].endY, graceArcs[1].radius);
  assert.ok(noteX(svg, 2) - noteX(svg, 1) > 24);
});

test("keeps before and after grace ornament spacing symmetric", () => {
  const innerGap = (source, placement) => {
    const result = parse(source);
    assert.equal(result.ok, true);
    const svg = renderSvg(result.value);
    const anchor = svg.match(/<g class="note-item" data-note-index="0"><text class="note" x="([^"]+)"/);
    const group = svg.match(/<g class="grace-note-group" transform="translate\(([^,]+), [^)]+\) scale\(([^)]+)\)">[\s\S]*?<line class="underline" x1="([^"]+)" y1="[^"]+" x2="([^"]+)"/);
    assert.ok(anchor);
    assert.ok(group);
    const anchorX = Number(anchor[1]);
    const groupX = Number(group[1]);
    const scale = Number(group[2]);
    const edgeX = groupX + Number(placement === "before" ? group[4] : group[3]) * scale;
    return placement === "before" ? anchorX - edgeX : edgeX - anchorX;
  };

  assert.ok(Math.abs(innerGap("1(<2)", "before") - innerGap("1(>2)", "after")) < 0.0001);
});

test("reserves twelve horizontal units per grace pitch minus six on either side", () => {
  for (const [source, expectedAdvance] of [
    ["1(>2) 3", 30],
    ["1(>23) 4", 42],
    ["1 2(<3)", 30],
    ["1 2(<34)", 42],
  ]) {
    const result = parse(source);
    assert.equal(result.ok, true);
    const svg = renderSvg(result.value);
    assert.equal(noteX(svg, 1) - noteX(svg, 0), expectedAdvance);
  }
});

test("anchors grace arcs at the short underline midpoint", () => {
  const arcEndX = (source, shortUnderlineEndX) => {
    const result = parse(source);
    assert.equal(result.ok, true);
    const svg = renderSvg(result.value);
    const group = svg.match(/<g class="grace-note-group" transform="translate\(([^,]+), [^)]+\) scale\(([^)]+)\)">([\s\S]*?)<\/g>/);
    const arc = svg.match(/<path class="ornament grace-arc" d="M[^,]+,[^ ]+ A[^ ]+ 0 0 0 ([^,]+),/);
    assert.ok(group);
    assert.ok(arc);
    assert.match(group[3], /<line class="underline" x1="-10" y1="5" x2="(?:14|24)" y2="5"/);
    return {
      actual: Number(arc[1]),
      expected: Number(group[1]) + ((-10 + shortUnderlineEndX) / 2) * Number(group[2]),
    };
  };

  const plain = arcEndX("1(>23)", 10);
  assert.ok(Math.abs(plain.actual - plain.expected) < 0.0001);
  const accidental = arcEndX("1(>#23)", 20);
  assert.ok(Math.abs(accidental.actual - accidental.expected) < 0.0001);
});

test("offsets grace arcs away from a low-octave connector pitch", () => {
  const arcOffset = (source) => {
    const result = parse(source);
    assert.equal(result.ok, true);
    const svg = renderSvg(result.value, { pageWidth: 140 });
    const graceGroups = [...svg.matchAll(/<g class="grace-note-group" transform="translate\(([^,]+), ([^)]+)\) scale\(([^)]+)\)">([\s\S]*?)<\/g>/g)];
    const arc = svg.match(/<path class="ornament grace-arc" d="M([^,]+),[^ ]+ A[^ ]+ 0 0 0 ([^,]+),/);
    const group = source.includes("(>") ? graceGroups[0] : graceGroups.at(-1);
    assert.ok(group);
    assert.ok(arc);
    const underline = group[4].match(/<line class="underline" x1="([^"]+)" [^>]+ x2="([^"]+)"/);
    assert.ok(underline);
    const underlineMiddleX = Number(group[1]) + ((Number(underline[1]) + Number(underline[2])) / 2) * Number(group[3]);
    const connectorX = source.includes("(>") ? Number(arc[2]) : Number(arc[1]);
    return connectorX - underlineMiddleX;
  };

  assert.ok(Math.abs(arcOffset("1(<2)") - 0) < 0.0001);
  assert.ok(Math.abs(arcOffset("1(<2,3)") - 0) < 0.0001);
  assert.ok(Math.abs(arcOffset("1(<23,)") - 1.4) < 0.0001);
  assert.ok(Math.abs(arcOffset("1(>2)") - 0) < 0.0001);
  assert.ok(Math.abs(arcOffset("1(>2,)") + 1.4) < 0.0001);
});

test("renders grace note underline counts from the number of grace pitches", () => {
  const result = parse("1(<23) 2(>4567)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  const graceGroups = [...svg.matchAll(/<g class="grace-note-group" transform="[^"]+">([\s\S]*?)<\/g>/g)]
    .map((match) => {
      const localNote = match[1].match(/<text class="note" x="[^"]+" y="[^"]+" text-anchor="middle">([1-7])<\/text>/);
      assert.ok(localNote);
      return {
        text: localNote[1],
        underlines: [...match[1].matchAll(/<line class="underline"/g)].length,
      };
    });
  assert.deepEqual(
    graceGroups.map((note) => [note.text, note.underlines]),
    [
      ["2", 2],
      ["3", 2],
      ["4", 3],
      ["5", 3],
      ["6", 3],
      ["7", 3],
    ],
  );
});

test("shortens the final underline in a grace-note group", () => {
  const result = parse("1(<23)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const graceGroups = [...svg.matchAll(/<g class="grace-note-group" transform="[^"]+">([\s\S]*?)<\/g>/g)];
  assert.equal(graceGroups.length, 2);
  assert.match(graceGroups[0][1], /<line class="underline" x1="-10" y1="5" x2="14" y2="5"/);
  assert.match(graceGroups[1][1], /<line class="underline" x1="-10" y1="5" x2="10" y2="5"/);
});

test("joins adjacent grace note underlines without overlap", () => {
  const result = parse("1(<23)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const underlines = [...svg.matchAll(/<g class="grace-note-group" transform="translate\(([^,]+), [^)]+\) scale\(([^)]+)\)">[\s\S]*?<line class="underline" x1="([^"]+)" y1="[^"]+" x2="([^"]+)"/g)]
    .map((match) => ({
      startX: Number(match[1]) + Number(match[3]) * Number(match[2]),
      endX: Number(match[1]) + Number(match[4]) * Number(match[2]),
    }));
  assert.equal(underlines.length, 2);
  assert.ok(Math.abs(underlines[0].endX - underlines[1].startX) < 0.0001);
});

test("can embed Bravura into SVGs that use SMuFL symbols", () => {
  const result = parse("1(^)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const embedded = embedBravuraFontFace(svg, "Zm9udA==");
  assert.match(embedded, /@font-face \{ font-family: Bravura;/);
  assert.match(embedded, /data:font\/woff2;base64,Zm9udA==/);
});

test("does not embed Bravura when the SVG only declares the SMuFL stylesheet", () => {
  const result = parse("1 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /\.smufl-symbol/);
  assert.equal(svgUsesSmuflSymbols(svg), false);
  assert.equal(embedBravuraFontFace(svg, "Zm9udA=="), svg);
});

test("shortens underline at beat boundaries", () => {
  const result = parse("1//1//1//1//");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /class="underline" x1="8" y1="109" x2="32" y2="109"/);
  assert.match(svg, /class="underline" x1="80" y1="109" x2="100" y2="109"/);
});

test("shortens underline before a note without underlines", () => {
  const result = parse("1/21/");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /class="underline" x1="8" y1="109" x2="28" y2="109"/);
});

test("shortens the final underline in an incomplete measure", () => {
  const result = parse("1/");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /class="underline" x1="8" y1="109" x2="28" y2="109"/);
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

test("renders alternate-ending slur continuations from the repeat boundary", () => {
  const result = parse("$(1 2 | [1] 3) $(:| [2] 4 5)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const paths = slurPaths(svg);
  assert.equal(paths.length, 2);
  const repeatBarX = Number([...svg.matchAll(/<line class="bar-final" x1="([^"]+)"/g)][0]?.[1]) - 5;
  const continuationStartX = Number(paths[1].match(/^M([^,]+),/)?.[1]);
  assert.equal(continuationStartX, repeatBarX);
});

test("renders later-ending ties as incoming fragments only", () => {
  const result = parse("|: 1 | [1] ~1 :| [2] ~1");
  assert.equal(result.ok, true);
  const paths = tiePaths(renderSvg(result.value));
  assert.equal(paths.length, 2);
  const firstStart = Number(paths[0].match(/^M([^,]+),/)?.[1]);
  const laterStart = Number(paths[1].match(/^M([^,]+),/)?.[1]);
  assert.ok(laterStart > firstStart);
  assert.match(paths[1], /^M[^,]+,[^ ]+ Q[^ ]+ [^ ]+ Q[^ ]+ [^ ]+ Z$/);
});

test("renders repeated ending brackets for multiple passes", () => {
  const result = parse("|: 1 | [1,2] 2 :| [3] 3 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /<text class="ending-label" x="\d+" y="\d+" text-anchor="start">1,2\.<\/text>/);
  assert.match(svg, /<text class="ending-label" x="\d+" y="\d+" text-anchor="start">3\.<\/text>/);
});

test("keeps ending brackets on one overwide source line", () => {
  const result = parse("|: 1 | [1] 2 | 3 | 4 :| [2] 5 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 80 });
  assert.equal(svg.match(/class="ending-line"/g)?.length, 2);
  assert.equal(svg.match(/class="score-group scaled"/g)?.length, 1);
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

test("keeps navigation marks visible on horizontally scaled output", () => {
  const result = parse("[Segno] 1 | 2 | 3 [D.S.] | 4 [Fine]");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 80 });
  assert.match(svg, /class="navigation-target\b/);
  assert.match(svg, /class="navigation-instruction"/);
});

test("keeps zero-margin repeat bars and trailing navigation inside the viewport", () => {
  const result = parse("|: [Segno] 1 2 [D.S.] :|");
  assert.equal(result.ok, true);
  for (const pageWidth of [80, 120, 220, 420]) {
    for (const justifyMode of ["none", "except-last", "all"]) {
      const svg = renderSvg(result.value, { pageWidth, pageMargin: 0, justifyMode });
      const scale = scoreHorizontalScale(svg);
      for (const match of svg.matchAll(/<line class="(bar-thin|bar-final)" x1="([^"]+)"/g)) {
        const strokeWidth = match[1] === "bar-final" ? 5 : 2.5;
        const center = Number(match[2]) * scale;
        assert.ok(center - strokeWidth * scale / 2 >= 0, `${pageWidth}/${justifyMode} left bar edge`);
        assert.ok(center + strokeWidth * scale / 2 <= pageWidth, `${pageWidth}/${justifyMode} right bar edge`);
      }
      for (const match of svg.matchAll(/<circle class="repeat-dot" cx="([^"]+)"/g)) {
        const center = Number(match[1]) * scale;
        assert.ok(center - 2.5 * scale >= 0, `${pageWidth}/${justifyMode} left repeat dot edge`);
        assert.ok(center + 2.5 * scale <= pageWidth, `${pageWidth}/${justifyMode} right repeat dot edge`);
      }
      const instructionX = Number(svg.match(/<text class="navigation-instruction" x="([^"]+)"/)?.[1]) * scale;
      const instructionHalfWidth = 4 * 14 * 0.62 / 2 * scale;
      assert.ok(instructionX - instructionHalfWidth >= 0, `${pageWidth}/${justifyMode} navigation left edge`);
      assert.ok(instructionX + instructionHalfWidth <= pageWidth, `${pageWidth}/${justifyMode} navigation right edge`);
    }
  }
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
  const navigationBottom = Math.min(navigationY(svg, "&#119051;"), navigationY(svg, "D\\.S\\."));
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

test("keeps fermatas clear of ties at each attachment shape", () => {
  const cases = [
    ["1 ~1(.)", {}],
    ["1(.) ~1", {}],
    ["{1 3 5} ~{1 3 5}(.)", {}],
    ["1 | ~1(.)", { pageWidth: 70 }],
  ];
  for (const [source, options] of cases) {
    const result = parse(source);
    assert.equal(result.ok, true, source);
    const svg = renderSvg(result.value, options);
    const fermataY = Number(svg.match(/<text class="ornament fermata smufl-symbol" x="[^"]+" y="([^"]+)"/)?.[1]);
    const tieTop = Math.min(
      ...tiePaths(svg)
        .map((path) => Math.min(...pathYValues(path)))
        .filter((top) => top >= fermataY),
    );
    assert.ok(Number.isFinite(fermataY), source);
    assert.ok(fermataY + 4 <= tieTop - 4, `${source} should keep the fermata clear of the tie`);
  }
});

test("stacks tie ornament velocity and hairpin by semantic priority", () => {
  const result = parse("p < 1 f < ~1(.) 2");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  const tieTop = Math.min(...pathYValues(tiePaths(svg)[0]));
  const fermataBottom = Number(svg.match(/<text class="ornament fermata smufl-symbol" x="[^"]+" y="([^"]+)"/)?.[1]) + 4;
  const velocityBottom = Number(svg.match(/<text class="velocity" x="[^"]+" y="([^"]+)"[^>]*>f<\/text>/)?.[1]) + 3;
  const hairpinBottom = Math.max(
    ...[...svg.matchAll(/<line class="hairpin" x1="[^"]+" y1="([^"]+)" x2="[^"]+" y2="([^"]+)"\/>/g)]
      .flatMap((match) => [Number(match[1]), Number(match[2])]),
  );
  assert.ok(fermataBottom <= tieTop - 4);
  assert.ok(velocityBottom <= fermataBottom - 4);
  assert.ok(hairpinBottom <= velocityBottom - 4);
});

test("applies vertical lane height before pagination", () => {
  const plain = parse("1 2 3 4\n5 6 7 1");
  const dense = parse("p < 1 f < ~1(.) 2 3\n5 6 7 1");
  assert.equal(plain.ok, true);
  assert.equal(dense.ok, true);
  assert.equal(renderSvgPages(plain.value, { pageWidth: 300, paginate: true, pageHeight: 200 }).length, 1);
  assert.equal(renderSvgPages(dense.value, { pageWidth: 300, paginate: true, pageHeight: 200 }).length, 2);
});

test("lays out dense navigation ending slur and dynamic combinations", () => {
  const result = parse("|: [Segno] 1 | [1] $(p < 2 f < ~2(.) 3) :| [2] 4 [D.S.] |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 220, justifyMode: "all" });
  assert.match(svg, /class="navigation-target/);
  assert.match(svg, /class="navigation-instruction"/);
  assert.match(svg, /class="ending-line"/);
  assert.match(svg, /class="slur"/);
  assert.match(svg, /class="tie"/);
  assert.match(svg, /class="ornament fermata/);
  assert.match(svg, /class="velocity"/);
  assert.match(svg, /class="hairpin"/);
});

test("lays out grace slide and long trill beside upper spans", () => {
  const result = parse("$(1(<2) 3(tr~)- 4(~) 5)");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 220, justifyMode: "all" });
  assert.match(svg, /class="grace-note-group"/);
  assert.match(svg, /class="ornament trill-extension"/);
  assert.match(svg, /class="ornament slide"/);
  assert.match(svg, /class="slur"/);
});

test("plans upper decorations independently for simultaneous voices", () => {
  const result = parse("T1: $(p < {1 3 5}(<2) f < ~{1 3 5}(.) 2)\nT2: 5(tr~)- 6 7 1");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 240 });
  assert.equal(slurPaths(svg).length, 1);
  assert.equal(tiePaths(svg).length, 1);
  assert.match(svg, /class="grace-note-group"/);
  assert.match(svg, /class="ornament trill-extension"/);
  assert.match(svg, /class="voice-bracket"/);
});

test("moves following voices brackets and lyrics with planned lane height", () => {
  const plain = parse('T1: 1 1 2\nT2: 5 6 7\n"one two three"');
  const dense = parse('T1: p < 1 f < ~1(.) 2\nT2: 5 6 7\n"one two three"');
  assert.equal(plain.ok, true);
  assert.equal(dense.ok, true);
  const plainSvg = renderSvg(plain.value, { pageWidth: 240 });
  const denseSvg = renderSvg(dense.value, { pageWidth: 240 });
  const lyricY = (svg) => Number(svg.match(/<text class="lyric-syllable(?: lyric-latin)?" x="[^"]+" y="([^"]+)"/)?.[1]);
  const bracketBottom = (svg) => Math.max(...[...svg.matchAll(/<path class="voice-bracket" d="[^"]+ L[^,]+,([^"]+)"/g)].map((match) => Number(match[1])));
  assert.ok(lyricY(denseSvg) > lyricY(plainSvg));
  assert.ok(bracketBottom(denseSvg) > bracketBottom(plainSvg));
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
  const repeatStart = svg.match(/<line class="bar-final" x1="([\d.]+)"/);
  const firstNote = svg.match(/<text class="note" x="(\d+)" y="\d+" text-anchor="middle">1<\/text>/);
  assert.ok(repeatStart);
  assert.ok(firstNote);
  assert.equal(Number(firstNote[1]) - Number(repeatStart[1]), 33.5);
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
  assert.match(svg, /<path class="voice-bracket" d="M69,([^ ]+) L60,([^ ]+) V([^ ]+) L69,[^"]+"\/><path class="voice-bracket-stem" d="M60,\2 V\3"\/>/);
  assert.match(svg, /\.voice-bracket \{[^}]*stroke-width: 2;/);
  assert.match(svg, /\.voice-bracket-stem \{[^}]*stroke-width: 3;/);
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

test("uses one shared horizontal scale for simultaneous tracks", () => {
  const result = parse("T1: 1--- 2--- 3--- 4---\nT2: 5,--- 6,--- 7,--- 1---");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 140 });
  assert.equal(svg.match(/class="score-group scaled"/g)?.length, 1);
  assert.equal(svg.match(/class="note-item"/g)?.length, 8);
  assert.equal(svg.match(/class="score-line scaled"/g)?.length ?? 0, 0);
});

test("keeps a simultaneous track group together when paginating", () => {
  const result = parse('title: "Atomic"\n===\nT1: 1 2\nT2: 5, 6,');
  assert.equal(result.ok, true);
  const pages = renderSvgPages(result.value, { pageWidth: 220, paginate: true, pageHeight: 160 });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].svg.match(/class="note-item"/g)?.length ?? 0, 0);
  assert.equal(pages[1].svg.match(/class="note-item"/g)?.length, 4);
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

test("aligns simultaneous tracks across the complete source-line span", () => {
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
  assert.match(svg, /<text class="lyric-line lyric-latin" x="\d+" y="\d+" text-anchor="start">hello &amp; goodbye<\/text>/);
  assert.equal(lyricSyllableX(svg, "second"), noteX(svg, 0));
  assert.equal(lyricSyllableX(svg, "line"), noteX(svg, 1));
  assert.ok(svg.indexOf("hello &amp; goodbye") < svg.indexOf('data-note-index="4"'));
});

test("renders header-defined lyric labels with reserved horizontal space", () => {
  const result = parse('L1: "Verse"\n===\n1 2\nL1: "hello"\n"again"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.match(svg, /<text class="line-label" x="8" y="\d+" text-anchor="start">Verse<\/text><text class="lyric-line lyric-latin" x="79" y="\d+" text-anchor="start">hello<\/text>/);
  assert.match(svg, /<text class="lyric-line lyric-latin" x="79" y="\d+" text-anchor="start">again<\/text>/);
  assert.match(svg, /<g class="note-item" data-note-index="0"><text class="note" x="79"/);
});

test("justifies lyric text with its score group", () => {
  const result = parse('1 2\n"hello"\n3 4\n"tail"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 240, justifyMode: "except-last" });
  assert.match(svg, /<text class="lyric-line lyric-latin" x="18" y="\d+" text-anchor="start" textLength="222" lengthAdjust="spacing">hello<\/text>/);
  assert.match(svg, /<text class="lyric-line lyric-latin" x="18" y="\d+" text-anchor="start">tail<\/text>/);
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
  assert.doesNotMatch(svg, /<text class="lyric-line[^"]*"[^>]*>one two<\/text>/);
});

test("renders lyric spacing placeholders as empty aligned slots", () => {
  const result = parse('1 2 3 4\n"one _ three four"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.equal(lyricSyllableX(svg, "one"), noteX(svg, 0));
  assert.equal(lyricSyllableX(svg, "three"), noteX(svg, 2));
  assert.equal(lyricSyllableX(svg, "four"), noteX(svg, 3));
  assert.doesNotMatch(svg, /<text class="lyric-syllable[^"]*"[^>]*>_<\/text>/);
});

test("renders lyric merge placeholders without filler text", () => {
  const result = parse('1 2 3 4\n"held ~ next _"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.equal(lyricSyllableX(svg, "held"), (noteX(svg, 0) + noteX(svg, 1)) / 2);
  assert.equal(lyricSyllableX(svg, "next"), noteX(svg, 2));
  assert.doesNotMatch(svg, /<text class="lyric-syllable[^"]*"[^>]*>~<\/text>/);
  assert.doesNotMatch(svg, /<text class="lyric-syllable[^"]*"[^>]*>_<\/text>/);
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

test("uses separate CJK and Latin lyric font sizes", () => {
  const result = parse('1 2\n"春day"\n"hello"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /\.lyric-syllable \{[^}]*font-size: 17px;/);
  assert.match(svg, /\.lyric-latin \{ font-size: 13px; \}/);
  assert.match(svg, /<text class="lyric-line"[^>]*><tspan class="lyric-cjk">春<\/tspan><tspan class="lyric-latin">day<\/tspan><\/text>/);
  assert.match(svg, /<text class="lyric-line lyric-latin"[^>]*>hello<\/text>/);
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
  assert.match(svg, /<text class="lyric-line lyric-latin" x="18" y="\d+" text-anchor="start">one two three<\/text>/);
  assert.doesNotMatch(svg, /<text class="lyric-syllable/);
});

test("keeps excess automatic lyric syllables as a normal lyric line", () => {
  const result = parse('1 2\n@"春天来"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 180 });
  assert.match(svg, /<text class="lyric-line" x="18" y="\d+" text-anchor="start">春天来<\/text>/);
  assert.doesNotMatch(svg, /<text class="lyric-syllable/);
});

test("expands lyric syllable anchors to avoid English lyric overlap", () => {
  const result = parse('1 2\n"wonderful evening"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });
  const wonderfulX = lyricSyllableX(svg, "wonderful");
  const eveningX = lyricSyllableX(svg, "evening");
  assert.ok(eveningX - wonderfulX >= (lyricEstimatedWidth("wonderful") + lyricEstimatedWidth("evening")) / 2 + 6);
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
  assert.ok(
    lyricSyllableX(svg, "evening") - lyricSyllableX(svg, "hi") >=
      (lyricEstimatedWidth("wonderful") + lyricEstimatedWidth("evening")) / 2 + 6,
  );
  assert.equal(lyricSyllableX(svg, "wonderful"), lyricSyllableX(svg, "hi"));
  assert.equal(lyricSyllableX(svg, "by"), lyricSyllableX(svg, "evening"));
});

test("keeps lyric-expanded multi-track rhythm anchors aligned", () => {
  const result = parse('T1: 1 2\nT2: 5, 6,\n"wonderful evening"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 260 });
  assert.equal(noteX(svg, 0), noteX(svg, 2));
  assert.equal(noteX(svg, 1), noteX(svg, 3));
  assert.ok(noteX(svg, 1) - noteX(svg, 0) >= (lyricEstimatedWidth("wonderful") + lyricEstimatedWidth("evening")) / 2 + 6);
});

test("scales overwide aligned lyrics with their score group", () => {
  const result = parse('1 2\n"supercalifragilisticexpialidocious tiny"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 100 });
  assert.match(svg, /<g class="score-group scaled"[^>]*>[\s\S]*<text class="lyric-syllable/);
  assert.doesNotMatch(svg, /class="lyric-block scaled"/);
});

test("scales an overwide normal lyric independently from the score", () => {
  const result = parse('1\n"supercalifragilisticexpialidocious"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 100 });
  assert.match(svg, /<g class="lyric-block scaled" transform="scale\(0\.\d+,1\)">/);
  assert.doesNotMatch(svg, /class="score-group scaled"/);
});

test("does not scale a normal lyric with an overwide score group", () => {
  const result = parse('1--- 2--- 3--- 4---\n"caption"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 120 });
  assert.match(svg, /<text class="lyric-line lyric-latin"[^>]*>caption<\/text>/);
  assert.doesNotMatch(svg, /class="lyric-block scaled"/);
  assert.match(svg, /class="score-group scaled"/);
});

test("keeps aligned lyric syllables attached to one overwide source line", () => {
  const result = parse('1 2 | 3 4 |\n"one two three four"');
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 90 });
  assert.equal(svg.match(/class="lyric-syllable(?: lyric-latin)?"/g)?.length, 4);
  assert.equal(svg.match(/class="score-group scaled"/g)?.length, 1);
});

test("renders explicit export color and background", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { color: "#123456", background: "#f8fafc" });
  assert.match(svg, /<svg[^>]+style="color: #123456"/);
  assert.match(svg, /<rect class="page-background"[^>]+fill="#f8fafc"/);
});

test("renders an opaque white page background by default", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.match(svg, /<rect class="page-background"[^>]+fill="#ffffff"/);
  const pages = renderSvgPages(result.value, { paginate: true, pageHeight: 180 });
  assert.ok(pages.length > 0);
  assert.ok(pages.every((page) => /<rect class="page-background"[^>]+fill="#ffffff"/.test(page.svg)));
});

test("rejects explicit colors outside six-digit hexadecimal syntax", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  assert.throws(() => renderSvg(result.value, { color: "red; opacity: 0.2" }), /Render color must be a six-digit hexadecimal color/);
  assert.throws(() => renderSvg(result.value, { color: "#123" }), /Render color must be a six-digit hexadecimal color/);
  assert.throws(() => renderSvgPages(result.value, { background: "rgba(255, 255, 255, 0.5)" }), /Render background must be a six-digit hexadecimal color/);
  assert.doesNotThrow(() => renderSvg(result.value, { color: "#ABCDEF", background: "#123456" }));
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

test("keeps hairpins on one overwide source line", () => {
  const result = parse("p < 1 2 | 3 f < 4 |");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 70 });
  assert.equal(svg.match(/class="hairpin"/g)?.length, 2);
  assert.equal(svg.match(/class="score-group scaled"/g)?.length, 1);
});

test("renders hairpins across source lines on the same track", () => {
  const result = parse("p < 1 2\n3 f < 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value);
  assert.equal(svg.match(/class="hairpin"/g)?.length, 4);
  assert.match(svg, /<line class="hairpin" x1="0\.9"/);
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

test("renders ordered credit lines with bottom aligned metadata and expanded header height", async () => {
  const { renderHeader } = await import("../dist/renderer/header.js");
  const single = parse('title: "Song"\nsubtitle: "Subtitle"\ncomposer: "A & B"\n===\n1 2 3 4');
  const multi = parse('title: "Song"\nsubtitle: "Subtitle"\ncomposer: "A & B"\ncomposer: ""\ncomposer: "<C>"\n===\n1 2 3 4');
  assert.equal(multi.ok, true);
  const header = renderHeader(multi.value, 500);
  assert.equal(header.height, renderHeader(single.value, 500).height + 56);
  assert.match(header.svg, /x="450" y="112" text-anchor="end">A &amp; B<\/text>/);
  assert.match(header.svg, /x="450" y="140" text-anchor="end"><\/text>/);
  assert.match(header.svg, /x="450" y="168" text-anchor="end">&lt;C&gt;<\/text>/);
  assert.match(header.svg, /class="tempo-mark"[^>]*y="168"/);
  const height = (doc) => Number(renderSvg(doc).match(/<svg[^>]*height="([^"]+)"/)[1]);
  assert.equal(height(multi.value), height(single.value) + 56);
  assert.equal(inferContentPageWidth(multi.value), inferContentPageWidth(single.value));
  multi.value.header.hidden = true;
  assert.deepEqual(renderHeader(multi.value, 500), { svg: "", height: 0 });
});

test("multiline credits reserve space on the first paginated page", () => {
  const single = parse('composer: "A"\n===\n1 2 3 4\n1 2 3 4');
  const multi = parse('composer: "A"\ncomposer: "B"\ncomposer: "C"\n===\n1 2 3 4\n1 2 3 4');
  const options = { pageWidth: 500, paginate: true, pageHeight: 200 };
  assert.equal(renderSvgPages(single.value, options).length, 1);
  const pages = renderSvgPages(multi.value, options);
  assert.equal(pages.length, 2);
  assert.match(pages[0].svg, /text-anchor="end">C<\/text>/);
  assert.doesNotMatch(pages[1].svg, /text-anchor="end">C<\/text>/);
});
