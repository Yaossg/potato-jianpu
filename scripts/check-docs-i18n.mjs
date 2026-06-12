import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const docsRoot = path.join(root, "docs-site", "src", "content", "docs");
const railroadDiagramsPath = path.join(root, "docs-site", "src", "generated", "railroad-diagrams.json");
const translatedLocale = "zh";
const defaultSupportMatrixColumns = ["parser", "render", "playback", "export", "cli"];
const railroadDiagrams = JSON.parse(await readFile(railroadDiagramsPath, "utf8"));
const knownRailroadRules = new Set(Object.keys(railroadDiagrams));

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

async function readDocumentMetadata(filePath) {
  const source = await readFile(filePath, "utf8");
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const docId =
    frontmatter?.[1].match(/^docId:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
  const headingLevels = source
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{2,6})\s+\S/))
    .filter(Boolean)
    .map((match) => match[1].length);
  const sectionIds = parseSectionIds(frontmatter?.[1] ?? "");
  const componentNames = source
    .split(/\r?\n/)
    .map((line) => line.match(/^<([A-Z][A-Za-z0-9.]*)\b/))
    .filter(Boolean)
    .map((match) => match[1]);
  const jpuExampleKinds = [...source.matchAll(/^```jpu(?:\s+(valid|warning|invalid))?/gm)].map(
    (match) => match[1] ?? "unspecified",
  );
  const sourceBackedExampleKinds = [...source.matchAll(/<Jianpu(?:Example|Source)\b([\s\S]*?)(?:\/>|>)/g)].map(
    (match) => match[1].match(/\bstatus=["'](valid|warning|invalid)["']/)?.[1] ?? "valid",
  );
  const sourceBackedComponentSources = [
    ...source.matchAll(/<(JianpuExample|JianpuSource|ScorePreview)\b[\s\S]*?\bsource=\{`([\s\S]*?)`\}[\s\S]*?(?:\/>|>)/g),
  ].map((match) => `${match[1]}:${match[2].replace(/\r\n/g, "\n")}`);
  const relatedLinksHrefs = [...source.matchAll(/<RelatedLinks\b[\s\S]*?\blinks=\{\[([\s\S]*?)\]\}[\s\S]*?(?:\/>|>)/g)].map(
    (match) =>
      [...match[1].matchAll(/\bhref:\s*(['"])(.*?)\1/g)].map((hrefMatch) => hrefMatch[2]).join(" "),
  );
  const railroadDiagramRules = [...source.matchAll(/<RailroadDiagram\b[\s\S]*?\brule=(?:"([^"]+)"|'([^']+)')/g)].map(
    (match) => match[1] ?? match[2],
  );
  const syntaxTokenGridTokens = [
    ...source.matchAll(/<SyntaxTokenGrid\b[\s\S]*?\btokens=\{\[([\s\S]*?)\]\}[\s\S]*?(?:\/>|>)/g),
  ].map((match) =>
    [...match[1].matchAll(/\btoken:\s*(['"])(.*?)\1/g)].map((tokenMatch) => tokenMatch[2]).join(" "),
  );
  const supportMatrices = [...source.matchAll(/<SupportMatrix\b([\s\S]*?)(?:\/>|>)/g)].map((match) =>
    parseSupportMatrixSignature(match[1], filePath),
  );

  return {
    componentNames,
    docId,
    headingLevels,
    jpuExampleKinds,
    railroadDiagramRules,
    relatedLinksHrefs,
    sectionIds,
    sourceBackedComponentSources,
    sourceBackedExampleKinds,
    supportMatrices,
    syntaxTokenGridTokens,
  };
}

function parseSectionIds(frontmatter) {
  const lines = frontmatter.split(/\r?\n/);
  const inline = frontmatter.match(/^sectionIds:\s*\[(.*?)\]\s*$/m);
  if (inline) {
    return inline[1]
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  const sectionIds = [];
  const startIndex = lines.findIndex((line) => line.trim() === "sectionIds:");
  if (startIndex === -1) {
    return sectionIds;
  }
  for (const line of lines.slice(startIndex + 1)) {
    const item = line.match(/^\s*-\s+(.+?)\s*$/);
    if (item) {
      sectionIds.push(item[1].trim().replace(/^["']|["']$/g, ""));
      continue;
    }
    if (/^\S/.test(line)) {
      break;
    }
  }
  return sectionIds;
}

function checkSectionIds(file, label, sectionIds, errors) {
  const seen = new Set();
  for (const sectionId of sectionIds) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sectionId)) {
      errors.push(
        `Invalid sectionId in ${label}/${file}: ${sectionId} ` +
          "(use lowercase kebab-case letters and digits)",
      );
    }
    if (seen.has(sectionId)) {
      errors.push(`Duplicate sectionId in ${label}/${file}: ${sectionId}`);
    }
    seen.add(sectionId);
  }
}

function parseSupportMatrixSignature(source, filePath) {
  const columnsBlock = source.match(/\bcolumns=\{\[([\s\S]*?)\]\}/);
  const columns = columnsBlock
    ? [...columnsBlock[1].matchAll(/\[\s*(['"])(.*?)\1\s*,/g)].map((match) => match[2])
    : defaultSupportMatrixColumns;
  const featuresBlock = source.match(/\bfeatures=\{\[([\s\S]*?)\]\}/);
  if (!featuresBlock) {
    return `${columns.join(" ")}|`;
  }

  const features = [...featuresBlock[1].matchAll(/\{([\s\S]*?)\}/g)].map((match, index) => {
    const objectSource = match[1];
    const id = objectSource.match(/\bid:\s*(['"])(.*?)\1/)?.[2];
    const featureLabel = objectSource.match(/\bfeature:\s*(['"])(.*?)\1/)?.[2] ?? `row ${index + 1}`;
    if (!id) {
      throw new Error(`Missing SupportMatrix feature id in ${filePath}: ${featureLabel}`);
    }
    const support = columns.map((column) => {
      const valueMatch = objectSource.match(
        new RegExp(`\\b${escapeRegExp(column)}\\s*:\\s*(true|false|(['"])(.*?)\\2)`),
      );
      if (!valueMatch) {
        return `${column}=missing`;
      }
      if (valueMatch[1] === "true" || valueMatch[1] === "false") {
        return `${column}=${valueMatch[1]}`;
      }
      return `${column}=string`;
    });
    return `${id}:${support.join(",")}`;
  });
  return `${columns.join(" ")}|${features.join(";")}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatHeadingLevels(levels) {
  return levels.length > 0 ? levels.map((level) => `h${level}`).join(" ") : "(none)";
}

function formatSequence(items) {
  return items.length > 0 ? items.join(" ") : "(none)";
}

async function checkUniqueDocIds(files, baseDirectory, label, errors) {
  const ownersByDocId = new Map();
  for (const file of files) {
    const metadata = await readDocumentMetadata(path.join(baseDirectory, file));
    if (!metadata.docId) {
      continue;
    }
    const owners = ownersByDocId.get(metadata.docId) ?? [];
    owners.push(file);
    ownersByDocId.set(metadata.docId, owners);
  }

  for (const [docId, owners] of ownersByDocId) {
    if (owners.length > 1) {
      errors.push(`Duplicate ${label} docId ${docId}: ${owners.join(", ")}`);
    }
  }
}

async function checkRailroadRules(files, baseDirectory, label, errors) {
  for (const file of files) {
    const metadata = await readDocumentMetadata(path.join(baseDirectory, file));
    for (const rule of metadata.railroadDiagramRules) {
      if (!knownRailroadRules.has(rule)) {
        errors.push(`Unknown RailroadDiagram rule in ${label}/${file}: ${rule}`);
      }
    }
  }
}

async function checkTranslatedComponentLabels(files, baseDirectory, errors) {
  const redundantDefaultProps = [
    ["statusLabel", "有效"],
    ["statusLabel", "警告"],
    ["statusLabel", "错误"],
    ["copyLabel", "复制"],
    ["copiedLabel", "已复制"],
    ["featureLabel", "功能"],
    ["yesLabel", "是"],
    ["noLabel", "否"],
  ];
  const untranslatedDefaultProps = [
    ["statusLabel", "Valid"],
    ["statusLabel", "Warning"],
    ["statusLabel", "Invalid"],
    ["copyLabel", "Copy"],
    ["copiedLabel", "Copied"],
    ["ariaLabel", "Rendered Jianpu score preview"],
    ["featureLabel", "Feature"],
    ["yesLabel", "Yes"],
    ["noLabel", "No"],
  ];

  for (const file of files) {
    const filePath = path.join(baseDirectory, file);
    const source = await readFile(filePath, "utf8");
    for (const [prop, value] of redundantDefaultProps) {
      const pattern = new RegExp(`\\b${prop}=(["'])${escapeRegExp(value)}\\1`);
      if (pattern.test(source)) {
        errors.push(
          `Redundant localized default prop in ${translatedLocale}/${file}: ` +
            `${prop}="${value}" is provided by the component locale defaults`,
        );
      }
    }
    for (const [prop, value] of untranslatedDefaultProps) {
      const pattern = new RegExp(`\\b${prop}=(["'])${escapeRegExp(value)}\\1`);
      if (pattern.test(source)) {
        errors.push(
          `Untranslated component default prop in ${translatedLocale}/${file}: ${prop}="${value}"`,
        );
      }
    }
  }
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

await checkUniqueDocIds(englishFiles, docsRoot, "English", errors);
await checkUniqueDocIds(zhFiles, zhRoot, translatedLocale, errors);
await checkRailroadRules(englishFiles, docsRoot, "English", errors);
await checkRailroadRules(zhFiles, zhRoot, translatedLocale, errors);
await checkTranslatedComponentLabels(zhFiles, zhRoot, errors);

for (const file of englishFiles.filter((item) => zhSet.has(item))) {
  const english = await readDocumentMetadata(path.join(docsRoot, file));
  const translated = await readDocumentMetadata(path.join(zhRoot, file));
  const englishDocId = english.docId;
  const translatedDocId = translated.docId;
  if (!englishDocId) {
    errors.push(`Missing docId in ${file}`);
  }
  if (!translatedDocId) {
    errors.push(`Missing docId in ${translatedLocale}/${file}`);
  }
  if (englishDocId && translatedDocId && englishDocId !== translatedDocId) {
    errors.push(`docId mismatch for ${file}: ${englishDocId} !== ${translatedDocId}`);
  }
  if (english.headingLevels.join(",") !== translated.headingLevels.join(",")) {
    errors.push(
      `Heading structure mismatch for ${file}: ` +
        `${formatHeadingLevels(english.headingLevels)} !== ${formatHeadingLevels(translated.headingLevels)}`,
    );
  }
  if (english.headingLevels.length > 0 || translated.headingLevels.length > 0) {
    if (english.sectionIds.length === 0) {
      errors.push(`Missing sectionIds in ${file}`);
    }
    if (translated.sectionIds.length === 0) {
      errors.push(`Missing sectionIds in ${translatedLocale}/${file}`);
    }
  }
  if (english.sectionIds.length > 0 && english.sectionIds.length !== english.headingLevels.length) {
    errors.push(
      `sectionIds count mismatch for ${file}: ` +
        `${english.sectionIds.length} sectionIds for ${english.headingLevels.length} headings`,
    );
  }
  if (translated.sectionIds.length > 0 && translated.sectionIds.length !== translated.headingLevels.length) {
    errors.push(
      `sectionIds count mismatch for ${translatedLocale}/${file}: ` +
        `${translated.sectionIds.length} sectionIds for ${translated.headingLevels.length} headings`,
    );
  }
  if (english.sectionIds.join(",") !== translated.sectionIds.join(",")) {
    errors.push(
      `sectionIds mismatch for ${file}: ` +
        `${formatSequence(english.sectionIds)} !== ${formatSequence(translated.sectionIds)}`,
    );
  }
  checkSectionIds(file, "English", english.sectionIds, errors);
  checkSectionIds(file, translatedLocale, translated.sectionIds, errors);
  if (english.componentNames.join(",") !== translated.componentNames.join(",")) {
    errors.push(
      `MDX component sequence mismatch for ${file}: ` +
        `${formatSequence(english.componentNames)} !== ${formatSequence(translated.componentNames)}`,
    );
  }
  if (english.jpuExampleKinds.join(",") !== translated.jpuExampleKinds.join(",")) {
    errors.push(
      `Jianpu example sequence mismatch for ${file}: ` +
        `${formatSequence(english.jpuExampleKinds)} !== ${formatSequence(translated.jpuExampleKinds)}`,
    );
  }
  if (english.sourceBackedExampleKinds.join(",") !== translated.sourceBackedExampleKinds.join(",")) {
    errors.push(
      `Source-backed Jianpu example status mismatch for ${file}: ` +
        `${formatSequence(english.sourceBackedExampleKinds)} !== ${formatSequence(
          translated.sourceBackedExampleKinds,
        )}`,
    );
  }
  if (english.sourceBackedComponentSources.join("\n---\n") !== translated.sourceBackedComponentSources.join("\n---\n")) {
    errors.push(`Source-backed Jianpu component source mismatch for ${file}`);
  }
  if (english.relatedLinksHrefs.join("\n---\n") !== translated.relatedLinksHrefs.join("\n---\n")) {
    errors.push(
      `RelatedLinks href sequence mismatch for ${file}: ` +
        `${formatSequence(english.relatedLinksHrefs)} !== ${formatSequence(translated.relatedLinksHrefs)}`,
    );
  }
  if (english.railroadDiagramRules.join(",") !== translated.railroadDiagramRules.join(",")) {
    errors.push(
      `RailroadDiagram rule sequence mismatch for ${file}: ` +
        `${formatSequence(english.railroadDiagramRules)} !== ${formatSequence(translated.railroadDiagramRules)}`,
    );
  }
  if (english.syntaxTokenGridTokens.join("\n---\n") !== translated.syntaxTokenGridTokens.join("\n---\n")) {
    errors.push(
      `SyntaxTokenGrid token sequence mismatch for ${file}: ` +
        `${formatSequence(english.syntaxTokenGridTokens)} !== ${formatSequence(translated.syntaxTokenGridTokens)}`,
    );
  }
  if (english.supportMatrices.join("\n---\n") !== translated.supportMatrices.join("\n---\n")) {
    errors.push(
      `SupportMatrix feature sequence mismatch for ${file}: ` +
        `${formatSequence(english.supportMatrices)} !== ${formatSequence(translated.supportMatrices)}`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${englishFiles.length} translated MDX documents.`);
}
