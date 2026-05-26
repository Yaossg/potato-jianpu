import type { Document, LyricLine, ScoreLine } from "../core/index.js";

export function scoreLineDisplayLabel(document: Document, line: ScoreLine): string {
  return line.label ? (document.header.raw[line.label] ?? "") : "";
}

export function lyricLineDisplayLabel(document: Document, line: LyricLine): string {
  return document.header.raw[line.label] ?? "";
}
