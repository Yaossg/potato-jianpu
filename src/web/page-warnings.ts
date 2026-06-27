export type PageLayoutWarning =
  | { kind: "small-usable-page-height"; usableHeight: number }
  | { kind: "excessive-page-count"; pageCount: number };

export interface PageLayoutWarningOptions {
  paginate: boolean;
  pageHeight: number;
  pageMargin: number;
  pageFooter: string;
  pageNumbers: boolean;
  pageCount: number;
}

const PAGE_ADORNMENT_HEIGHT = 26;
const MIN_USABLE_PAGE_HEIGHT = 240;
const EXCESSIVE_PAGE_COUNT = 12;

export function usablePageHeight(options: Pick<PageLayoutWarningOptions, "pageHeight" | "pageMargin" | "pageFooter" | "pageNumbers">): number {
  const adornmentHeight = options.pageFooter || options.pageNumbers ? PAGE_ADORNMENT_HEIGHT : 0;
  return Math.max(1, options.pageHeight - options.pageMargin * 2 - adornmentHeight);
}

export function pageLayoutWarnings(options: PageLayoutWarningOptions): PageLayoutWarning[] {
  if (!options.paginate) {
    return [];
  }

  const warnings: PageLayoutWarning[] = [];
  const usableHeight = usablePageHeight(options);
  if (usableHeight < MIN_USABLE_PAGE_HEIGHT) {
    warnings.push({ kind: "small-usable-page-height", usableHeight });
  }
  if (options.pageCount >= EXCESSIVE_PAGE_COUNT) {
    warnings.push({ kind: "excessive-page-count", pageCount: options.pageCount });
  }
  return warnings;
}
