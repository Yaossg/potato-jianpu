function exportBasename(title: string): string {
  const basename = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return basename || "jianpu-score";
}

export function exportFilename(title: string, extension: string): string {
  return `${exportBasename(title)}.${extension}`;
}

export function splitPageExportFilename(title: string, extension: string, pageNumber: number, pageCount: number): string {
  const padding = Math.max(2, String(pageCount).length);
  return `${exportBasename(title)}-${String(pageNumber).padStart(padding, "0")}.${extension}`;
}
