import type { Document, Note, PitchNote } from "../core/index.js";

export interface RenderOptions {
  pageWidth?: number;
  noteGap?: number;
  measureGap?: number;
  lineGap?: number;
}

interface PositionedNote {
  note: Note;
  x: number;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  pageWidth: 1000,
  noteGap: 28,
  measureGap: 22,
  lineGap: 54,
};

const accidentalMap = new Map([
  [2, "𝄪"],
  [1, "♯"],
  [0, "♮"],
  [-1, "♭"],
  [-2, "𝄫"],
]);

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatKey(key: string): string {
  return key.replace("#", "♯").replace("b", "♭");
}

function durationWidth(note: Note, noteGap: number): number {
  return noteGap + note.duration.dashes * 20 + note.duration.dots * 10;
}

function noteText(note: Note): string {
  switch (note.kind) {
    case "rest":
      return "0";
    case "drum":
      return "X";
    case "pitch":
      return note.chord.map((pitch) => String(pitch.note)).join("/");
  }
}

function renderPitchDecorations(note: PitchNote, x: number, y: number): string {
  const parts: string[] = [];
  for (const [index, pitch] of note.chord.entries()) {
    const noteY = y - index * 22;
    if (pitch.accidental !== undefined) {
      parts.push(
        `<text class="accidental" x="${x - 14}" y="${noteY - 7}">${accidentalMap.get(pitch.accidental)}</text>`,
      );
    }
    if (pitch.octave > 0) {
      for (let i = 0; i < pitch.octave; i += 1) {
        parts.push(`<circle class="dot" cx="${x}" cy="${noteY - 22 - i * 5}" r="2"/>`);
      }
    }
    if (pitch.octave < 0) {
      for (let i = 0; i < Math.abs(pitch.octave); i += 1) {
        const offset = note.duration.halves * 5;
        parts.push(`<circle class="dot" cx="${x}" cy="${noteY + 7 + offset + i * 5}" r="2"/>`);
      }
    }
  }
  return parts.join("");
}

function renderDuration(note: Note, x: number, y: number): string {
  const parts: string[] = [];
  for (let i = 0; i < note.duration.halves; i += 1) {
    const underlineY = y + 6 + i * 5;
    parts.push(`<line class="underline" x1="${x - 10}" y1="${underlineY}" x2="${x + 14}" y2="${underlineY}"/>`);
  }
  for (let i = 0; i < note.duration.dots; i += 1) {
    parts.push(`<circle class="dot" cx="${x + 15 + i * 10}" cy="${y - 9}" r="3"/>`);
  }
  for (let i = 0; i < note.duration.dashes; i += 1) {
    const dashX = x + 14 + i * 20;
    parts.push(`<line class="dash" x1="${dashX}" y1="${y - 9}" x2="${dashX + 14}" y2="${y - 9}"/>`);
  }
  return parts.join("");
}

function renderTie(startX: number, endX: number, y: number): string {
  const midX = (startX + endX) / 2;
  return `<path class="tie" d="M${startX},${y} Q${midX},${y - 14} ${endX},${y} Q${midX},${y - 11} ${startX},${y} Z"/>`;
}

function layoutLine(notes: Note[], options: Required<RenderOptions>): PositionedNote[] {
  const positioned: PositionedNote[] = [];
  let x = 40;
  for (const note of notes) {
    positioned.push({ note, x });
    x += durationWidth(note, options.noteGap);
  }
  return positioned;
}

function renderHeader(document: Document, width: number): { svg: string; height: number } {
  const { header } = document;
  if (header.hidden) {
    return { svg: "", height: 0 };
  }
  const parts: string[] = [];
  let y = 0;
  if (header.title) {
    y += 38;
    parts.push(`<text class="title" x="${width / 2}" y="${y}" text-anchor="middle">${escapeXml(header.title)}</text>`);
  }
  if (header.subtitle) {
    y += 28;
    parts.push(
      `<text class="subtitle" x="${width / 2}" y="${y}" text-anchor="middle">${escapeXml(header.subtitle)}</text>`,
    );
  }
  y += 42;
  parts.push(`<text class="metadata" x="24" y="${y}">1=${escapeXml(formatKey(header.keySignatureText))}</text>`);
  parts.push(
    `<text class="metadata" x="110" y="${y}">${header.timeSignature.beatsPerMeasure}/${header.timeSignature.beatsPerWholeNote}</text>`,
  );
  parts.push(`<text class="metadata" x="176" y="${y}">♩=${header.tempo}</text>`);
  if (header.composer) {
    parts.push(
      `<text class="metadata" x="${width - 36}" y="${y}" text-anchor="end">${escapeXml(header.composer)}</text>`,
    );
  }
  return { svg: parts.join("\n"), height: y + 26 };
}

function renderScore(document: Document, options: Required<RenderOptions>, yStart: number): { svg: string; height: number } {
  const parts: string[] = [];
  let y = yStart + 34;
  for (const line of document.score) {
    let xOffset = 0;
    const lineNotes: PositionedNote[] = [];
    for (const measure of line.measures) {
      const positioned = layoutLine(measure.notes, options).map((entry) => ({ ...entry, x: entry.x + xOffset }));
      lineNotes.push(...positioned);
      const last = positioned.at(-1);
      const measureWidth = last ? last.x + durationWidth(last.note, options.noteGap) - xOffset : 0;
      xOffset += measureWidth + options.measureGap;
      parts.push(`<text class="bar" x="${xOffset - 12}" y="${y}">|</text>`);
    }

    for (const [index, entry] of lineNotes.entries()) {
      const { note, x } = entry;
      if (note.tie && index > 0) {
        parts.push(renderTie(lineNotes[index - 1]!.x, x, y - 25));
      }
      if (note.kind === "pitch") {
        parts.push(renderPitchDecorations(note, x, y));
      }
      parts.push(`<text class="note" x="${x}" y="${y}" text-anchor="middle">${escapeXml(noteText(note))}</text>`);
      parts.push(renderDuration(note, x, y));
    }
    y += options.lineGap;
  }
  return { svg: parts.join("\n"), height: Math.max(0, y - yStart) };
}

export function renderSvg(document: Document, options: RenderOptions = {}): string {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const header = renderHeader(document, resolved.pageWidth);
  const score = renderScore(document, resolved, header.height);
  const height = Math.max(1, header.height + score.height + 24);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${resolved.pageWidth}" height="${height}" viewBox="0 0 ${resolved.pageWidth} ${height}">
<defs>
<style>
.title { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 32px; font-weight: 700; }
.subtitle { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 400; }
.metadata { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 400; }
.note { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: 700; }
.accidental { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; text-anchor: middle; }
.bar { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 34px; font-weight: 400; text-anchor: middle; }
.dot { fill: currentColor; }
.underline { stroke: currentColor; stroke-width: 2.5; }
.dash { stroke: currentColor; stroke-width: 3; }
.tie { fill: currentColor; stroke: currentColor; stroke-width: 1; }
</style>
</defs>
${header.svg}
${score.svg}
</svg>`;
}
