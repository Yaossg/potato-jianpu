import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import type { RenderedSvgPage } from "../renderer/index.js";

function orientation(width: number, height: number): "landscape" | "portrait" {
  return width > height ? "landscape" : "portrait";
}

function svgElement(svg: string): SVGSVGElement {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const error = document.querySelector("parsererror");
  if (error) {
    throw new Error("Could not parse SVG for PDF export.");
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
