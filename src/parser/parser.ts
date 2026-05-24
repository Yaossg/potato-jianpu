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

type ResolvedTieTarget =
  | { kind: "pitch"; pitches: string[] }
  | { kind: "drum" };

type EndingBlock = { ending: number; startIndex: number; endIndex: number };

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
  private activeEnding: number | undefined;

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
    this.normalizeFinalEnding(score);
    this.validateTies(score);
    this.validateRepeatedEndings(score);
    this.validateMeasureDurations(score, header.timeSignature.beatsPerMeasure / header.timeSignature.beatsPerWholeNote);

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

  private warning(message: string, range = this.current().range) {
    this.diagnostics.push({ severity: "warning", message, range });
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
      const colon = this.consume("colon", "Expected ':' after header property name.");
      const value = this.consume("string", "Expected quoted string header value.");
      if (!this.at("newline") && !this.at("equals") && !this.at("eof")) {
        this.error("Expected newline after header property.");
        this.synchronizeHeaderLine();
      }
      if (this.at("newline")) {
        this.skipNewlines();
      } else if (!this.at("equals") && !this.at("eof")) {
        this.error("Expected newline after header property.");
      }
      if (label && value) {
        raw[label.value ?? label.text] = value.value ?? "";
      } else if (!label || !colon || !value) {
        this.synchronizeHeaderLine();
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
    const leadingRepeatStart = Boolean(this.match("repeatStart"));
    if (!leadingRepeatStart) {
      this.match("bar");
    }
    const measures: Measure[] = [];
    let currentEnding = this.parseOptionalEnding() ?? this.activeEnding;
    measures.push(this.parseMeasure(leadingRepeatStart, currentEnding));
    while (true) {
      while (this.match("repeatEnd")) {
        const previous = measures.at(-1);
        if (previous) {
          previous.repeatEnd = true;
        }
      }
      if (this.match("repeatBoth")) {
        const previous = measures.at(-1);
        if (previous) {
          previous.repeatEnd = true;
        }
        currentEnding = this.parseOptionalEnding();
        this.activeEnding = currentEnding;
        measures.push(this.parseMeasure(true, currentEnding));
        continue;
      }
      if (this.at("newline") || this.at("eof")) {
        break;
      }
      if (this.match("bar")) {
        if (this.at("newline") || this.at("eof")) {
          break;
        }
        currentEnding = this.parseOptionalEnding() ?? currentEnding;
        this.activeEnding = currentEnding;
        measures.push(this.parseMeasure(false, currentEnding));
        continue;
      }
      if (this.match("repeatStart")) {
        currentEnding = this.parseOptionalEnding() ?? currentEnding;
        this.activeEnding = currentEnding;
        measures.push(this.parseMeasure(true, currentEnding));
        continue;
      }
      currentEnding = this.parseOptionalEnding() ?? currentEnding;
      this.activeEnding = currentEnding;
      measures.push(this.parseMeasure(false, currentEnding));
    }
    this.activeEnding = currentEnding;
    return {
      label,
      measures,
      range: mergeRange(start, this.previous().range),
    };
  }

  private parseMeasure(repeatStart = false, ending?: number): Measure {
    const start = this.current().range;
    const octavePrefix = this.parseOptionalMeasureOctave();
    const notes: Note[] = [];
    while (
      !this.at("bar") &&
      !this.at("repeatEnd") &&
      !this.at("repeatStart") &&
      !this.at("repeatBoth") &&
      !this.at("lbracket") &&
      !this.at("newline") &&
      !this.at("eof")
    ) {
      if (!this.isDurableNoteStart()) {
        this.parseUnexpectedScoreToken();
        continue;
      }
      notes.push(this.parseDurableNote(octavePrefix));
    }
    if (notes.length === 0) {
      this.error("Expected at least one note in measure.", start);
    }
    const end = notes.at(-1)?.range ?? start;
    return { notes, range: mergeRange(start, end), repeatStart, ending };
  }

  private parseOptionalEnding(): number | undefined {
    if (!this.match("lbracket")) {
      return undefined;
    }
    const number = this.consume("note", "Expected ending number after '['.");
    this.consume("rbracket", "Expected ']' after ending number.");
    if (!number) {
      return undefined;
    }
    return Number(number.value ?? number.text);
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

  private isPitchStart(): boolean {
    return (
      this.at("note") ||
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
      while (!this.at("rbrace") && !this.at("newline") && !this.at("eof")) {
        if (!this.isPitchStart()) {
          this.error("Expected pitch note inside chord.");
          this.index += 1;
          continue;
        }
        chord.push(this.parsePitch(measureOctave));
      }
      if (this.at("eof")) {
        this.error("Unterminated chord; expected '}' before end of file.");
      } else if (this.at("newline")) {
        this.error("Unterminated chord; expected '}' before end of line.");
      } else {
        this.consume("rbrace", "Expected '}' after chord.");
      }
      if (chord.length === 0) {
        this.error("Expected at least one pitch in chord.");
      }
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
      if (this.at("half") || this.at("dot")) {
        this.error("Dash duration marks cannot be combined with slash or dot duration marks.");
        this.consumeFractionalDurationTail();
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
      if (this.at("dash")) {
        this.error("Dash duration marks cannot be combined with slash or dot duration marks.");
        while (this.match("dash")) {
          dashes += 1;
        }
      }
    }
    return { dashes, halves, dots, value: durationOf(dashes, halves, dots) };
  }

  private consumeFractionalDurationTail() {
    while (this.at("half") || this.at("dot")) {
      this.index += 1;
    }
  }

  private parseUnexpectedScoreToken() {
    if (this.at("rbrace")) {
      this.error("Unexpected '}' without matching chord start.");
      this.index += 1;
      return;
    }
    if (this.at("lbracket") || this.at("rbracket")) {
      this.error("Ending markers such as [1] must appear before a measure.");
      this.index += 1;
      return;
    }
    if (this.at("half") || this.at("dot") || this.at("dash")) {
      this.error("Duration mark must follow a note, rest, drum note, or chord.");
      while (this.at("half") || this.at("dot") || this.at("dash")) {
        this.index += 1;
      }
      return;
    }
    this.error("Expected note, rest, drum note, chord, or tie.");
    this.index += 1;
  }

  private validateTies(lines: ScoreLine[]) {
    let previous: ResolvedTieTarget | undefined;
    let hasPreviousNote = false;

    for (const line of lines) {
      for (const measure of line.measures) {
        const accidentals = new Map<number, Accidental>();
        for (const note of measure.notes) {
          const current = this.resolveTieTarget(note, accidentals);
          if (note.tie) {
            if (!hasPreviousNote) {
              this.error("First note cannot be tied.", note.range);
            } else if (!previous) {
              this.error("Tied note must follow a sounding note.", note.range);
            } else if (!current || !this.sameTieTarget(previous, current)) {
              this.error("Tied note must match the previous sounding note.", note.range);
            }
          }
          previous = current;
          hasPreviousNote = true;
        }
      }
    }
  }

  private resolveTieTarget(note: Note, accidentals: Map<number, Accidental>): ResolvedTieTarget | undefined {
    if (note.kind === "rest") {
      return undefined;
    }
    if (note.kind === "drum") {
      return { kind: "drum" };
    }

    const pitches = note.chord.map((pitch) => {
      if (pitch.accidental !== undefined) {
        accidentals.set(pitch.note, pitch.accidental);
      }
      const accidental = accidentals.get(pitch.note) ?? 0;
      return `${pitch.note}:${pitch.octave}:${accidental}`;
    });
    pitches.sort();
    return { kind: "pitch", pitches };
  }

  private sameTieTarget(previous: ResolvedTieTarget, current: ResolvedTieTarget): boolean {
    if (previous.kind !== current.kind) {
      return false;
    }
    if (previous.kind === "drum") {
      return true;
    }
    if (current.kind !== "pitch") {
      return false;
    }
    return previous.pitches.length === current.pitches.length && previous.pitches.every((pitch, index) => pitch === current.pitches[index]);
  }

  private validateMeasureDurations(lines: ScoreLine[], expectedDuration: number) {
    for (const line of lines) {
      for (const measure of line.measures) {
        if (measure.notes.length === 0) {
          continue;
        }
        const actualDuration = measure.notes.reduce((sum, note) => sum + note.duration.value, 0);
        if (Math.abs(actualDuration - expectedDuration) > 1e-9) {
          this.warning(
            `Measure duration ${this.formatDuration(actualDuration)} does not match time signature duration ${this.formatDuration(expectedDuration)}.`,
            measure.range,
          );
        }
      }
    }
  }

  private validateRepeatedEndings(lines: ScoreLine[]) {
    const measures = lines.flatMap((line) => line.measures);
    const endingGroups = this.groupEndingBlocks(measures);
    for (const endingBlocks of endingGroups) {
      if (endingBlocks.length === 1) {
        const block = endingBlocks[0]!;
        const measure = measures[block.startIndex]!;
        this.error(`Repeated endings need at least [1] and [2].`, measure.range);
      }

      for (let blockIndex = 0; blockIndex < endingBlocks.length - 1; blockIndex += 1) {
        const block = endingBlocks[blockIndex]!;
        const endingMeasure = measures[block.endIndex]!;
        const internalRepeatEnd = measures.slice(block.startIndex, block.endIndex).find((measure) => measure.repeatEnd);
        if (internalRepeatEnd) {
          this.error(`Ending [${block.ending}] has ':|' before its last measure; move ':|' to the end of the ending.`, internalRepeatEnd.range);
        } else if (!endingMeasure.repeatEnd) {
          const nextBlock = endingBlocks[blockIndex + 1]!;
          this.error(`Ending [${block.ending}] should end with ':|' before ending [${nextBlock.ending}].`, endingMeasure.range);
        }
      }

      const duplicateBlock = endingBlocks.find((block, index) => endingBlocks.findIndex((candidate) => candidate.ending === block.ending) !== index);
      if (duplicateBlock) {
        const measure = measures[duplicateBlock.startIndex]!;
        this.error(`Ending [${duplicateBlock.ending}] appears more than once. Use each ending number only once.`, measure.range);
        continue;
      }

      const endingNumbers = endingBlocks.map((block) => block.ending);
      const firstOutOfSequenceIndex = endingNumbers.findIndex((ending, index) => ending !== index + 1);
      if (firstOutOfSequenceIndex >= 0) {
        const expectedEnding = firstOutOfSequenceIndex + 1;
        const block = endingBlocks[firstOutOfSequenceIndex]!;
        const measure = measures[block.startIndex]!;
        if (endingNumbers.slice(firstOutOfSequenceIndex + 1).includes(expectedEnding)) {
          this.error(`Ending [${block.ending}] is out of order; write ending [${expectedEnding}] before it.`, measure.range);
        } else {
          this.error(`Ending [${expectedEnding}] is missing before ending [${block.ending}].`, measure.range);
        }
      }
    }
  }

  private collectEndingBlocks(measures: Measure[]): EndingBlock[] {
    const endingBlocks: EndingBlock[] = [];
    let measureIndex = 0;
    while (measureIndex < measures.length) {
      const measure = measures[measureIndex]!;
      if (measure.ending === undefined) {
        measureIndex += 1;
        continue;
      }
      let endingEndIndex = measureIndex;
      while (measures[endingEndIndex + 1]?.ending === measure.ending) {
        endingEndIndex += 1;
      }
      endingBlocks.push({ ending: measure.ending, startIndex: measureIndex, endIndex: endingEndIndex });
      measureIndex = endingEndIndex + 1;
    }
    return endingBlocks;
  }

  private groupEndingBlocks(measures: Measure[]): EndingBlock[][] {
    const endingBlocks = this.collectEndingBlocks(measures);
    const endingGroups: EndingBlock[][] = [];
    let currentGroup: EndingBlock[] = [];
    for (const block of endingBlocks) {
      const previousBlock = currentGroup.at(-1);
      if (previousBlock && block.ending === 1 && this.hasRepeatStartBetween(measures, previousBlock.endIndex + 1, block.startIndex)) {
        endingGroups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push(block);
    }
    if (currentGroup.length > 0) {
      endingGroups.push(currentGroup);
    }
    return endingGroups;
  }

  private hasRepeatStartBetween(measures: Measure[], startIndex: number, endIndex: number): boolean {
    for (let index = startIndex; index <= endIndex; index += 1) {
      if (measures[index]?.repeatStart) {
        return true;
      }
    }
    return false;
  }

  private normalizeFinalEnding(lines: ScoreLine[]) {
    const measures = lines.flatMap((line) => line.measures);
    const endingBlocks = this.collectEndingBlocks(measures);
    for (let blockIndex = 0; blockIndex < endingBlocks.length; blockIndex += 1) {
      const block = endingBlocks[blockIndex]!;
      const nextBlock = endingBlocks[blockIndex + 1];
      if (nextBlock && nextBlock.ending > block.ending) {
        continue;
      }
      for (let index = block.startIndex + 1; measures[index]?.ending === block.ending; index += 1) {
        measures[index]!.ending = undefined;
      }
    }
  }

  private formatDuration(duration: number): string {
    return Number.isInteger(duration) ? String(duration) : Number(duration.toFixed(6)).toString();
  }

  private synchronizeLine() {
    while (!this.at("newline") && !this.at("eof")) {
      this.index += 1;
    }
  }

  private synchronizeHeaderLine() {
    while (!this.at("newline") && !this.at("equals") && !this.at("eof")) {
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
