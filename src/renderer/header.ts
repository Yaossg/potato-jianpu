import type { Document } from "../core/index.js";
import { escapeXml } from "./xml.js";

function formatKey(key: string): string {
  return key.replace("#", "&#9839;").replace("b", "&#9837;");
}

const tempoMarkMap = new Map([
  [2, "𝅗𝅥"],
  [4, "♩"],
  [8, "♪"],
  [16, "𝅘𝅥𝅯"],
]);

function renderTempoMark(beatsPerWholeNote: number, tempo: number, x: number, baselineY: number): string {
  return `<text class="tempo-mark" x="${x}" y="${baselineY}">${tempoMarkMap.get(beatsPerWholeNote) ?? "♩"} = ${tempo}</text>`;
}

export function renderHeader(document: Document, width: number): { svg: string; height: number } {
  const { header } = document;
  if (header.hidden) {
    return { svg: "", height: 0 };
  }
  const parts: string[] = [];
  const titleY = header.title ? 40 : 0;
  const subtitleY = header.subtitle ? titleY + 32 : titleY;
  const metadataY = subtitleY + 40;
  const height = metadataY + 40;

  if (header.title) {
    parts.push(`<text class="title" x="${width / 2}" y="${titleY}" text-anchor="middle">${escapeXml(header.title)}</text>`);
  }
  if (header.subtitle) {
    parts.push(`<text class="subtitle" x="${width / 2}" y="${subtitleY}" text-anchor="middle">${escapeXml(header.subtitle)}</text>`);
  }
  parts.push(`<text class="metadata" x="10" y="${metadataY}">1=${formatKey(escapeXml(header.keySignatureText))}</text>`);
  parts.push(
    `<text class="metadata" x="${72 + 16 * header.keySignatureText.length}" y="${metadataY}">${header.timeSignature.beatsPerMeasure}/${header.timeSignature.beatsPerWholeNote}</text>`,
  );
  parts.push(renderTempoMark(header.timeSignature.beatsPerWholeNote, header.tempo, 116 + 16 * header.keySignatureText.length, metadataY));
  if (header.composer) {
    parts.push(`<text class="metadata" x="${width - 50}" y="${metadataY}" text-anchor="end">${escapeXml(header.composer)}</text>`);
  }
  return { svg: parts.join("\n"), height };
}
