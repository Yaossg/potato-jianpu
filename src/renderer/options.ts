export interface RenderOptions {
  pageWidth?: number;
  activeNoteIndex?: number;
  color?: string;
  background?: string;
}

export const DEFAULT_OPTIONS: Required<RenderOptions> = {
  pageWidth: 1000,
  activeNoteIndex: -1,
  color: "currentColor",
  background: "",
};
