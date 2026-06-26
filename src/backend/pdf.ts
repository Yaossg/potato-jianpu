import { createRequire } from "node:module";
import type { RenderedSvgPage } from "../renderer/index.js";

export interface PdfExportOptions {
  title?: string;
}

type PdfDocumentConstructor = new (options: { autoFirstPage: false; margin: number; info?: { Title?: string } }) => PDFKit.PDFDocument;
type SvgToPdf = (
  document: PDFKit.PDFDocument,
  svg: string,
  x: number,
  y: number,
  options: {
    width: number;
    height: number;
    assumePt: boolean;
    preserveAspectRatio: string;
    fontCallback?: (family: string, bold: boolean, italic: boolean, fontOptions: { fauxItalic: boolean; fauxBold: boolean }) => string;
  },
) => void;

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as PdfDocumentConstructor;
const SVGtoPDF = require("svg-to-pdfkit") as SvgToPdf;
const PDF_FONT_FAMILY = "NotoSansSC";
const PDF_TIME_SIGNATURE_LINE_Y_OFFSET = -6.84;
const regularFontPath = require.resolve("@expo-google-fonts/noto-sans-sc/400Regular/NotoSansSC_400Regular.ttf");
const boldFontPath = require.resolve("@expo-google-fonts/noto-sans-sc/700Bold/NotoSansSC_700Bold.ttf");

function registerPdfFonts(document: PDFKit.PDFDocument) {
  document.registerFont(PDF_FONT_FAMILY, regularFontPath);
  document.registerFont(`${PDF_FONT_FAMILY}-Bold`, boldFontPath);
}

function pdfFontName(_family: string, bold: boolean): string {
  return bold ? `${PDF_FONT_FAMILY}-Bold` : PDF_FONT_FAMILY;
}

function svgForPdf(svg: string): string {
  return svg.replace(/<g class="time-signature">[\s\S]*?<\/g>/g, (group) => normalizeTimeSignatureForPdf(group));
}

function formatPdfNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function normalizeTimeSignatureForPdf(group: string): string {
  return group.replace(/\b(y[12])="([^"]+)"/g, (_match, attribute: string, value: string) => {
    return `${attribute}="${formatPdfNumber(Number(value) + PDF_TIME_SIGNATURE_LINE_Y_OFFSET)}"`;
  });
}

export async function renderPdfBytes(pages: RenderedSvgPage[], options: PdfExportOptions = {}): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error("PDF export requires at least one rendered page.");
  }
  for (const page of pages) {
    if (page.width <= 0 || page.height <= 0) {
      throw new Error("PDF export page dimensions must be positive.");
    }
  }

  const document = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    info: options.title ? { Title: options.title } : undefined,
  });
  registerPdfFonts(document);
  const chunks: Buffer[] = [];
  const complete = new Promise<Uint8Array>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    document.on("error", reject);
  });

  for (const page of pages) {
    document.addPage({ size: [page.width, page.height], margin: 0 });
    SVGtoPDF(document, svgForPdf(page.svg), 0, 0, {
      width: page.width,
      height: page.height,
      assumePt: true,
      preserveAspectRatio: "none",
      fontCallback: pdfFontName,
    });
  }

  document.end();
  return complete;
}
