export type JustifyMode = "none" | "except-last" | "all";

export interface RenderOptions {
  pageWidth?: number;
  paginate?: boolean;
  pageHeight?: number;
  pageMargin?: number;
  justifyMode?: JustifyMode;
  activeNoteIndex?: number;
  activeNoteIndices?: number[];
  color?: string;
  background?: string;
}

export const DEFAULT_OPTIONS: Required<RenderOptions> = {
  pageWidth: 1000,
  paginate: false,
  pageHeight: 1400,
  pageMargin: 0,
  justifyMode: "none",
  activeNoteIndex: -1,
  activeNoteIndices: [],
  color: "currentColor",
  background: "",
};
