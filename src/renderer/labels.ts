import type { Document, LyricLine, ScoreLine } from "../core/index.js";

const LABEL_CHARACTER_WIDTH = 8.5;
const LABEL_RIGHT_PADDING = 10;
const LABEL_LEFT_X = 8;

export function scoreLineDisplayLabel(document: Document, line: ScoreLine): string {
  return line.label ? (document.header.raw[line.label] ?? "") : "";
}

export function lyricLineDisplayLabel(document: Document, line: LyricLine): string {
  return document.header.raw[line.label] ?? "";
}

export function labelOffsetForText(label: string): number {
  return label ? Math.ceil(LABEL_LEFT_X + label.length * LABEL_CHARACTER_WIDTH + LABEL_RIGHT_PADDING) : 0;
}

export function labelOffsetForTexts(labels: string[]): number {
  return Math.max(0, ...labels.map(labelOffsetForText));
}
