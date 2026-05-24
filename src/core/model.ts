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
}

export interface PitchNote extends BaseNote {
  kind: "pitch";
  chord: Pitch[];
}

export interface RestNote extends BaseNote {
  kind: "rest";
}

export interface DrumNote extends BaseNote {
  kind: "drum";
}

export type Note = PitchNote | RestNote | DrumNote;

export interface Measure {
  notes: Note[];
  range: SourceRange;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  ending?: number;
}

export interface ScoreLine {
  label?: string;
  measures: Measure[];
  range: SourceRange;
}

export interface TimeSignature {
  beatsPerMeasure: 2 | 3 | 4 | 6 | 9 | 12;
  beatsPerWholeNote: 2 | 4 | 8 | 16;
}

export type KeySignature = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface Header {
  raw: Record<string, string>;
  title: string;
  subtitle: string;
  composer: string;
  keySignature: KeySignature;
  keySignatureText: string;
  timeSignature: TimeSignature;
  tempo: number;
  hidden: string;
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
