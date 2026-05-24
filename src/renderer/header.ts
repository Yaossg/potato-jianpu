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

function renderKeySignature(key: string, x: number, baselineY: number): string {
  return [
    `<g class="key-signature">`,
    `<text class="note" x="${x}" y="${baselineY}" text-anchor="start">${1}</text>`,
    `<text class="metadata" x="${x + 18}" y="${baselineY}"> = ${formatKey(escapeXml(key))}</text>`,
    `</g>`,
  ].join("\n");
}

function renderTimeSignature(beatsPerMeasure: number, beatsPerWholeNote: number, x: number, baselineY: number): string {
  return [
    `<g class="time-signature">`,
    `<text x="${x}" y="${baselineY - 10}" text-anchor="middle" dominant-baseline="central">${beatsPerMeasure}</text>`,
    `<line x1="${x - 8}" y1="${baselineY}" x2="${x + 8}" y2="${baselineY}"/>`,
    `<text x="${x}" y="${baselineY + 10}" text-anchor="middle" dominant-baseline="central">${beatsPerWholeNote}</text>`,
    `</g>`,
  ].join("\n");
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
  parts.push(renderKeySignature(header.keySignatureText, 10, metadataY));
  parts.push(renderTimeSignature(header.timeSignature.beatsPerMeasure, header.timeSignature.beatsPerWholeNote, 72 + 16 * header.keySignatureText.length, metadataY));
  parts.push(renderTempoMark(header.timeSignature.beatsPerWholeNote, header.tempo, 116 + 16 * header.keySignatureText.length, metadataY));
  if (header.composer) {
    parts.push(`<text class="metadata" x="${width - 50}" y="${metadataY}" text-anchor="end">${escapeXml(header.composer)}</text>`);
  }
  return { svg: parts.join("\n"), height };
}
