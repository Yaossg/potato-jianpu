import type { Document } from "../core/index.js";
import { renderHeader } from "./header.js";
import { DEFAULT_OPTIONS, type RenderOptions } from "./options.js";
import { renderScore } from "./score.js";
import { SVG_STYLE } from "./styles.js";
import { escapeXml } from "./xml.js";

export function renderSvg(document: Document, options: RenderOptions = {}): string {
  const resolved: Required<RenderOptions> = {
    pageWidth: options.pageWidth ?? DEFAULT_OPTIONS.pageWidth,
    paginate: options.paginate ?? DEFAULT_OPTIONS.paginate,
    pageHeight: options.pageHeight ?? DEFAULT_OPTIONS.pageHeight,
    justifyMode: options.justifyMode ?? DEFAULT_OPTIONS.justifyMode,
    activeNoteIndex: options.activeNoteIndex ?? DEFAULT_OPTIONS.activeNoteIndex,
    activeNoteIndices: options.activeNoteIndices ?? DEFAULT_OPTIONS.activeNoteIndices,
    color: options.color ?? DEFAULT_OPTIONS.color,
    background: options.background ?? DEFAULT_OPTIONS.background,
  };
  const header = renderHeader(document, resolved.pageWidth);
  const activeNoteIndices = resolved.activeNoteIndices.length > 0 ? resolved.activeNoteIndices : [resolved.activeNoteIndex];
  const score = renderScore(document, header.height, resolved.pageWidth, activeNoteIndices, resolved.justifyMode, {
    enabled: resolved.paginate,
    pageHeight: resolved.pageHeight,
  });
  if (resolved.paginate) {
    const pageCount = Math.max(1, score.pages?.length ?? 0);
    const height = resolved.pageHeight * pageCount;
    const rootStyle = resolved.color ? ` style="color: ${escapeXml(resolved.color)}"` : "";
    const backgrounds = resolved.background
      ? Array.from(
          { length: pageCount },
          (_, index) =>
            `<rect class="page-background" x="0" y="${index * resolved.pageHeight}" width="${resolved.pageWidth}" height="${resolved.pageHeight}" fill="${escapeXml(resolved.background)}"/>`,
        ).join("\n")
      : "";
    const boundaries = Array.from(
      { length: pageCount },
      (_, index) =>
        `<rect class="page-boundary" x="0.5" y="${index * resolved.pageHeight + 0.5}" width="${Math.max(0, resolved.pageWidth - 1)}" height="${Math.max(0, resolved.pageHeight - 1)}" fill="none" stroke="#cbd5e1" stroke-width="1"/>`,
    ).join("\n");
    const pages = Array.from({ length: pageCount }, (_, index) => {
      const pageContent = `${index === 0 ? header.svg : ""}${score.pages?.[index] ? `${index === 0 && header.svg ? "\n" : ""}${score.pages[index]}` : ""}`;
      return `<g class="page" data-page="${index + 1}" transform="translate(0, ${index * resolved.pageHeight})">${pageContent ? `\n${pageContent}\n` : ""}</g>`;
    }).join("\n");
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${resolved.pageWidth}" height="${height}" viewBox="0 0 ${resolved.pageWidth} ${height}"${rootStyle}>
<defs>
<style>
${SVG_STYLE}
</style>
</defs>
${backgrounds}
${boundaries}
${pages}
</svg>`;
  }
  const height = Math.max(1, header.height + score.height);
  const rootStyle = resolved.color ? ` style="color: ${escapeXml(resolved.color)}"` : "";
  const background = resolved.background
    ? `<rect class="page-background" x="0" y="0" width="${resolved.pageWidth}" height="${height}" fill="${escapeXml(resolved.background)}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${resolved.pageWidth}" height="${height}" viewBox="0 0 ${resolved.pageWidth} ${height}"${rootStyle}>
<defs>
<style>
${SVG_STYLE}
</style>
</defs>
${background}
${header.svg}
${score.svg}
</svg>`;
}
