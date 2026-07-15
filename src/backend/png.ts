import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import { isSixDigitHexColor } from "../renderer/index.js";

export interface PngExportOptions {
  background?: string;
  scale?: number;
}

const require = createRequire(import.meta.url);
const regularFontPath = require.resolve("@expo-google-fonts/noto-sans-sc/400Regular/NotoSansSC_400Regular.ttf");
const boldFontPath = require.resolve("@expo-google-fonts/noto-sans-sc/700Bold/NotoSansSC_700Bold.ttf");
const bravuraFontPath = require.resolve("@vexflow-fonts/bravura/bravura.otf");
const DEFAULT_PNG_SCALE = 2;
const PNG_FONT_OVERRIDE = `<style>
text:not(.smufl-symbol) { font-family: "Noto Sans SC", sans-serif !important; }
.smufl-symbol { font-family: Bravura !important; }
</style>`;

function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svgForPng(svg: string, background?: string): string {
  const withBackground = background
    ? svg.replace(/<svg\b[^>]*>/, (root) => `${root}\n<rect width="100%" height="100%" fill="${escapeXmlAttribute(background)}"/>`)
    : svg;
  const closingDefs = withBackground.indexOf("</defs>");
  if (closingDefs >= 0) {
    return `${withBackground.slice(0, closingDefs)}${PNG_FONT_OVERRIDE}\n${withBackground.slice(closingDefs)}`;
  }
  return withBackground.replace(/<svg\b[^>]*>/, (root) => `${root}\n<defs>${PNG_FONT_OVERRIDE}</defs>`);
}

export function renderPngBytes(svg: string, options: PngExportOptions = {}): Uint8Array {
  const scale = options.scale ?? DEFAULT_PNG_SCALE;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("PNG scale must be a positive number.");
  }
  if (options.background !== undefined && !isSixDigitHexColor(options.background)) {
    throw new Error("PNG background must be a six-digit hexadecimal color (#RRGGBB).");
  }
  const renderer = new Resvg(svgForPng(svg, options.background), {
    background: "white",
    font: {
      fontFiles: [regularFontPath, boldFontPath, bravuraFontPath],
      loadSystemFonts: false,
      defaultFontFamily: "Noto Sans SC",
      sansSerifFamily: "Noto Sans SC",
    },
    fitTo: {
      mode: "zoom",
      value: scale,
    },
  });
  return renderer.render().asPng();
}
