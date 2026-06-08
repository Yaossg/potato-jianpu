import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const docsRoot = path.join(root, "docs-site", "src", "content", "docs");
const translatedLocale = "zh";

async function listMdxFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const relativePath = path.join(prefix, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (prefix === "" && entry.name === translatedLocale) {
        continue;
      }
      files.push(...(await listMdxFiles(fullPath, relativePath)));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

async function readDocId(filePath) {
  const source = await readFile(filePath, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return null;
  }
  const docId = match[1].match(/^docId:\s*(.+)$/m);
  return docId?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

const englishFiles = await listMdxFiles(docsRoot);
const zhRoot = path.join(docsRoot, translatedLocale);
const zhFiles = (await listMdxFiles(zhRoot)).sort();

const errors = [];
const englishSet = new Set(englishFiles);
const zhSet = new Set(zhFiles);

for (const file of englishFiles) {
  if (!zhSet.has(file)) {
    errors.push(`Missing ${translatedLocale} translation for ${file}`);
  }
}

for (const file of zhFiles) {
  if (!englishSet.has(file)) {
    errors.push(`Extra ${translatedLocale} translation without source document: ${file}`);
  }
}

for (const file of englishFiles.filter((item) => zhSet.has(item))) {
  const englishDocId = await readDocId(path.join(docsRoot, file));
  const translatedDocId = await readDocId(path.join(zhRoot, file));
  if (!englishDocId) {
    errors.push(`Missing docId in ${file}`);
  }
  if (!translatedDocId) {
    errors.push(`Missing docId in ${translatedLocale}/${file}`);
  }
  if (englishDocId && translatedDocId && englishDocId !== translatedDocId) {
    errors.push(`docId mismatch for ${file}: ${englishDocId} !== ${translatedDocId}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${englishFiles.length} translated MDX documents.`);
}
