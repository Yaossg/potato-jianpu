import type { Diagnostic } from "../core/model.js";

export interface DiagnosticHighlightPart {
  text: string;
  severity?: Diagnostic["severity"];
  tooltip?: string;
}

export function diagnosticHighlightParts(source: string, diagnostics: Diagnostic[]): DiagnosticHighlightPart[] {
  const ranges = diagnostics
    .filter((diagnostic): diagnostic is Diagnostic & { range: NonNullable<Diagnostic["range"]> } => Boolean(diagnostic.range))
    .map((diagnostic) => {
      const start = Math.min(source.length, Math.max(0, diagnostic.range.start.offset));
      const end = Math.min(source.length, Math.max(start + 1, diagnostic.range.end.offset));
      return { start, end, severity: diagnostic.severity, message: diagnostic.message };
    })
    .filter((range) => range.start < source.length && range.end > range.start);

  const offsets = [...new Set([0, source.length, ...ranges.flatMap((range) => [range.start, range.end])])].sort((left, right) => left - right);
  const parts: DiagnosticHighlightPart[] = [];
  for (let index = 0; index < offsets.length - 1; index += 1) {
    const start = offsets[index]!;
    const end = offsets[index + 1]!;
    const text = source.slice(start, end);
    const activeRanges = ranges.filter((range) => range.start < end && range.end > start);
    const severity = activeRanges.some((range) => range.severity === "error")
      ? "error"
      : activeRanges.some((range) => range.severity === "warning")
        ? "warning"
        : undefined;
    const tooltip = [...activeRanges]
      .sort((left, right) => (left.severity === right.severity ? 0 : left.severity === "error" ? -1 : 1))
      .map((range) => `${range.severity}: ${range.message}`)
      .filter((message, messageIndex, messages) => messages.indexOf(message) === messageIndex)
      .join("\n");
    const previous = parts.at(-1);
    if (previous && previous.severity === severity && previous.tooltip === (tooltip || undefined)) {
      previous.text += text;
    } else {
      parts.push({ text, severity, tooltip: tooltip || undefined });
    }
  }
  return parts.length > 0 ? parts : [{ text: source }];
}

export function sourceLineNumbers(source: string): number[] {
  const lineCount = source.length === 0 ? 1 : source.split(/\r\n|\r|\n/).length;
  return Array.from({ length: lineCount }, (_, index) => index + 1);
}

export function sourceLineAtOffset(source: string, offset: number): number {
  const safeOffset = Math.min(source.length, Math.max(0, offset));
  return source.slice(0, safeOffset).split(/\r\n|\r|\n/).length;
}

export function sourceLines(source: string): string[] {
  return source.length === 0 ? [""] : source.split(/\r\n|\r|\n/);
}
