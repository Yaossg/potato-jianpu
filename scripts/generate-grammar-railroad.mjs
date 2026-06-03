import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createDocumentation, parseEbnf, validateEbnf } = require("ebnf2railroad");

const root = fileURLToPath(new URL("../", import.meta.url));
const grammarPath = new URL("../docs/grammar.ebnf", import.meta.url);
const pageTargets = [
  {
    path: new URL("../public/grammar.html", import.meta.url),
    diagrams: [
      { heading: "Parser Overview", rules: ["file"] },
      { heading: "Header", rules: ["header", "property", "property_label"] },
      { heading: "Score", rules: ["score", "score_item"] },
      { heading: "Line", rules: ["line", "track_label", "lyric_line", "lyric_label", "start_barline", "measure_separator", "end_barline", "ending"] },
      { heading: "Measure", rules: ["measure", "octave"] },
      { heading: "Durable Note", rules: ["durable_note", "tie"] },
      { heading: "General Note", rules: ["general_note", "rest", "drum"] },
      { heading: "Pitch", rules: ["pitch_note", "accidental"] },
      { heading: "Chord", rules: ["chord"] },
      { heading: "Duration", rules: ["length"] },
      {
        heading: "Token Reference",
        rules: [
          "skipped",
          "IDENTIFIER",
          "TRACK_LABEL",
          "LYRIC_LABEL",
          "STRING",
          "DIGIT",
          "NOTE",
          "REST",
          "DRUM",
          "BAR",
          "REPEAT_START",
          "REPEAT_END",
          "REPEAT_BOTH",
          "LBRACKET",
          "RBRACKET",
          "SHARPSHARP",
          "SHARP",
          "FLATFLAT",
          "FLAT",
          "NATURAL",
          "HALF",
          "DOT",
          "DASH",
          "LOWER",
          "HIGHER",
          "TIE",
          "EQUALS",
          "NEWLINE",
          "WS",
          "COMMENT",
          "EOF",
        ],
      },
    ],
  },
  {
    path: new URL("../public/grammar.zh.html", import.meta.url),
    diagrams: [
      { heading: "解析器概览", rules: ["file"] },
      { heading: "标题区", rules: ["header", "property", "property_label"] },
      { heading: "谱面", rules: ["score", "score_item"] },
      { heading: "行", rules: ["line", "track_label", "lyric_line", "lyric_label", "start_barline", "measure_separator", "end_barline", "ending"] },
      { heading: "小节", rules: ["measure", "octave"] },
      { heading: "带时值音符", rules: ["durable_note", "tie"] },
      { heading: "通用音符", rules: ["general_note", "rest", "drum"] },
      { heading: "音高", rules: ["pitch_note", "accidental"] },
      { heading: "和弦", rules: ["chord"] },
      { heading: "时值", rules: ["length"] },
      {
        heading: "Token 参考",
        rules: [
          "skipped",
          "IDENTIFIER",
          "TRACK_LABEL",
          "LYRIC_LABEL",
          "STRING",
          "DIGIT",
          "NOTE",
          "REST",
          "DRUM",
          "BAR",
          "REPEAT_START",
          "REPEAT_END",
          "REPEAT_BOTH",
          "LBRACKET",
          "RBRACKET",
          "SHARPSHARP",
          "SHARP",
          "FLATFLAT",
          "FLAT",
          "NATURAL",
          "HALF",
          "DOT",
          "DASH",
          "LOWER",
          "HIGHER",
          "TIE",
          "EQUALS",
          "NEWLINE",
          "WS",
          "COMMENT",
          "EOF",
        ],
      },
    ],
  },
];

const overviewHeadings = new Set(["Parser Overview", "解析器概览"]);

function generatedDiagramMap(generatedHtml) {
  const diagrams = new Map();
  const pattern = /<h4 id="([^"]+)">[\s\S]*?<div class="diagram-container">([\s\S]*?<\/svg>)\s*<\/div>/g;
  for (const match of generatedHtml.matchAll(pattern)) {
    diagrams.set(match[1], match[2]);
  }
  return diagrams;
}

function diagramBlockFor(rules, diagrams) {
  return rules
    .map((rule) => {
      const svg = diagrams.get(rule);
      if (!svg) {
        throw new Error(`Missing generated railroad diagram for ${rule}.`);
      }
      return `      <div class="diagram">\n        <div class="diagram-title">${rule}</div>\n        ${svg}\n      </div>`;
    })
    .join("\n\n");
}

function replaceHeadingDiagrams(pageHtml, heading, replacement) {
  const headingMarker = `      <h3>${heading}</h3>`;
  const headingIndex = pageHtml.indexOf(headingMarker);
  if (headingIndex < 0) {
    throw new Error(`Could not find grammar heading ${heading}.`);
  }

  const afterHeading = headingIndex + headingMarker.length;
  const stopMarker = overviewHeadings.has(heading) ? `\n      <p class="caption">` : `\n      <pre class="ebnf"`;
  let stopIndex = pageHtml.indexOf(stopMarker, afterHeading);
  if (stopIndex < 0 && stopMarker.startsWith("\n")) {
    stopIndex = pageHtml.indexOf(`\r${stopMarker}`, afterHeading);
  }
  if (stopIndex < 0) {
    throw new Error(`Could not replace railroad diagrams for ${heading}.`);
  }

  return `${pageHtml.slice(0, afterHeading)}\n${replacement}${pageHtml.slice(stopIndex)}`;
}

const ebnf = await readFile(grammarPath, "utf8");
const ast = parseEbnf(ebnf);
const warnings = validateEbnf(ast);
if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`${warning.type} on line ${warning.line}: ${warning.message}`);
  }
}

const generatedHtml = createDocumentation(ast, {
  title: "Modern Jianpu Markup Grammar Railroad",
  full: false,
  optimizeDiagrams: false,
  optimizeText: false,
  textFormatting: true,
  overviewDiagram: false,
  diagramWrap: false,
});

const diagrams = generatedDiagramMap(generatedHtml);
for (const pageTarget of pageTargets) {
  let pageHtml = await readFile(pageTarget.path, "utf8");
  for (const target of pageTarget.diagrams) {
    pageHtml = replaceHeadingDiagrams(pageHtml, target.heading, diagramBlockFor(target.rules, diagrams));
  }
  await writeFile(pageTarget.path, pageHtml, "utf8");
  console.log(`Generated railroad diagrams in ${pageTarget.path.pathname.replace(root.replace(/\\/g, "/"), "")}`);
}
