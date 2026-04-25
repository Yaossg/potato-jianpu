import { Resvg } from "@resvg/resvg-js";

export interface PngExportOptions {
  background?: string;
}

export function renderPngBytes(svg: string, options: PngExportOptions = {}): Uint8Array {
  const renderer = new Resvg(svg, {
    background: options.background ?? "white",
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "Arial",
      sansSerifFamily: "Arial",
    },
    fitTo: {
      mode: "original",
    },
  });
  return renderer.render().asPng();
}
