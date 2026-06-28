export const PAPER_PRESET_LIST = [
  // Paper presets intentionally use twice the 72-DPI/PDF-point dimensions so
  // notation keeps the default layout scale. Add future presets by the same rule.
  { name: "a4", label: "A4", width: 1190, height: 1684 },
  { name: "b5", label: "B5", width: 998, height: 1418 },
  { name: "letter", label: "Letter", width: 1224, height: 1584 },
] as const;

export type PaperPresetName = (typeof PAPER_PRESET_LIST)[number]["name"];

export const PAGE_ORIENTATIONS = ["portrait", "landscape"] as const;

export type PageOrientation = (typeof PAGE_ORIENTATIONS)[number];

export interface PageSizeOptions {
  paper?: PaperPresetName;
  orientation?: PageOrientation;
  pageWidth?: number;
  pageHeight?: number;
}

export interface ResolvedPageSize {
  pageWidth: number;
  pageHeight: number;
}

export const DEFAULT_PAGE_SIZE: ResolvedPageSize = {
  pageWidth: 1000,
  pageHeight: 1400,
};

const DEFAULT_PAPER_SIZE = {
  width: DEFAULT_PAGE_SIZE.pageWidth,
  height: DEFAULT_PAGE_SIZE.pageHeight,
};

const PAPER_PRESETS: Record<PaperPresetName, (typeof PAPER_PRESET_LIST)[number]> = Object.fromEntries(
  PAPER_PRESET_LIST.map((preset) => [preset.name, preset]),
) as Record<PaperPresetName, (typeof PAPER_PRESET_LIST)[number]>;

export function isPaperPresetName(value: string): value is PaperPresetName {
  return Object.hasOwn(PAPER_PRESETS, value);
}

export function isPageOrientation(value: string): value is PageOrientation {
  return PAGE_ORIENTATIONS.includes(value as PageOrientation);
}

export function resolvePageSize(options: PageSizeOptions = {}): ResolvedPageSize {
  const base = options.paper ? PAPER_PRESETS[options.paper] : DEFAULT_PAPER_SIZE;
  const orientation = options.orientation ?? "portrait";
  const oriented =
    orientation === "landscape"
      ? { pageWidth: base.height, pageHeight: base.width }
      : { pageWidth: base.width, pageHeight: base.height };

  return {
    pageWidth: options.pageWidth ?? oriented.pageWidth,
    pageHeight: options.pageHeight ?? oriented.pageHeight,
  };
}
