import { DEFAULT_PAGE_SIZE } from "./paper.js";

export type JustifyMode = "none" | "except-last" | "all";

export interface RenderOptions {
  pageWidth?: number;
  paginate?: boolean;
  pageHeight?: number;
  pageMargin?: number;
  pageFooter?: string;
  pageNumbers?: boolean;
  measureNumbers?: boolean;
  justifyMode?: JustifyMode;
  activeNoteIndex?: number;
  activeNoteIndices?: number[];
  color?: string;
  background?: string;
}

const SIX_DIGIT_HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isSixDigitHexColor(value: string): boolean {
  return SIX_DIGIT_HEX_COLOR.test(value);
}

export function validateRenderColorOptions(options: RenderOptions): void {
  if (options.color !== undefined && !isSixDigitHexColor(options.color)) {
    throw new Error("Render color must be a six-digit hexadecimal color (#RRGGBB).");
  }
  if (options.background !== undefined && !isSixDigitHexColor(options.background)) {
    throw new Error("Render background must be a six-digit hexadecimal color (#RRGGBB).");
  }
}

export const DEFAULT_OPTIONS: Required<RenderOptions> = {
  pageWidth: DEFAULT_PAGE_SIZE.pageWidth,
  paginate: false,
  pageHeight: DEFAULT_PAGE_SIZE.pageHeight,
  pageMargin: 0,
  pageFooter: "",
  pageNumbers: false,
  measureNumbers: false,
  justifyMode: "none",
  activeNoteIndex: -1,
  activeNoteIndices: [],
  color: "currentColor",
  background: "#ffffff",
};
