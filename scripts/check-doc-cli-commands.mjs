import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const docsRoot = path.join(root, "docs-site", "src", "content", "docs");
const commands = {
  parse: new Set(["--json"]),
  validate: new Set(["--json"]),
  "export-svg": new Set([
    "-o",
    "--paper",
    "--orientation",
    "--page-width",
    "--paginate",
    "--page-height",
    "--page-margin",
    "--page-footer",
    "--page-numbers",
    "--color",
    "--background",
    "--split-pages",
  ]),
  "export-png": new Set([
    "-o",
    "--paper",
    "--orientation",
    "--page-width",
    "--paginate",
    "--page-height",
    "--page-margin",
    "--page-footer",
    "--page-numbers",
    "--color",
    "--background",
    "--png-scale",
    "--split-pages",
  ]),
  "export-pdf": new Set([
    "-o",
    "--paper",
    "--orientation",
    "--page-width",
    "--paginate",
    "--page-height",
    "--page-margin",
    "--page-footer",
    "--page-numbers",
    "--color",
    "--background",
  ]),
  "export-midi": new Set(["-o", "--program", "--omit-initial-rest"]),
  "export-wav": new Set(["-o", "--program", "--sample-rate", "--amplitude", "--omit-initial-rest"]),
  "export-mp3": new Set(["-o", "--program", "--sample-rate", "--amplitude", "--bit-rate", "--omit-initial-rest"]),
};
const valueFlags = new Set([
  "-o",
  "--paper",
  "--orientation",
  "--page-width",
  "--page-height",
  "--page-margin",
  "--page-footer",
  "--color",
  "--background",
  "--png-scale",
  "--program",
  "--sample-rate",
  "--amplitude",
  "--bit-rate",
]);

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

function shellWords(line) {
  return line.match(/"[^"]*"|'[^']*'|\S+/g)?.map((word) => word.replace(/^["']|["']$/g, "")) ?? [];
}

function findShellBlocks(source) {
  return [...source.matchAll(/```(?:sh|shell|bash)\r?\n([\s\S]*?)\r?\n```/g)].map((match) => ({
    source: match[1],
    offset: match.index,
  }));
}

function checkCliLine(line) {
  const words = shellWords(line.trim());
  const prefixIndex = words.findIndex((word, index) => word === "pnpm" && words[index + 1] === "run" && words[index + 2] === "cli");
  if (prefixIndex === -1) return [];

  let commandIndex = prefixIndex + 3;
  if (words[commandIndex] === "--") {
    commandIndex += 1;
  }
  const command = words[commandIndex];
  if (command === "--version" || command === "-v" || command === "--help" || command === "-h") {
    return [];
  }
  const allowedFlags = commands[command];
  if (!allowedFlags) {
    return [`unknown CLI command "${command ?? "(missing)"}"`];
  }

  const errors = [];
  for (let index = commandIndex + 2; index < words.length; index += 1) {
    const word = words[index];
    if (!word.startsWith("-")) continue;
    if (!allowedFlags.has(word)) {
      errors.push(`unknown option "${word}" for ${command}`);
      continue;
    }
    if (valueFlags.has(word)) {
      if (!words[index + 1] || words[index + 1].startsWith("-")) {
        errors.push(`missing value for ${word}`);
      }
      index += 1;
    }
  }
  return errors;
}

const errors = [];
const files = await listMdxFiles(docsRoot);

for (const file of files) {
  const source = await readFile(file, "utf8");
  const relativeFile = path.relative(root, file);
  for (const block of findShellBlocks(source)) {
    const startLine = source.slice(0, block.offset).split(/\r?\n/).length;
    const lines = block.source.split(/\r?\n/);
    for (const [lineIndex, line] of lines.entries()) {
      for (const error of checkCliLine(line)) {
        errors.push(`${relativeFile}:${startLine + lineIndex + 1}: ${error}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} MDX documents for CLI command examples.`);
}
