import bravuraWoff2Url from "@vexflow-fonts/bravura/bravura.woff2?url";
import { embedBravuraFontFace, svgUsesSmuflSymbols } from "../renderer/index.js";

let bravuraWoff2Base64Promise: Promise<string> | null = null;

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

export async function embedSvgDownloadFonts(svg: string): Promise<string> {
  if (!svgUsesSmuflSymbols(svg)) {
    return svg;
  }
  bravuraWoff2Base64Promise ??= fetchBravuraWoff2Base64();
  return embedBravuraFontFace(svg, await bravuraWoff2Base64Promise);
}
