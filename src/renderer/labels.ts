import type { Document, LyricLine, ScoreLine } from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";

const LABEL_CHARACTER_WIDTH = 8.5;
const LABEL_RIGHT_PADDING = 10;
const LABEL_LEFT_X = 8;

export function scoreLineDisplayLabel(document: Document, line: ScoreLine, defaultLabel = ""): string {
  return document.header.trackNames[line.label ?? defaultLabel] ?? "";
}

export function lyricLineDisplayLabel(document: Document, line: LyricLine): string {
  return document.header.lyricLabels[line.label] ?? "";
}

export function labelOffsetForText(label: string): number {
  // CJK glyphs and fullwidth forms occupy an em, not the Latin average advance.
  // Iterate code points so supplementary Han characters count as one glyph.
  const width = [...label].reduce((sum, char) => {
    const fullwidth = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff01-\uff60\uffe0-\uffe6]/u.test(char);
    return sum + (fullwidth ? DIMENSIONS.labelFontSize : LABEL_CHARACTER_WIDTH);
  }, 0);
  return label ? Math.ceil(LABEL_LEFT_X + width + LABEL_RIGHT_PADDING) : 0;
}

export function labelOffsetForTexts(labels: string[]): number {
  return Math.max(0, ...labels.map(labelOffsetForText));
}
