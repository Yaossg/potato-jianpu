import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createDocumentation, parseEbnf, validateEbnf } = require("ebnf2railroad");

const root = fileURLToPath(new URL("../", import.meta.url));
const grammarPath = new URL("../docs/grammar.ebnf", import.meta.url);
const pagePath = new URL("../public/grammar.html", import.meta.url);

const diagramTargets = [
  { heading: "Parser Overview", rules: ["file"] },
  { heading: "Header", rules: ["header", "property"] },
  { heading: "Score", rules: ["score"] },
  { heading: "Line", rules: ["line"] },
  { heading: "Measure", rules: ["measure"] },
  { heading: "Durable Note", rules: ["durable_note"] },
  { heading: "General Note", rules: ["general_note"] },
  { heading: "Pitch", rules: ["pitch_note"] },
  { heading: "Chord", rules: ["chord"] },
  { heading: "Duration", rules: ["length"] },
];

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
      return `      <div class="diagram">\n        ${svg}\n      </div>`;
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
  const stopMarker = heading === "Parser Overview" ? `\n      <p class="caption">` : `\n      <pre class="ebnf"`;
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
let pageHtml = await readFile(pagePath, "utf8");
for (const target of diagramTargets) {
  pageHtml = replaceHeadingDiagrams(pageHtml, target.heading, diagramBlockFor(target.rules, diagrams));
}

await writeFile(pagePath, pageHtml, "utf8");
console.log(`Generated railroad diagrams in ${pagePath.pathname.replace(root.replace(/\\/g, "/"), "")}`);
