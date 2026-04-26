import type { Document } from "../core/index.js";
import { renderHeader } from "./header.js";
import { DEFAULT_OPTIONS, type RenderOptions } from "./options.js";
import { renderScore } from "./score.js";
import { SVG_STYLE } from "./styles.js";
import { escapeXml } from "./xml.js";

export function renderSvg(document: Document, options: RenderOptions = {}): string {
  const resolved: Required<RenderOptions> = {
    pageWidth: options.pageWidth ?? DEFAULT_OPTIONS.pageWidth,
    activeNoteIndex: options.activeNoteIndex ?? DEFAULT_OPTIONS.activeNoteIndex,
    color: options.color ?? DEFAULT_OPTIONS.color,
    background: options.background ?? DEFAULT_OPTIONS.background,
  };
  const header = renderHeader(document, resolved.pageWidth);
  const score = renderScore(document, header.height, resolved.pageWidth, resolved.activeNoteIndex);
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
