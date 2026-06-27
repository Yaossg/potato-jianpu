import type { Document } from "../core/index.js";
import { renderHeader } from "./header.js";
import { DEFAULT_OPTIONS, type RenderOptions } from "./options.js";
import { renderScore } from "./score.js";
import { SVG_STYLE } from "./styles.js";
import { escapeXml } from "./xml.js";

export interface RenderedSvgPage {
  svg: string;
  width: number;
  height: number;
}

function resolvedRenderOptions(options: RenderOptions): Required<RenderOptions> {
  const pageMargin = Math.max(0, options.pageMargin ?? DEFAULT_OPTIONS.pageMargin);
  return {
    pageWidth: options.pageWidth ?? DEFAULT_OPTIONS.pageWidth,
    paginate: options.paginate ?? DEFAULT_OPTIONS.paginate,
    pageHeight: options.pageHeight ?? DEFAULT_OPTIONS.pageHeight,
    pageMargin,
    pageFooter: options.pageFooter ?? DEFAULT_OPTIONS.pageFooter,
    pageNumbers: options.pageNumbers ?? DEFAULT_OPTIONS.pageNumbers,
    justifyMode: options.justifyMode ?? DEFAULT_OPTIONS.justifyMode,
    activeNoteIndex: options.activeNoteIndex ?? DEFAULT_OPTIONS.activeNoteIndex,
    activeNoteIndices: options.activeNoteIndices ?? DEFAULT_OPTIONS.activeNoteIndices,
    color: options.color ?? DEFAULT_OPTIONS.color,
    background: options.background ?? DEFAULT_OPTIONS.background,
  };
}

function contentWidth(pageWidth: number, pageMargin: number): number {
  return Math.max(1, pageWidth - pageMargin * 2);
}

function contentHeight(pageHeight: number, inset: PageContentInset): number {
  return Math.max(1, pageHeight - inset.top - inset.bottom);
}

interface PageContentInset {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function pageHasFooter(options: Required<RenderOptions>): boolean {
  return Boolean(options.pageFooter) || options.pageNumbers;
}

function pageContentInset(options: Required<RenderOptions>): PageContentInset {
  return {
    left: options.pageMargin,
    top: options.pageMargin,
    right: options.pageMargin,
    bottom: options.pageMargin + (pageHasFooter(options) ? 26 : 0),
  };
}

function contentGroup(body: string, inset: PageContentInset): string {
  if (!body || (inset.left <= 0 && inset.top <= 0)) {
    return body;
  }
  return `<g class="page-content" transform="translate(${inset.left}, ${inset.top})">\n${body}\n</g>`;
}

function renderPageAdornments(options: Required<RenderOptions>, pageIndex: number, pageCount: number): string {
  const parts: string[] = [];
  const horizontalInset = Math.max(16, options.pageMargin);
  const footerY = options.pageHeight - Math.max(12, options.pageMargin > 0 ? options.pageMargin / 2 - 4 : 14);
  if (options.pageFooter) {
    parts.push(`<text class="page-footer" x="${horizontalInset}" y="${footerY}" text-anchor="start">${escapeXml(options.pageFooter)}</text>`);
  }
  if (options.pageNumbers) {
    parts.push(`<text class="page-number" x="${options.pageWidth / 2}" y="${footerY}" text-anchor="middle">${pageIndex + 1} / ${pageCount}</text>`);
  }
  return parts.join("\n");
}

function svgDocument(width: number, height: number, body: string, color: string): string {
  const rootStyle = color ? ` style="color: ${escapeXml(color)}"` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${rootStyle}>
<defs>
<style>
${SVG_STYLE}
</style>
</defs>
${body}
</svg>`;
}

export function renderSvgPages(document: Document, options: RenderOptions = {}): RenderedSvgPage[] {
  const resolved: Required<RenderOptions> = {
    ...resolvedRenderOptions(options),
  };
  const inset = pageContentInset(resolved);
  const pageContentWidth = contentWidth(resolved.pageWidth, resolved.pageMargin);
  const pageContentHeight = contentHeight(resolved.pageHeight, inset);
  const header = renderHeader(document, pageContentWidth);
  const activeNoteIndices = resolved.activeNoteIndices.length > 0 ? resolved.activeNoteIndices : [resolved.activeNoteIndex];
  const score = renderScore(document, header.height, pageContentWidth, activeNoteIndices, resolved.justifyMode, {
    enabled: resolved.paginate,
    pageHeight: pageContentHeight,
  });
  if (resolved.paginate) {
    const pageCount = Math.max(1, score.pages?.length ?? 0);
    return Array.from({ length: pageCount }, (_, index) => {
      const pageContent = `${index === 0 ? header.svg : ""}${score.pages?.[index] ? `${index === 0 && header.svg ? "\n" : ""}${score.pages[index]}` : ""}`;
      const background = resolved.background
        ? `<rect class="page-background" x="0" y="0" width="${resolved.pageWidth}" height="${resolved.pageHeight}" fill="${escapeXml(resolved.background)}"/>`
        : "";
      const boundary = `<rect class="page-boundary" x="0.5" y="0.5" width="${Math.max(0, resolved.pageWidth - 1)}" height="${Math.max(0, resolved.pageHeight - 1)}" fill="none" stroke="#cbd5e1" stroke-width="1"/>`;
      const adornments = renderPageAdornments(resolved, index, pageCount);
      const page = `<g class="page" data-page="${index + 1}">${adornments ? `\n${adornments}` : ""}${pageContent ? `\n${contentGroup(pageContent, inset)}` : ""}\n</g>`;
      return {
        svg: svgDocument(resolved.pageWidth, resolved.pageHeight, [background, boundary, page].filter(Boolean).join("\n"), resolved.color),
        width: resolved.pageWidth,
        height: resolved.pageHeight,
      };
    });
  }
  const height = Math.max(1, header.height + score.height + inset.top + inset.bottom);
  const adaptiveResolved = { ...resolved, pageHeight: height };
  const background = resolved.background
    ? `<rect class="page-background" x="0" y="0" width="${resolved.pageWidth}" height="${height}" fill="${escapeXml(resolved.background)}"/>`
    : "";
  const adornments = renderPageAdornments(adaptiveResolved, 0, 1);
  const body =
    inset.left > 0 || inset.top > 0
      ? [background, adornments, contentGroup([header.svg, score.svg].filter(Boolean).join("\n"), inset)].filter(Boolean).join("\n")
      : [background, adornments, header.svg, score.svg].filter(Boolean).join("\n");
  return [
    {
      svg: svgDocument(resolved.pageWidth, height, body, resolved.color),
      width: resolved.pageWidth,
      height,
    },
  ];
}

export function renderSvg(document: Document, options: RenderOptions = {}): string {
  const resolved = resolvedRenderOptions(options);
  const inset = pageContentInset(resolved);
  const pageContentWidth = contentWidth(resolved.pageWidth, resolved.pageMargin);
  const pageContentHeight = contentHeight(resolved.pageHeight, inset);
  const header = renderHeader(document, pageContentWidth);
  const activeNoteIndices = resolved.activeNoteIndices.length > 0 ? resolved.activeNoteIndices : [resolved.activeNoteIndex];
  const score = renderScore(document, header.height, pageContentWidth, activeNoteIndices, resolved.justifyMode, {
    enabled: resolved.paginate,
    pageHeight: pageContentHeight,
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
      const adornments = renderPageAdornments(resolved, index, pageCount);
      return `<g class="page" data-page="${index + 1}" transform="translate(0, ${index * resolved.pageHeight})">${adornments ? `\n${adornments}` : ""}${pageContent ? `\n${contentGroup(pageContent, inset)}` : ""}\n</g>`;
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
  const height = Math.max(1, header.height + score.height + inset.top + inset.bottom);
  const adaptiveResolved = { ...resolved, pageHeight: height };
  const rootStyle = resolved.color ? ` style="color: ${escapeXml(resolved.color)}"` : "";
  const background = resolved.background
    ? `<rect class="page-background" x="0" y="0" width="${resolved.pageWidth}" height="${height}" fill="${escapeXml(resolved.background)}"/>`
    : "";
  const adornments = renderPageAdornments(adaptiveResolved, 0, 1);
  const body =
    inset.left > 0 || inset.top > 0
      ? [background, adornments, contentGroup([header.svg, score.svg].filter(Boolean).join("\n"), inset)].filter(Boolean).join("\n")
      : [background, adornments, header.svg, score.svg].filter(Boolean).join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${resolved.pageWidth}" height="${height}" viewBox="0 0 ${resolved.pageWidth} ${height}"${rootStyle}>
<defs>
<style>
${SVG_STYLE}
</style>
</defs>
${body}
</svg>`;
}
