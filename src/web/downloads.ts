import { embedPngExportFonts } from "./svg-fonts.js";

export const DEFAULT_PNG_SCALE = 2;
export const PNG_SCALE_OPTIONS = [1, 2, 3] as const;

export interface PngExportOptions {
  scale?: number;
}

export function downloadBytes(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function svgDimensions(svgText: string): { width: number; height: number } {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = document.documentElement;
  const width = Number.parseFloat(root.getAttribute("width") ?? "");
  const height = Number.parseFloat(root.getAttribute("height") ?? "");
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height };
  }

  const viewBox = root
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part));
  if (viewBox?.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2]! > 0 && Number.isFinite(viewBox[3]) && viewBox[3]! > 0) {
    return { width: viewBox[2]!, height: viewBox[3]! };
  }

  throw new Error("SVG output does not declare export dimensions.");
}

export function pngPixelDimensions(svgText: string, scale = DEFAULT_PNG_SCALE): { width: number; height: number } {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("PNG scale must be a positive number.");
  }
  const { width, height } = svgDimensions(svgText);
  return { width: Math.ceil(width * scale), height: Math.ceil(height * scale) };
}

export async function svgToPngBlob(svgText: string, options: PngExportOptions = {}): Promise<Blob> {
  const scale = options.scale ?? DEFAULT_PNG_SCALE;
  const { width, height } = svgDimensions(svgText);
  const dimensions = pngPixelDimensions(svgText, scale);
  const svgBlob = new Blob([await embedPngExportFonts(svgText)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not load SVG for PNG export."));
    });
    image.src = url;
    if (image.decode) {
      await image.decode().catch(() => loaded);
    } else {
      await loaded;
    }

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create canvas context for PNG export.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, width, height, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not encode PNG export."));
        }
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
