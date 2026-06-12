import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const docsRoot = path.join(root, "docs-site", "src", "content", "docs");
const codeSpanPattern = /`([^`\n]*)`/g;

async function listMdxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listMdxFiles(fullPath);
      return entry.isFile() && entry.name.endsWith(".mdx") ? [fullPath] : [];
    }),
  );
  return files.flat();
}

function isTableRow(line) {
  return line.trimStart().startsWith("|");
}

function isFence(line) {
  return line.trimStart().startsWith("```");
}

function hasUnescapedPipeInCodeSpan(line) {
  for (const match of line.matchAll(codeSpanPattern)) {
    const code = match[1];
    for (let index = 0; index < code.length; index += 1) {
      if (code[index] === "|" && code[index - 1] !== "\\") {
        return true;
      }
    }
  }
  return false;
}

const failures = [];
const files = await listMdxFiles(docsRoot);

for (const file of files) {
  const source = await readFile(file, "utf8");
  let inFence = false;
  const lines = source.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (isFence(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !isTableRow(line)) {
      continue;
    }
    if (hasUnescapedPipeInCodeSpan(line)) {
      failures.push(`${path.relative(root, file)}:${index + 1}: escape literal "|" inside table code spans`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} MDX documents for escaped table pipe tokens.`);
}
