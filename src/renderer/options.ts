export type JustifyMode = "none" | "except-last" | "all";

export interface RenderOptions {
  pageWidth?: number;
  justifyMode?: JustifyMode;
  activeNoteIndex?: number;
  color?: string;
  background?: string;
}

export const DEFAULT_OPTIONS: Required<RenderOptions> = {
  pageWidth: 1000,
  justifyMode: "none",
  activeNoteIndex: -1,
  color: "currentColor",
  background: "",
};
