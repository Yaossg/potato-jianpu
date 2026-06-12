import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const docsRoot = path.join(root, "docs-site", "src", "content", "docs");
const parserModule = path.join(root, "dist", "parser", "index.js");

async function listMdxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMdxFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function findJianpuBlocks(source) {
  const blocks = [];
  const pattern = /```jpu(?:[^\S\r\n]+([^\r\n]+))?\r?\n([\s\S]*?)\r?\n```/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const kind = match[1]?.trim();
    blocks.push({
      kind,
      source: match[2],
      offset: match.index,
      label: "fenced jpu block",
    });
  }
  return blocks;
}

function findSourceBackedComponents(source) {
  const blocks = [];
  const pattern = /<(JianpuExample|JianpuSource|ScorePreview)\b([\s\S]*?)\bsource=\{`([\s\S]*?)`\}[\s\S]*?(?:\/>|>)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const [, componentName, props, scoreSource] = match;
    const status = props.match(/\bstatus=["'](valid|warning|invalid)["']/)?.[1];
    blocks.push({
      kind: componentName === "ScorePreview" ? "valid" : (status ?? "valid"),
      source: scoreSource,
      offset: match.index,
      label: componentName,
    });
  }
  return blocks;
}

const { parse } = await import(pathToFileURL(parserModule).href);
const files = await listMdxFiles(docsRoot);
const errors = [];
let checked = 0;
const counts = { valid: 0, warning: 0, invalid: 0 };
const labelCounts = new Map();

for (const file of files) {
  const source = await readFile(file, "utf8");
  const blocks = [...findJianpuBlocks(source), ...findSourceBackedComponents(source)].sort((left, right) => left.offset - right.offset);
  for (const block of blocks) {
    const relativePath = path.relative(root, file);
    const line = source.slice(0, block.offset).split(/\r?\n/).length;

    if (!["valid", "warning", "invalid"].includes(block.kind)) {
      errors.push(
        `${relativePath}:${line}: expected fenced jpu block to be marked as jpu valid, jpu warning, or jpu invalid`,
      );
      continue;
    }

    checked += 1;
    counts[block.kind] += 1;
    labelCounts.set(block.label, (labelCounts.get(block.label) ?? 0) + 1);
    const result = parse(block.source);
    const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
    const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("; ");

    if (block.kind === "valid" && (!result.ok || warnings.length > 0)) {
      errors.push(`${relativePath}:${line}: expected valid ${block.label} without diagnostics: ${messages}`);
    } else if (block.kind === "warning" && (!result.ok || warnings.length === 0)) {
      errors.push(`${relativePath}:${line}: expected ${block.label} with at least one warning: ${messages}`);
    } else if (block.kind === "invalid" && result.ok) {
      errors.push(`${relativePath}:${line}: expected invalid ${block.label} but it parsed successfully`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  const labels = [...labelCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => `${count} ${label}`)
    .join(", ");
  console.log(
    `Checked ${checked} Jianpu documentation examples (${counts.valid} valid, ${counts.warning} warning, ${counts.invalid} invalid; ${labels}).`,
  );
}
