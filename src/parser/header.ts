import { resolveMelodicProgramName, type Diagnostic, type Header, type KeySignature, type SourceRange, type TimeSignature } from "../core/index.js";

export interface HeaderValue {
  text: string;
  range: SourceRange;
  quoted: boolean;
}

export type HeaderPropertyResult = "ok" | "unknown";

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

const semanticKeys = new Set(["title", "subtitle", "composer", "key", "time", "tempo", "hidden", "program", "volume"]);

export function createDefaultHeader(): Header {
  return {
    title: "",
    subtitle: "",
    composer: "",
    keySignature: 0,
    keySignatureText: "C",
    timeSignature: { beatsPerMeasure: 4, beatsPerWholeNote: 4 },
    tempo: 120,
    hidden: false,
    trackNames: {},
    trackPrograms: {},
    trackVolumes: {},
    lyricLabels: {},
  };
}

export function isTrackLabel(label: string): boolean {
  return /^T(?:[1-9]|1[1-6])$/.test(label);
}

export function isMelodicScoreTrackLabel(label: string): boolean {
  return /^T(?:[1-9]|1[1-6])$/.test(label);
}

export function isLyricLabel(label: string): boolean {
  return /^L\d+$/.test(label);
}

export function applyHeaderProperty(
  header: Header,
  seen: Set<string>,
  key: string,
  keyRange: SourceRange,
  value: HeaderValue | null,
  diagnostics: Diagnostic[],
): HeaderPropertyResult {
  const textKey = semanticKeys.has(key) ? key : null;
  if (textKey === "title" || textKey === "subtitle" || textKey === "composer") {
    if (!value || !expectQuoted(value, textKey, diagnostics)) {
      return "ok";
    }
    if (!recordKey(seen, textKey, `Duplicate header property '${textKey}'.`, keyRange, diagnostics)) {
      return "ok";
    }
    header[textKey] = value.text;
    return "ok";
  }

  if (textKey === "tempo") {
    if (!value || !recordKey(seen, "tempo", "Duplicate header property 'tempo'.", keyRange, diagnostics)) {
      return "ok";
    }
    parseTempo(header, value, diagnostics);
    return "ok";
  }

  if (textKey === "time") {
    if (!value || !recordKey(seen, "time", "Duplicate header property 'time'.", keyRange, diagnostics)) {
      return "ok";
    }
    parseTime(header, value, diagnostics);
    return "ok";
  }

  if (textKey === "key") {
    if (!value || !recordKey(seen, "key", "Duplicate header property 'key'.", keyRange, diagnostics)) {
      return "ok";
    }
    parseKey(header, value, diagnostics);
    return "ok";
  }

  if (textKey === "hidden") {
    if (!value || !recordKey(seen, "hidden", "Duplicate header property 'hidden'.", keyRange, diagnostics)) {
      return "ok";
    }
    parseHidden(header, value, diagnostics);
    return "ok";
  }

  if (textKey === "program") {
    if (!value || !recordKey(seen, "program", "Duplicate header property 'program'.", keyRange, diagnostics)) {
      return "ok";
    }
    parseProgram(header, value, diagnostics);
    return "ok";
  }

  if (textKey === "volume") {
    if (!value || !recordKey(seen, "volume", "Duplicate header property 'volume'.", keyRange, diagnostics)) {
      return "ok";
    }
    parseVolume(header, value, diagnostics);
    return "ok";
  }

  const trackName = key.match(/^(T(?:[1-9]|1[1-6]))\.name$/)?.[1];
  if (trackName) {
    applyLabelName(header.trackNames, seen, `track:${trackName}`, "track name", trackName, keyRange, value, diagnostics);
    return "ok";
  }
  const trackProgram = key.match(/^(T(?:[1-9]|1[1-6]))\.program$/)?.[1];
  if (trackProgram) {
    applyTrackProgram(header.trackPrograms, seen, trackProgram, keyRange, value, diagnostics);
    return "ok";
  }
  const trackVolume = key.match(/^(T(?:[1-9]|1[1-6]))\.volume$/)?.[1];
  if (trackVolume) {
    applyTrackVolume(header.trackVolumes, seen, trackVolume, keyRange, value, diagnostics);
    return "ok";
  }
  if (isTrackLabel(key)) {
    applyLabelName(header.trackNames, seen, `track:${key}`, "track name", key, keyRange, value, diagnostics);
    return "ok";
  }

  const lyricName = key.match(/^(L\d+)\.name$/)?.[1];
  if (lyricName) {
    applyLabelName(header.lyricLabels, seen, `lyric:${lyricName}`, "lyric label", lyricName, keyRange, value, diagnostics);
    return "ok";
  }
  if (isLyricLabel(key)) {
    applyLabelName(header.lyricLabels, seen, `lyric:${key}`, "lyric label", key, keyRange, value, diagnostics);
    return "ok";
  }

  return "unknown";
}

function applyLabelName(
  labels: Record<string, string>,
  seen: Set<string>,
  seenKey: string,
  labelKind: string,
  label: string,
  keyRange: SourceRange,
  value: HeaderValue | null,
  diagnostics: Diagnostic[],
) {
  if (!value || !expectQuoted(value, labelKind, diagnostics)) {
    return;
  }
  if (!recordKey(seen, seenKey, `Duplicate ${labelKind} definition for '${label}'.`, keyRange, diagnostics)) {
    return;
  }
  labels[label] = value.text;
}

function applyTrackProgram(
  trackPrograms: Record<string, number>,
  seen: Set<string>,
  trackName: string,
  keyRange: SourceRange,
  value: HeaderValue | null,
  diagnostics: Diagnostic[],
) {
  if (!value) {
    return;
  }
  if (!recordKey(seen, `program:${trackName}`, `Duplicate track program definition for '${trackName}'.`, keyRange, diagnostics)) {
    return;
  }
  const program = parseTrackProgram(value, diagnostics);
  if (program === null) {
    return;
  }
  trackPrograms[trackName] = program;
}

function applyTrackVolume(
  trackVolumes: Record<string, number>,
  seen: Set<string>,
  trackName: string,
  keyRange: SourceRange,
  value: HeaderValue | null,
  diagnostics: Diagnostic[],
) {
  if (!value) {
    return;
  }
  if (!recordKey(seen, `volume:${trackName}`, `Duplicate track volume definition for '${trackName}'.`, keyRange, diagnostics)) {
    return;
  }
  const volume = parseTrackVolume(value, diagnostics);
  if (volume === null) {
    return;
  }
  trackVolumes[trackName] = volume;
}

function recordKey(seen: Set<string>, key: string, message: string, range: SourceRange, diagnostics: Diagnostic[]): boolean {
  if (seen.has(key)) {
    diagnostics.push({ severity: "error", message, range });
    return false;
  }
  seen.add(key);
  return true;
}

function expectQuoted(value: HeaderValue, label: string, diagnostics: Diagnostic[]): boolean {
  if (value.quoted) {
    return true;
  }
  diagnostics.push({ severity: "error", message: `Expected quoted string value for ${label}.`, range: value.range });
  return false;
}

function parseTempo(header: Header, value: HeaderValue, diagnostics: Diagnostic[]) {
  if (value.quoted) {
    diagnostics.push({ severity: "error", message: "Expected numeric tempo value.", range: value.range });
    return;
  }
  const tempo = Number(value.text);
  if (!Number.isFinite(tempo) || tempo <= 0) {
    diagnostics.push({ severity: "error", message: `Invalid tempo '${value.text}'.`, range: value.range });
    return;
  }
  header.tempo = tempo;
}

function parseTime(header: Header, value: HeaderValue, diagnostics: Diagnostic[]) {
  if (value.quoted) {
    diagnostics.push({ severity: "error", message: "Expected time signature value.", range: value.range });
    return;
  }
  const timeSignature = parseTimeSignature(value.text);
  if (timeSignature === null) {
    diagnostics.push({ severity: "error", message: `Invalid time signature '${value.text}'.`, range: value.range });
    return;
  }
  header.timeSignature = timeSignature;
}

function parseKey(header: Header, value: HeaderValue, diagnostics: Diagnostic[]) {
  if (value.quoted) {
    diagnostics.push({ severity: "error", message: "Expected key signature value.", range: value.range });
    return;
  }
  const keySignature = parseKeySignature(value.text);
  if (keySignature === null) {
    diagnostics.push({ severity: "error", message: `Unknown key signature '${value.text}'.`, range: value.range });
    return;
  }
  header.keySignature = keySignature;
  header.keySignatureText = value.text;
}

function parseHidden(header: Header, value: HeaderValue, diagnostics: Diagnostic[]) {
  if (value.quoted) {
    diagnostics.push({ severity: "error", message: "Expected boolean value for hidden.", range: value.range });
    return;
  }
  if (value.text === "true") {
    header.hidden = true;
    return;
  }
  if (value.text === "false") {
    header.hidden = false;
    return;
  }
  diagnostics.push({ severity: "error", message: "Expected boolean value for hidden.", range: value.range });
}

function parseProgram(header: Header, value: HeaderValue, diagnostics: Diagnostic[]) {
  const program = parseDefaultProgram(value, diagnostics);
  if (program === null) {
    return;
  }
  header.program = program;
}

function parseVolume(header: Header, value: HeaderValue, diagnostics: Diagnostic[]) {
  const volume = parseDefaultVolume(value, diagnostics);
  if (volume === null) {
    return;
  }
  header.volume = volume;
}

function parseDefaultProgram(value: HeaderValue, diagnostics: Diagnostic[]): number | null {
  if (value.quoted) {
    const resolved = resolveMelodicProgramName(value.text);
    if (resolved.ok) {
      return resolved.program;
    }
    diagnostics.push({
      severity: "error",
      message:
        resolved.reason === "ambiguous" ? `Ambiguous Program name '${value.text}'.` : `Unknown Program name '${value.text}'.`,
      range: value.range,
    });
    return null;
  }

  if (!/^\d+$/.test(value.text)) {
    diagnostics.push({ severity: "error", message: "Expected Program number 0-220 or quoted Program name.", range: value.range });
    return null;
  }
  const program = Number(value.text);
  if (!Number.isInteger(program) || program < 0 || program > 220) {
    diagnostics.push({ severity: "error", message: `Invalid Program '${value.text}'. Expected 0-220.`, range: value.range });
    return null;
  }
  return program;
}

function parseDefaultVolume(value: HeaderValue, diagnostics: Diagnostic[]): number | null {
  if (value.quoted) {
    diagnostics.push({ severity: "error", message: "Expected volume number 0-2.", range: value.range });
    return null;
  }
  const volume = Number(value.text);
  if (!Number.isFinite(volume) || volume < 0 || volume > 2) {
    diagnostics.push({ severity: "error", message: `Invalid volume '${value.text}'. Expected 0-2.`, range: value.range });
    return null;
  }
  return volume;
}

function parseTrackProgram(value: HeaderValue, diagnostics: Diagnostic[]): number | null {
  if (value.quoted) {
    const resolved = resolveMelodicProgramName(value.text);
    if (resolved.ok) {
      return resolved.program;
    }
    diagnostics.push({
      severity: "error",
      message:
        resolved.reason === "ambiguous" ? `Ambiguous Program name '${value.text}'.` : `Unknown Program name '${value.text}'.`,
      range: value.range,
    });
    return null;
  }

  if (!/^\d+$/.test(value.text)) {
    diagnostics.push({ severity: "error", message: "Expected Program number 0-127 or quoted Program name.", range: value.range });
    return null;
  }
  const program = Number(value.text);
  if (!Number.isInteger(program) || program < 0 || program > 127) {
    diagnostics.push({ severity: "error", message: `Invalid Program '${value.text}'. Expected 0-127.`, range: value.range });
    return null;
  }
  return program;
}

function parseTrackVolume(value: HeaderValue, diagnostics: Diagnostic[]): number | null {
  if (value.quoted) {
    diagnostics.push({ severity: "error", message: "Expected track volume number 0-2.", range: value.range });
    return null;
  }
  const volume = Number(value.text);
  if (!Number.isFinite(volume) || volume < 0 || volume > 2) {
    diagnostics.push({ severity: "error", message: `Invalid track volume '${value.text}'. Expected 0-2.`, range: value.range });
    return null;
  }
  return volume;
}

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
  const match = /^(\d+)\/(\d+)$/.exec(time);
  if (!match) {
    return null;
  }
  const beatsPerMeasure = Number(match[1]) as TimeSignature["beatsPerMeasure"];
  const beatsPerWholeNote = Number(match[2]) as TimeSignature["beatsPerWholeNote"];

  if (![2, 3, 4, 6, 9, 12].includes(beatsPerMeasure)) {
    return null;
  }
  if (![2, 4, 8, 16].includes(beatsPerWholeNote)) {
    return null;
  }
  return { beatsPerMeasure, beatsPerWholeNote };
}
