import { basename, dirname, extname, join } from "node:path";
import type { RenderedSvgPage } from "../renderer/index.js";
import { renderPngBytes, type PngExportOptions } from "./png.js";

export interface SplitPageOutput<T extends string | Uint8Array> {
  path: string;
  pageNumber: number;
  data: T;
}

export function splitPageOutputPaths(output: string, pageCount: number, extension: "svg" | "png"): string[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("Split page output requires at least one page.");
  }
  const outputExtension = extname(output) || `.${extension}`;
  const outputStem = basename(output, extname(output) || undefined);
  const padding = Math.max(2, String(pageCount).length);

  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = String(index + 1).padStart(padding, "0");
    return join(dirname(output), `${outputStem}-${pageNumber}${outputExtension}`);
  });
}

export function splitSvgPageOutputs(pages: RenderedSvgPage[], output: string): SplitPageOutput<string>[] {
  const paths = splitPageOutputPaths(output, pages.length, "svg");
  return pages.map((page, index) => ({
    path: paths[index]!,
    pageNumber: index + 1,
    data: page.svg,
  }));
}

export function splitPngPageOutputs(
  pages: RenderedSvgPage[],
  output: string,
  options: PngExportOptions = {},
): SplitPageOutput<Uint8Array>[] {
  const paths = splitPageOutputPaths(output, pages.length, "png");
  return pages.map((page, index) => ({
    path: paths[index]!,
    pageNumber: index + 1,
    data: renderPngBytes(page.svg, options),
  }));
}
