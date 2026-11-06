import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import bravuraUrl from "@vexflow-fonts/bravura/bravura.otf?url";
import notoSansScBoldUrl from "@expo-google-fonts/noto-sans-sc/700Bold/NotoSansSC_700Bold.ttf?url";
import notoSansScRegularUrl from "@expo-google-fonts/noto-sans-sc/400Regular/NotoSansSC_400Regular.ttf?url";
import type { RenderedSvgPage } from "../renderer/index.js";

const PDF_FONT_FAMILY = "NotoSansSC";
const PDF_SMUFL_FONT_FAMILY = "Bravura";
const PDF_TIME_SIGNATURE_LINE_Y_OFFSET = -6.84;
const PDF_TEXT_FONT_OVERRIDE = `
text:not(.smufl-symbol),
.title,
.subtitle,
.metadata,
.page-footer,
.page-number,
.line-label,
.lyric-line,
.lyric-syllable,
.note,
.accidental,
.ending-label,
.tempo-mark,
.tempo-value,
.velocity {
  font-family: ${PDF_FONT_FAMILY}, sans-serif !important;
}
.smufl-symbol {
  font-family: ${PDF_SMUFL_FONT_FAMILY} !important;
}`;

let pdfFontsPromise: Promise<{ regular: string; bold: string; bravura: string }> | null = null;

function orientation(width: number, height: number): "landscape" | "portrait" {
  return width > height ? "landscape" : "portrait";
}

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

async function fetchFontBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load PDF font asset: ${response.status}`);
  }
  return arrayBufferToBase64(await response.arrayBuffer());
}

async function pdfFonts(): Promise<{ regular: string; bold: string; bravura: string }> {
  pdfFontsPromise ??= Promise.all([fetchFontBase64(notoSansScRegularUrl), fetchFontBase64(notoSansScBoldUrl), fetchFontBase64(bravuraUrl)]).then(([regular, bold, bravura]) => ({
    regular,
    bold,
    bravura,
  })).catch((error) => {
    pdfFontsPromise = null;
    throw error;
  });
  return pdfFontsPromise;
}

async function registerPdfFonts(pdf: jsPDF): Promise<void> {
  const fonts = await pdfFonts();
  pdf.addFileToVFS("NotoSansSC-Regular.ttf", fonts.regular);
  pdf.addFont("NotoSansSC-Regular.ttf", PDF_FONT_FAMILY, "normal");
  pdf.addFileToVFS("NotoSansSC-Bold.ttf", fonts.bold);
  pdf.addFont("NotoSansSC-Bold.ttf", PDF_FONT_FAMILY, "bold");
  pdf.addFileToVFS("Bravura.otf", fonts.bravura);
  pdf.addFont("Bravura.otf", PDF_SMUFL_FONT_FAMILY, "normal");
  pdf.setFont(PDF_FONT_FAMILY, "normal");
}

function svgElement(svg: string): SVGSVGElement {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const error = document.querySelector("parsererror");
  if (error) {
    throw new Error("Could not parse SVG for PDF export.");
  }
  const root = document.documentElement;
  const defs = root.querySelector("defs") ?? document.createElementNS("http://www.w3.org/2000/svg", "defs");
  if (!defs.parentElement) {
    root.prepend(defs);
  }
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = PDF_TEXT_FONT_OVERRIDE;
  defs.append(style);
  for (const line of root.querySelectorAll(".time-signature line")) {
    for (const attribute of ["y1", "y2"]) {
      const value = Number(line.getAttribute(attribute));
      if (Number.isFinite(value)) {
        line.setAttribute(attribute, String(value + PDF_TIME_SIGNATURE_LINE_Y_OFFSET));
      }
    }
  }
  return document.documentElement as unknown as SVGSVGElement;
}

export async function svgPagesToPdfBuffer(pages: RenderedSvgPage[]): Promise<ArrayBuffer> {
  if (pages.length === 0) {
    throw new Error("PDF export requires at least one rendered page.");
  }
  for (const page of pages) {
    if (page.width <= 0 || page.height <= 0) {
      throw new Error("PDF export page dimensions must be positive.");
    }
  }

  const firstPage = pages[0]!;
  const pdf = new jsPDF({
    orientation: orientation(firstPage.width, firstPage.height),
    unit: "pt",
    format: [firstPage.width, firstPage.height],
    compress: true,
  });
  await registerPdfFonts(pdf);

  for (const [index, page] of pages.entries()) {
    if (index > 0) {
      pdf.addPage([page.width, page.height], orientation(page.width, page.height));
    }
    await svg2pdf(svgElement(page.svg), pdf, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    });
  }

  return pdf.output("arraybuffer");
}
