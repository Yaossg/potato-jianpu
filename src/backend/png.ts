import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";

export interface PngExportOptions {
  background?: string;
}

const require = createRequire(import.meta.url);
const bravuraFontPath = require.resolve("@vexflow-fonts/bravura/bravura.otf");

export function renderPngBytes(svg: string, options: PngExportOptions = {}): Uint8Array {
  const renderer = new Resvg(svg, {
    background: options.background ?? "white",
    font: {
      fontFiles: [bravuraFontPath],
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
