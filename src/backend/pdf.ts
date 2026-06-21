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
  },
) => void;

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as PdfDocumentConstructor;
const SVGtoPDF = require("svg-to-pdfkit") as SvgToPdf;

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
  const chunks: Buffer[] = [];
  const complete = new Promise<Uint8Array>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    document.on("error", reject);
  });

  for (const page of pages) {
    document.addPage({ size: [page.width, page.height], margin: 0 });
    SVGtoPDF(document, page.svg, 0, 0, {
      width: page.width,
      height: page.height,
      assumePt: true,
      preserveAspectRatio: "none",
    });
  }

  document.end();
  return complete;
}
