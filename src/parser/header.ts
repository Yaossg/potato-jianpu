import type { Diagnostic, Header, KeySignature, SourceRange, TimeSignature } from "../core/index.js";

export interface RawHeaderField {
  value: string;
  range: SourceRange;
}

export type RawHeaderInput = Record<string, string | RawHeaderField>;

const keyMap: Record<string, KeySignature> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

function parseKeySignature(key: string): KeySignature | null {
  const normalized = key.replace(" ", "");
  if (normalized in keyMap) {
    return keyMap[normalized]!;
  }
  const reversed = [...normalized].reverse().join("");
  if (reversed in keyMap) {
    return keyMap[reversed]!;
  }
  return null;
}

function parseTimeSignature(time: string): TimeSignature | null {
  const [rawBeatsPerMeasure, rawBeatsPerWholeNote] = time
    .split("/", 2)
    .map((part) => Number(part.trim()));

  const beatsPerMeasure = rawBeatsPerMeasure as TimeSignature["beatsPerMeasure"];
  const beatsPerWholeNote = rawBeatsPerWholeNote as TimeSignature["beatsPerWholeNote"];

  if (![2, 3, 4, 6, 9, 12].includes(beatsPerMeasure)) {
    return null;
  }
  if (![2, 4, 8, 16].includes(beatsPerWholeNote)) {
    return null;
  }
  return { beatsPerMeasure, beatsPerWholeNote };
}

function headerValue(raw: RawHeaderInput, key: string): string | undefined {
  const field = raw[key];
  return typeof field === "string" ? field : field?.value;
}

function headerRange(raw: RawHeaderInput, key: string): SourceRange | undefined {
  const field = raw[key];
  return typeof field === "string" ? undefined : field?.range;
}

function rawHeaderValues(raw: RawHeaderInput): Record<string, string> {
  return Object.fromEntries(Object.entries(raw).map(([key, field]) => [key, typeof field === "string" ? field : field.value]));
}

export function normalizeHeader(raw: RawHeaderInput): { header: Header; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const rawValues = rawHeaderValues(raw);
  const tempoText = headerValue(raw, "tempo") ?? "120";
  const tempo = Number(tempoText);
  if (Number.isNaN(tempo) || tempo <= 0) {
    diagnostics.push({ severity: "error", message: `Invalid tempo '${tempoText}'.`, range: headerRange(raw, "tempo") });
  }

  const timeText = headerValue(raw, "time") ?? "4/4";
  const timeSignature = parseTimeSignature(timeText);
  if (timeSignature === null) {
    diagnostics.push({ severity: "error", message: `Invalid time signature '${timeText}'.`, range: headerRange(raw, "time") });
  }

  const keyText = headerValue(raw, "key") ?? "C";
  const keySignature = parseKeySignature(keyText);
  if (keySignature === null) {
    diagnostics.push({ severity: "error", message: `Invalid key signature '${keyText}'.`, range: headerRange(raw, "key") });
  }

  return {
    header: {
      raw: rawValues,
      title: headerValue(raw, "title") ?? "",
      subtitle: headerValue(raw, "subtitle") ?? "",
      composer: headerValue(raw, "composer") ?? "",
      keySignature: keySignature ?? 0,
      keySignatureText: keyText,
      timeSignature: timeSignature ?? { beatsPerMeasure: 4, beatsPerWholeNote: 4 },
      tempo: Number.isNaN(tempo) || tempo <= 0 ? 120 : tempo,
      hidden: headerValue(raw, "hidden") ?? "",
    },
    diagnostics,
  };
}
