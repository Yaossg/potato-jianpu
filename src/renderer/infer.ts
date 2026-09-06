import type { Document, ScoreLine } from "../core/index.js";
import { DIMENSIONS } from "./dimensions.js";
import { labelOffsetForTexts, lyricLineDisplayLabel, scoreLineDisplayLabel } from "./labels.js";
import { layoutLine } from "./layout.js";
import { lyricTextWidth } from "./lyrics.js";
import { DEFAULT_OPTIONS } from "./options.js";

export interface InferPageWidthOptions {
  minWidth?: number;
  maxWidth?: number;
}

const HEADER_METADATA_MIN_WIDTH = 240;
function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.ceil(width)));
}

function headerNaturalWidth(document: Document): number {
  if (document.header.hidden) {
    return 0;
  }
  const titleWidth = Math.max(document.header.title.length, document.header.subtitle.length) * 18 + DIMENSIONS.leftPadding * 2;
  const composerWidth = document.header.composer ? document.header.composer.length * 9 + 170 : 0;
  const metadataWidth = 116 + 16 * document.header.keySignatureText.length + 72 + composerWidth;
  return Math.max(HEADER_METADATA_MIN_WIDTH, titleWidth, metadataWidth);
}

function scoreLineGroups(document: Document): ScoreLine[][] {
  if (!document.score.some((line) => line.label !== undefined)) {
    return document.score.map((line) => [line]);
  }
  const groups: ScoreLine[][] = [];
  let current: ScoreLine[] = [];
  for (const line of document.score) {
    if (line.label === "T1" && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
}

export function inferContentPageWidth(document: Document, options: InferPageWidthOptions = {}): number {
  const minWidth = options.minWidth ?? 1;
  const maxWidth = options.maxWidth ?? DEFAULT_OPTIONS.pageWidth;
  const scoreWidth = Math.max(
    0,
    ...scoreLineGroups(document).flatMap((group) => {
      const lyrics = group.flatMap((line) => line.lyrics ?? []);
      const labelOffset = labelOffsetForTexts([
        ...group.map((line) => scoreLineDisplayLabel(document, line)),
        ...lyrics.map((lyric) => lyricLineDisplayLabel(document, lyric)),
      ]);
      const bracketOffset = group.length > 1 ? DIMENSIONS.voiceBracketWidth * 2 : 0;
      const maxLyricTextWidth = Math.max(0, ...lyrics.map((lyric) => lyricTextWidth(lyric.text)));
      const lyricWidth = maxLyricTextWidth > 0 ? maxLyricTextWidth + labelOffset + bracketOffset + DIMENSIONS.leftPadding : 0;
      const notationWidths = group.flatMap((line) => layoutLine(line, Number.POSITIVE_INFINITY).map((layout) => layout.width + labelOffset + bracketOffset));
      return [...notationWidths, lyricWidth];
    }),
  );
  return clampWidth(Math.max(headerNaturalWidth(document), scoreWidth), minWidth, maxWidth);
}
