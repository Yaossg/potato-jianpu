export function exportFilename(title: string, extension: string): string {
  const basename = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return `${basename || "jianpu-score"}.${extension}`;
}
