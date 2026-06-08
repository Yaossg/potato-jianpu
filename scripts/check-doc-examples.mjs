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
  const pattern = /```jpu\s+(valid|warning|invalid)\r?\n([\s\S]*?)\r?\n```/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    blocks.push({ kind: match[1], source: match[2], offset: match.index });
  }
  return blocks;
}

const { parse } = await import(pathToFileURL(parserModule).href);
const files = await listMdxFiles(docsRoot);
const errors = [];
let checked = 0;
const counts = { valid: 0, warning: 0, invalid: 0 };

for (const file of files) {
  const source = await readFile(file, "utf8");
  const blocks = findJianpuBlocks(source);
  for (const block of blocks) {
    checked += 1;
    counts[block.kind] += 1;
    const result = parse(block.source);
    const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
    const relativePath = path.relative(root, file);
    const line = source.slice(0, block.offset).split(/\r?\n/).length;
    const messages = result.diagnostics.map((diagnostic) => diagnostic.message).join("; ");

    if (block.kind === "valid" && (!result.ok || warnings.length > 0)) {
      errors.push(`${relativePath}:${line}: expected valid jpu example without diagnostics: ${messages}`);
    } else if (block.kind === "warning" && (!result.ok || warnings.length === 0)) {
      errors.push(`${relativePath}:${line}: expected jpu example with at least one warning: ${messages}`);
    } else if (block.kind === "invalid" && result.ok) {
      errors.push(`${relativePath}:${line}: expected invalid jpu example but it parsed successfully`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${checked} Jianpu documentation examples (${counts.valid} valid, ${counts.warning} warning, ${counts.invalid} invalid).`,
  );
}
