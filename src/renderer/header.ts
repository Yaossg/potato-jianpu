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

const KEY_SIGNATURE_X = 10;
const METADATA_GROUP_GAP = 24;
const KEY_NOTE_WIDTH = 18;
const KEY_EQUALS_WIDTH = 10;
const KEY_SPACE_WIDTH = 6;
const KEY_TEXT_WIDTH = 10;
const TIME_SIGNATURE_WIDTH = 20;
const TEMPO_SPACE_WIDTH = 6;
const TEMPO_TEXT_WIDTH = 10;

function displayKeyText(key: string): string {
  return key.replace(/#/g, "♯").replace(/b/g, "♭");
}

function estimateDisplayWidth(text: string, defaultWidth: number): number {
  let width = 0;
  for (const char of text) {
    if (char === " ") {
      width += defaultWidth === TEMPO_TEXT_WIDTH ? TEMPO_SPACE_WIDTH : KEY_SPACE_WIDTH;
    } else if (char === "=") {
      width += KEY_EQUALS_WIDTH;
    } else if (char === "♯" || char === "♭" || char === "♮" || /\d/.test(char) || /[A-Za-z]/.test(char)) {
      width += defaultWidth;
    } else {
      width += defaultWidth;
    }
  }
  return width;
}

function keySignatureWidth(key: string): number {
  return KEY_NOTE_WIDTH + estimateDisplayWidth(` = ${displayKeyText(key)}`, KEY_TEXT_WIDTH);
}

function tempoMarkText(beatsPerWholeNote: number, tempo: number): string {
  return `${tempoMarkMap.get(beatsPerWholeNote) ?? "♩"} = ${tempo}`;
}

function tempoMarkWidth(beatsPerWholeNote: number, tempo: number): number {
  return estimateDisplayWidth(tempoMarkText(beatsPerWholeNote, tempo), TEMPO_TEXT_WIDTH);
}

function metadataLayout(header: Document["header"]): { keyX: number; timeX: number; tempoX: number; width: number } {
  const keyWidth = keySignatureWidth(header.keySignatureText);
  const timeStartX = KEY_SIGNATURE_X + keyWidth + METADATA_GROUP_GAP;
  const tempoX = timeStartX + TIME_SIGNATURE_WIDTH + METADATA_GROUP_GAP;
  return {
    keyX: KEY_SIGNATURE_X,
    timeX: timeStartX + TIME_SIGNATURE_WIDTH / 2,
    tempoX,
    width: tempoX + tempoMarkWidth(header.timeSignature.beatsPerWholeNote, header.tempo) - KEY_SIGNATURE_X,
  };
}

function renderTempoMark(beatsPerWholeNote: number, tempo: number, x: number, centerY: number): string {
  return `<text class="tempo-mark" x="${x}" y="${centerY}" dominant-baseline="central">${tempoMarkText(beatsPerWholeNote, tempo)}</text>`;
}

function renderKeySignature(key: string, x: number, centerY: number): string {
  return [
    `<g class="key-signature">`,
    `<text class="note" x="${x}" y="${centerY}" text-anchor="start" dominant-baseline="central">${1}</text>`,
    `<text class="metadata" x="${x + 18}" y="${centerY}" dominant-baseline="central"> = ${formatKey(escapeXml(key))}</text>`,
    `</g>`,
  ].join("\n");
}

function renderTimeSignature(beatsPerMeasure: number, beatsPerWholeNote: number, x: number, centerY: number): string {
  return [
    `<g class="time-signature">`,
    `<text x="${x}" y="${centerY - 8}" text-anchor="middle" dominant-baseline="central">${beatsPerMeasure}</text>`,
    `<line x1="${x - 8}" y1="${centerY}" x2="${x + 8}" y2="${centerY}"/>`,
    `<text x="${x}" y="${centerY + 8}" text-anchor="middle" dominant-baseline="central">${beatsPerWholeNote}</text>`,
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
  const layout = metadataLayout(header);
  parts.push(renderKeySignature(header.keySignatureText, layout.keyX, metadataY));
  parts.push(renderTimeSignature(header.timeSignature.beatsPerMeasure, header.timeSignature.beatsPerWholeNote, layout.timeX, metadataY));
  parts.push(renderTempoMark(header.timeSignature.beatsPerWholeNote, header.tempo, layout.tempoX, metadataY));
  if (header.composer) {
    parts.push(`<text class="metadata" x="${width - 50}" y="${metadataY}" text-anchor="end">${escapeXml(header.composer)}</text>`);
  }
  return { svg: parts.join("\n"), height };
}
