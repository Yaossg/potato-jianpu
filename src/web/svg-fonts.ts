import bravuraWoff2Url from "@vexflow-fonts/bravura/bravura.woff2?url";
import notoSansScBoldUrl from "@expo-google-fonts/noto-sans-sc/700Bold/NotoSansSC_700Bold.ttf?url";
import notoSansScRegularUrl from "@expo-google-fonts/noto-sans-sc/400Regular/NotoSansSC_400Regular.ttf?url";
import { embedBravuraFontFace, svgUsesSmuflSymbols } from "../renderer/index.js";

let bravuraWoff2Base64Promise: Promise<string> | null = null;
let pngFontCssPromise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchBravuraWoff2Base64(): Promise<string> {
  const response = await fetch(bravuraWoff2Url);
  if (!response.ok) {
    throw new Error(`Could not load SVG font asset: ${response.status}`);
  }
  return arrayBufferToBase64(await response.arrayBuffer());
}

async function fetchFontBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load PNG font asset: ${response.status}`);
  }
  return arrayBufferToBase64(await response.arrayBuffer());
}

async function pngFontCss(): Promise<string> {
  pngFontCssPromise ??= Promise.all([fetchFontBase64(notoSansScRegularUrl), fetchFontBase64(notoSansScBoldUrl), fetchBravuraWoff2Base64()]).then(
    ([regular, bold, bravura]) => `<style>
@font-face { font-family: "Noto Sans SC"; font-style: normal; font-weight: 400; src: url("data:font/ttf;base64,${regular}"); }
@font-face { font-family: "Noto Sans SC"; font-style: normal; font-weight: 700; src: url("data:font/ttf;base64,${bold}"); }
@font-face { font-family: Bravura; font-style: normal; font-weight: 400; src: url("data:font/woff2;base64,${bravura}"); }
text:not(.smufl-symbol) { font-family: "Noto Sans SC", sans-serif !important; }
.smufl-symbol { font-family: Bravura !important; }
</style>`,
  );
  return pngFontCssPromise;
}

function injectSvgDefs(svg: string, content: string): string {
  const closingDefs = svg.indexOf("</defs>");
  if (closingDefs >= 0) {
    return `${svg.slice(0, closingDefs)}${content}\n${svg.slice(closingDefs)}`;
  }
  return svg.replace(/<svg\b[^>]*>/, (root) => `${root}\n<defs>${content}</defs>`);
}

export async function embedSvgDownloadFonts(svg: string): Promise<string> {
  if (!svgUsesSmuflSymbols(svg)) {
    return svg;
  }
  bravuraWoff2Base64Promise ??= fetchBravuraWoff2Base64();
  return embedBravuraFontFace(svg, await bravuraWoff2Base64Promise);
}

export async function embedPngExportFonts(svg: string): Promise<string> {
  return injectSvgDefs(svg, await pngFontCss());
}
