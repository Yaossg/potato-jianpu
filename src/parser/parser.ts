import type {
  Accidental,
  Diagnostic,
  Document,
  DurationMark,
  Measure,
  Note,
  Pitch,
  PitchNote,
  Result,
  ScoreLine,
  SourceRange,
} from "../core/index.js";
import { normalizeHeader } from "./header.js";
import { tokenize, type Token, type TokenType } from "./tokenizer.js";

type DraftNote =
  | { kind: "pitch"; chord: Pitch[] }
  | { kind: "rest" }
  | { kind: "drum" };

function mergeRange(start: SourceRange, end: SourceRange): SourceRange {
  return { start: start.start, end: end.end };
}

function durationOf(dashes: number, halves: number, dots: number): number {
  let unit = (1 + dashes) / 4;
  let dot = unit / 2;
  for (let i = 0; i < dots; i += 1) {
    unit += dot;
    dot /= 2;
  }
  return unit / 2 ** halves;
}

class Parser {
  private index = 0;
  private diagnostics: Diagnostic[];
  private noteIndex = 0;

  constructor(
    private readonly tokens: Token[],
    diagnostics: Diagnostic[],
  ) {
    this.diagnostics = [...diagnostics];
  }

  parse(): Result<Document> {
    this.skipNewlines();
    const rawHeader = this.hasHeaderSeparatorAhead() ? this.parseHeader() : {};
    const { header, diagnostics } = normalizeHeader(rawHeader);
    this.diagnostics.push(...diagnostics);
    this.skipNewlines();
    const score = this.at("eof") ? [] : this.parseScore();
    this.validateTies(score);

    if (this.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      return { ok: false, diagnostics: this.diagnostics };
    }
    return { ok: true, value: { header, score, diagnostics: this.diagnostics }, diagnostics: this.diagnostics };
  }

  private current(): Token {
    return this.tokens[this.index]!;
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)]!;
  }

  private at(type: TokenType): boolean {
    return this.current().type === type;
  }

  private consume(type: TokenType, message: string): Token | null {
    if (this.at(type)) {
      const token = this.current();
      this.index += 1;
      return token;
    }
    this.error(message, this.current().range);
    return null;
  }

  private match(type: TokenType): Token | null {
    if (!this.at(type)) {
      return null;
    }
    const token = this.current();
    this.index += 1;
    return token;
  }

  private error(message: string, range = this.current().range) {
    this.diagnostics.push({ severity: "error", message, range });
  }

  private skipNewlines() {
    while (this.match("newline")) {
      // Intentionally empty.
    }
  }

  private consumeNewlines(message: string) {
    if (!this.match("newline")) {
      this.error(message);
      return;
    }
    this.skipNewlines();
  }

  private hasHeaderSeparatorAhead(): boolean {
    for (let i = this.index; i < this.tokens.length; i += 1) {
      const token = this.tokens[i]!;
      if (token.type === "equals") {
        return true;
      }
      if (token.type === "eof") {
        return false;
      }
    }
    return false;
  }

  private parseHeader(): Record<string, string> {
    const raw: Record<string, string> = {};
    while (!this.at("equals") && !this.at("eof")) {
      if (this.at("newline")) {
        this.skipNewlines();
        continue;
      }
      const label = this.consume("identifier", "Expected header property name.");
      this.consume("colon", "Expected ':' after header property name.");
      const value = this.consume("string", "Expected quoted string header value.");
      this.consumeNewlines("Expected newline after header property.");
      if (label && value) {
        raw[label.value ?? label.text] = value.value ?? "";
      }
    }

    if (!this.match("equals")) {
      this.error("Expected '=' header separator.");
      return raw;
    }
    while (this.match("equals")) {
      // Multiple header separator characters are allowed.
    }
    this.consumeNewlines("Expected newline after header separator.");
    return raw;
  }

  private parseScore(): ScoreLine[] {
    const lines: ScoreLine[] = [];
    while (!this.at("eof")) {
      if (this.at("newline")) {
        this.skipNewlines();
        continue;
      }
      lines.push(this.parseLine());
      if (this.at("newline")) {
        this.skipNewlines();
      } else if (!this.at("eof")) {
        this.error("Expected newline or end of file after score line.");
        this.synchronizeLine();
      }
    }
    return lines;
  }

  private parseLine(): ScoreLine {
    const start = this.current().range;
    let label: string | undefined;
    if (this.at("identifier") && this.tokens[this.index + 1]?.type === "colon") {
      label = this.current().value ?? this.current().text;
      this.index += 2;
    }
    this.match("bar");
    const measures: Measure[] = [];
    measures.push(this.parseMeasure());
    while (this.match("bar")) {
      if (this.at("newline") || this.at("eof")) {
        break;
      }
      measures.push(this.parseMeasure());
    }
    return {
      label,
      measures,
      range: mergeRange(start, this.previous().range),
    };
  }

  private parseMeasure(): Measure {
    const start = this.current().range;
    const octavePrefix = this.parseOptionalMeasureOctave();
    const notes: Note[] = [];
    while (!this.at("bar") && !this.at("newline") && !this.at("eof")) {
      if (!this.isDurableNoteStart()) {
        this.error("Expected note, rest, drum note, chord, or tie.");
        this.index += 1;
        continue;
      }
      notes.push(this.parseDurableNote(octavePrefix));
    }
    if (notes.length === 0) {
      this.error("Expected at least one note in measure.", start);
    }
    const end = notes.at(-1)?.range ?? start;
    return { notes, range: mergeRange(start, end) };
  }

  private parseOptionalMeasureOctave(): number {
    if (!this.at("lower") && !this.at("higher")) {
      return 0;
    }
    const type = this.current().type;
    let count = 0;
    while (this.at(type)) {
      count += 1;
      this.index += 1;
    }
    return type === "lower" ? -count : count;
  }

  private isDurableNoteStart(): boolean {
    if (this.at("tie")) {
      return true;
    }
    return this.isGeneralNoteStart();
  }

  private isGeneralNoteStart(): boolean {
    return (
      this.at("note") ||
      this.at("rest") ||
      this.at("drum") ||
      this.at("lbrace") ||
      this.at("sharp") ||
      this.at("sharpsharp") ||
      this.at("flat") ||
      this.at("flatflat") ||
      this.at("natural")
    );
  }

  private parseDurableNote(measureOctave: number): Note {
    const start = this.current().range;
    const tie = Boolean(this.match("tie"));
    const note = this.parseGeneralNote(measureOctave);
    const duration = this.parseDuration();
    const range = mergeRange(start, this.previous().range);
    return { ...note, tie, duration, index: this.noteIndex++, range } as Note;
  }

  private parseGeneralNote(measureOctave: number): DraftNote {
    if (this.match("rest")) {
      return { kind: "rest" };
    }
    if (this.match("drum")) {
      return { kind: "drum" };
    }
    if (this.match("lbrace")) {
      const chord: Pitch[] = [];
      while (!this.at("rbrace") && !this.at("eof")) {
        chord.push(this.parsePitch(measureOctave));
      }
      this.consume("rbrace", "Expected '}' after chord.");
      return { kind: "pitch", chord };
    }
    return { kind: "pitch", chord: [this.parsePitch(measureOctave)] };
  }

  private parsePitch(measureOctave: number): Pitch {
    const start = this.current().range;
    const accidental = this.parseAccidental();
    const noteToken = this.consume("note", "Expected pitch note 1-7.");
    const octave = measureOctave + this.parseOctaveSuffix();
    const note = Number(noteToken?.value ?? 1) as Pitch["note"];
    return {
      note,
      octave,
      accidental,
      range: mergeRange(start, this.previous().range),
    };
  }

  private parseAccidental(): Accidental | undefined {
    if (this.match("sharpsharp")) {
      return 2;
    }
    if (this.match("sharp")) {
      return 1;
    }
    if (this.match("flatflat")) {
      return -2;
    }
    if (this.match("flat")) {
      return -1;
    }
    if (this.match("natural")) {
      return 0;
    }
    return undefined;
  }

  private parseOctaveSuffix(): number {
    if (!this.at("lower") && !this.at("higher")) {
      return 0;
    }
    const type = this.current().type;
    let count = 0;
    while (this.at(type)) {
      count += 1;
      this.index += 1;
    }
    return type === "lower" ? -count : count;
  }

  private parseDuration(): DurationMark {
    let dashes = 0;
    let halves = 0;
    let dots = 0;
    if (this.at("dash")) {
      while (this.match("dash")) {
        dashes += 1;
      }
    } else {
      while (this.at("half") || this.at("dot")) {
        if (this.match("half")) {
          halves += 1;
        } else {
          this.match("dot");
          dots += 1;
        }
      }
    }
    return { dashes, halves, dots, value: durationOf(dashes, halves, dots) };
  }

  private validateTies(lines: ScoreLine[]) {
    const notes = lines.flatMap((line) => line.measures).flatMap((measure) => measure.notes);
    if (notes[0]?.tie) {
      this.error("First note cannot be tied.", notes[0].range);
    }
  }

  private synchronizeLine() {
    while (!this.at("newline") && !this.at("eof")) {
      this.index += 1;
    }
  }
}

export function parse(source: string): Result<Document> {
  const { tokens, diagnostics } = tokenize(source);
  return new Parser(tokens, diagnostics).parse();
}

export function assertParsed(source: string): Document {
  const result = parse(source);
  if (!result.ok) {
    const message = result.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
    throw new Error(message);
  }
  return result.value;
}

export type ParsedPitchNote = PitchNote;
