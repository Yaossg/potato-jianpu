import type { Document, ScoreLine } from "../core/index.js";

export function scoreLineDisplayLabel(document: Document, line: ScoreLine): string {
  return line.label ? (document.header.raw[line.label] ?? "") : "";
}
