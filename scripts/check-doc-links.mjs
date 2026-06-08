import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const docsRoot = path.join(root, "docs-site", "src", "content", "docs");

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

function documentUrlPath(file) {
  const relative = path.relative(docsRoot, file).replaceAll(path.sep, "/").replace(/\.mdx$/, "");
  if (relative === "index") return "";
  return relative.endsWith("/index") ? relative.slice(0, -"/index".length) : relative;
}

function normalizeUrlPath(urlPath) {
  return urlPath.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

function resolveDocHref(fromUrlPath, href) {
  if (/^(?:[a-z]+:|#|\/)/i.test(href)) return null;
  const fromDirectory = fromUrlPath === "" ? "" : `${fromUrlPath}/`;
  return normalizeUrlPath(path.posix.normalize(path.posix.join(fromDirectory, href)));
}

const files = await listMdxFiles(docsRoot);
const knownPaths = new Set(files.map(documentUrlPath));
const errors = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const fromUrlPath = documentUrlPath(file);
  const relativeFile = path.relative(root, file);
  const hrefPattern = /\bhref:\s*["']([^"']+)["']/g;

  for (const match of source.matchAll(hrefPattern)) {
    const href = match[1];
    const target = resolveDocHref(fromUrlPath, href);
    if (target === null) continue;
    if (!knownPaths.has(target)) {
      errors.push(`${relativeFile}: broken docs href ${JSON.stringify(href)} resolved to ${JSON.stringify(target)}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} MDX documents for internal docs links.`);
}
