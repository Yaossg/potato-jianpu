import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createDocumentation, parseEbnf, validateEbnf } = require("ebnf2railroad");

const root = fileURLToPath(new URL("../", import.meta.url));
const grammarPath = new URL("../docs/grammar.ebnf", import.meta.url);
const docsSiteDiagramDataPath = new URL("../docs-site/src/generated/railroad-diagrams.json", import.meta.url);

function generatedDiagramMap(generatedHtml) {
  const diagrams = new Map();
  const pattern = /<h4 id="([^"]+)">[\s\S]*?<div class="diagram-container">([\s\S]*?<\/svg>)\s*<\/div>/g;
  for (const match of generatedHtml.matchAll(pattern)) {
    diagrams.set(match[1], match[2]);
  }
  return diagrams;
}

function diagramDataFor(diagrams) {
  return Object.fromEntries([...diagrams.entries()].sort(([left], [right]) => left.localeCompare(right)));
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

await mkdir(new URL("./", docsSiteDiagramDataPath), { recursive: true });
await writeFile(docsSiteDiagramDataPath, `${JSON.stringify(diagramDataFor(diagrams), null, 2)}\n`, "utf8");
console.log(`Generated docs-site railroad diagram data in ${docsSiteDiagramDataPath.pathname.replace(root.replace(/\\/g, "/"), "")}`);
