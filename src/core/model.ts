export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  range?: SourceRange;
}

export type Result<T> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

export type Accidental = -2 | -1 | 0 | 1 | 2;

export type NoteKind = "pitch" | "rest" | "drum";

export interface Pitch {
  note: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  octave: number;
  accidental?: Accidental;
  range: SourceRange;
}

export type Ornament =
  | { kind: "mordent"; direction: "upper" | "lower"; range: SourceRange }
  | { kind: "grace"; placement: "before" | "after"; pitches: Pitch[]; range: SourceRange };

export interface DurationMark {
  dashes: number;
  halves: number;
  dots: number;
  value: number;
}

export interface BaseNote {
  tie: boolean;
  duration: DurationMark;
  index: number;
  range: SourceRange;
  velocity?: number;
  hairpinStart?: HairpinKind;
  hairpinEnd?: HairpinKind;
}

export type HairpinKind = "crescendo" | "diminuendo";

export const VELOCITY_MAP: Record<string, number> = {
  ppp: 16,
  pp: 33,
  p: 49,
  mp: 61,
  mf: 73,
  f: 85,
  ff: 102,
  fff: 118,
};

export const VELOCITY_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(VELOCITY_MAP).map(([k, v]) => [v, k]),
);

export interface PitchNote extends BaseNote {
  kind: "pitch";
  chord: Pitch[];
  ornament?: Ornament;
}

export interface RestNote extends BaseNote {
  kind: "rest";
}

export interface DrumNote extends BaseNote {
  kind: "drum";
}

export type Note = PitchNote | RestNote | DrumNote;

export type NavigationBeforeMark = "segno" | "coda";
export type NavigationAfterMark = "dc" | "ds" | "toCoda" | "fine";

export interface Measure {
  notes: Note[];
  range: SourceRange;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  ending?: number[];
  navigationBefore?: NavigationBeforeMark[];
  navigationAfter?: NavigationAfterMark[];
}

export type LyricAlignmentUnit =
  | { kind: "syllable"; text: string }
  | { kind: "space" }
  | { kind: "merge" };

export interface LyricLine {
  label: string;
  text: string;
  syllables: string[];
  alignment: LyricAlignmentUnit[];
  range: SourceRange;
}

export interface ScoreLine {
  label?: string;
  pageBreakBefore?: boolean;
  measures: Measure[];
  lyrics?: LyricLine[];
  range: SourceRange;
}

export interface TimeSignature {
  beatsPerMeasure: 2 | 3 | 4 | 6 | 9 | 12;
  beatsPerWholeNote: 2 | 4 | 8 | 16;
}

export type KeySignature = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface Header {
  title: string;
  subtitle: string;
  composer: string;
  keySignature: KeySignature;
  keySignatureText: string;
  timeSignature: TimeSignature;
  tempo: number;
  hidden: boolean;
  footer: string;
  numbering: boolean;
  paginate: boolean;
  program?: number;
  volume?: number;
  trackNames: Record<string, string>;
  trackPrograms: Record<string, number>;
  trackVolumes: Record<string, number>;
  lyricLabels: Record<string, string>;
}

export interface Document {
  header: Header;
  score: ScoreLine[];
  diagnostics: Diagnostic[];
}

export function actualBeatsPerMeasure(time: TimeSignature): number {
  switch (time.beatsPerMeasure) {
    case 2:
    case 4:
      return time.beatsPerMeasure;
    default:
      return time.beatsPerMeasure / 3;
  }
}

export function actualNotePerBeat(time: TimeSignature): number {
  switch (time.beatsPerWholeNote) {
    case 2:
    case 4:
      return 1 / time.beatsPerWholeNote;
    default:
      return 3 / time.beatsPerWholeNote;
  }
}
