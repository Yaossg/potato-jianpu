import {
  VELOCITY_MAP,
  type Accidental,
  type Diagnostic,
  type Document,
  type DurationMark,
  type Header,
  type Measure,
  type Note,
  type Pitch,
  type PitchNote,
  type Result,
  type LyricLine,
  type ScoreLine,
  type SourceRange,
} from "../core/index.js";
import { applyHeaderProperty, createDefaultHeader, isLyricLabel, isMelodicScoreTrackLabel, isPercussionTrackLabel, type HeaderValue } from "./header.js";
import { tokenize, type Token, type TokenType } from "./tokenizer.js";

type DraftNote =
  | { kind: "pitch"; chord: Pitch[] }
  | { kind: "rest" }
  | { kind: "drum" };

type ResolvedTieTarget =
  | { kind: "pitch"; pitches: string[] }
  | { kind: "drum" };

type EndingBlock = { endings: number[]; startIndex: number; endIndex: number };

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
  private activeEndings = new Map<string, number[] | undefined>();
  private labeledScoreMode = false;

  constructor(
    private readonly tokens: Token[],
    diagnostics: Diagnostic[],
  ) {
    this.diagnostics = [...diagnostics];
  }

  parse(): Result<Document> {
    this.skipNewlines();
    const header = this.hasHeaderSeparatorAhead() ? this.parseHeader() : createDefaultHeader();
    this.skipNewlines();
    this.labeledScoreMode = this.scoreHasTrackLabelsAhead();
    const score = this.at("eof") ? [] : this.parseScore();
    this.validateTrackLabelOrder(score);
    this.validateNoteKinds(score, header);
    this.validateLyrics(score);
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

  private parseHeader(): Document["header"] {
    const header = createDefaultHeader();
    const seen = new Set<string>();
    while (!this.at("equals") && !this.at("eof")) {
      if (this.at("newline")) {
        this.skipNewlines();
        continue;
      }
      const label = this.consume("identifier", "Expected header property name.");
      let key = label?.value ?? label?.text ?? "";
      let keyRange = label?.range ?? this.current().range;
      if (label && this.match("dot")) {
        const property = this.consume("identifier", "Expected header property name after '.'.");
        if (property) {
          key = `${key}.${property.value ?? property.text}`;
          keyRange = mergeRange(label.range, property.range);
        }
      }
      const colon = this.consume("colon", "Expected ':' after header property name.");
      const value = colon ? this.parseHeaderValue() : null;
      if (!this.at("newline") && !this.at("equals") && !this.at("eof")) {
        this.error("Expected newline after header property.");
        this.synchronizeHeaderLine();
      }
      if (this.at("newline")) {
        this.skipNewlines();
      } else if (!this.at("equals") && !this.at("eof")) {
        this.error("Expected newline after header property.");
      }
      if (label && colon) {
        const result = applyHeaderProperty(header, seen, key, keyRange, value, this.diagnostics);
        if (result === "unknown") {
          this.error(`Unknown header key '${key}'.`, keyRange);
        }
      } else if (!label || !colon || !value) {
        this.synchronizeHeaderLine();
      }
    }

    if (!this.match("equals")) {
      this.error("Expected '=' header separator.");
      return header;
    }
    while (this.match("equals")) {
      // Multiple header separator characters are allowed.
    }
    this.consumeNewlines("Expected newline after header separator.");
    return header;
  }

  private parseHeaderValue(): HeaderValue | null {
    if (this.at("newline") || this.at("equals") || this.at("eof")) {
      this.error("Expected header value.");
      return null;
    }
    if (this.at("string")) {
      const token = this.current();
      this.index += 1;
      return { text: token.value ?? "", range: token.range, quoted: true };
    }
    const start = this.current();
    const parts: string[] = [];
    while (!this.at("newline") && !this.at("equals") && !this.at("eof")) {
      parts.push(this.current().text);
      this.index += 1;
    }
    return { text: parts.join(""), range: mergeRange(start.range, this.previous().range), quoted: false };
  }

  private parseScore(): ScoreLine[] {
    const lines: ScoreLine[] = [];
    while (!this.at("eof")) {
      if (this.at("newline")) {
        this.skipNewlines();
        continue;
      }
      if (this.isLyricLineStart()) {
        this.attachLyricLine(lines, this.parseLyricLine());
      } else {
        lines.push(this.parseLine());
      }
      if (this.at("newline")) {
        this.skipNewlines();
      } else if (!this.at("eof")) {
        this.error("Expected newline or end of file after score line.");
        this.synchronizeLine();
      }
    }
    return lines;
  }

  private isLyricLineStart(): boolean {
    if (this.at("string")) {
      return true;
    }
    const label = this.current().value ?? this.current().text;
    return this.at("identifier") && this.tokens[this.index + 1]?.type === "colon" && isLyricLabel(label);
  }

  private parseLyricLine(): LyricLine {
    const start = this.current().range;
    let label = "L1";
    if (this.at("identifier") && this.tokens[this.index + 1]?.type === "colon") {
      label = this.current().value ?? this.current().text;
      this.index += 2;
    }
    const text = this.consume("string", "Expected quoted lyric text.");
    const lyricText = text?.value ?? "";
    return {
      label,
      text: lyricText,
      syllables: this.lyricSyllables(lyricText),
      range: mergeRange(start, (text ?? this.previous()).range),
    };
  }

  private attachLyricLine(lines: ScoreLine[], lyric: LyricLine) {
    const target = lines.at(-1);
    if (!target) {
      this.error("Lyrics must follow a score line.", lyric.range);
      return;
    }
    target.lyrics = [...(target.lyrics ?? []), lyric];
  }

  private lyricSyllables(text: string): string[] {
    return text.trim().split(/\s+/).filter(Boolean);
  }

  private parseLine(): ScoreLine {
    const start = this.current().range;
    let label: string | undefined;
    if (this.at("identifier") && this.tokens[this.index + 1]?.type === "colon") {
      label = this.current().value ?? this.current().text;
      if (!isMelodicScoreTrackLabel(label) && !isPercussionTrackLabel(label)) {
        this.error("Score line labels must be T1-T9, T11-T16, or P followed by digits.", this.current().range);
      }
      this.index += 2;
    } else if (this.labeledScoreMode) {
      label = "T1";
    }
    const trackKey = label ?? "";
    const leadingRepeatStart = Boolean(this.match("repeatStart"));
    if (!leadingRepeatStart) {
      this.match("bar");
    }
    const measures: Measure[] = [];
    let currentEnding = this.parseOptionalEnding() ?? this.activeEndings.get(trackKey);
    const firstMeasure = this.parseMeasure(leadingRepeatStart, currentEnding);
    if (firstMeasure) {
      measures.push(firstMeasure);
    }
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
        this.activeEndings.set(trackKey, currentEnding);
        const measure = this.parseMeasure(true, currentEnding);
        if (measure) {
          measures.push(measure);
        }
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
        this.activeEndings.set(trackKey, currentEnding);
        const measure = this.parseMeasure(false, currentEnding);
        if (measure) {
          measures.push(measure);
        }
        continue;
      }
      if (this.match("repeatStart")) {
        currentEnding = this.parseOptionalEnding() ?? currentEnding;
        this.activeEndings.set(trackKey, currentEnding);
        const measure = this.parseMeasure(true, currentEnding);
        if (measure) {
          measures.push(measure);
        }
        continue;
      }
      currentEnding = this.parseOptionalEnding() ?? currentEnding;
      this.activeEndings.set(trackKey, currentEnding);
      const measure = this.parseMeasure(false, currentEnding);
      if (measure) {
        measures.push(measure);
      }
    }
    this.activeEndings.set(trackKey, currentEnding);
    return {
      label,
      measures,
      range: mergeRange(start, this.previous().range),
    };
  }

  private parseMeasure(repeatStart = false, ending?: number[]): Measure | null {
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
      this.warning("Empty measure ignored.", start);
      return null;
    }
    const end = notes.at(-1)?.range ?? start;
    return { notes, range: mergeRange(start, end), repeatStart, ending };
  }

  private parseOptionalEnding(): number[] | undefined {
    if (!this.match("lbracket")) {
      return undefined;
    }
    const numbers: number[] = [];
    const number = this.consume("note", "Expected ending number after '['.");
    if (number) {
      numbers.push(Number(number.value ?? number.text));
    }
    while (this.match("lower")) {
      const nextNumber = this.consume("note", "Expected ending number after ','.");
      if (nextNumber) {
        numbers.push(Number(nextNumber.value ?? nextNumber.text));
      }
    }
    this.consume("rbracket", "Expected ']' after ending number.");
    if (numbers.length === 0) {
      return undefined;
    }
    return numbers;
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
    if (this.at("velocity")) {
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
    const velocity = this.parseVelocity();
    const note = this.parseGeneralNote(measureOctave);
    const duration = this.parseDuration();
    const range = mergeRange(start, this.previous().range);
    return { ...note, tie, velocity, duration, index: this.noteIndex++, range } as Note;
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
        this.warning("Empty chord rendered as a rest.");
        return { kind: "rest" };
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

  private parseVelocity(): number | undefined {
    const token = this.match("velocity");
    if (!token) return undefined;
    return VELOCITY_MAP[token.text];
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

  private trackLineGroups(lines: ScoreLine[]): ScoreLine[][] {
    const hasLabels = lines.some((line) => line.label !== undefined);
    if (!hasLabels) {
      return [lines];
    }
    const groups = new Map<string, ScoreLine[]>();
    for (const line of lines) {
      const key = line.label ?? "";
      const group = groups.get(key) ?? [];
      group.push(line);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  private scoreHasTrackLabelsAhead(): boolean {
    for (let index = this.index; index < this.tokens.length - 1; index += 1) {
      const token = this.tokens[index]!;
      const next = this.tokens[index + 1]!;
      const label = token.value ?? token.text;
      if (token.type === "identifier" && next.type === "colon" && (isMelodicScoreTrackLabel(label) || isPercussionTrackLabel(label))) {
        return true;
      }
    }
    return false;
  }

  private validateTrackLabelOrder(lines: ScoreLine[]) {
    if (!lines.some((line) => line.label !== undefined)) {
      return;
    }

    let expected = "T1";
    let sawDefaultInGroup = false;
    for (const line of lines) {
      const label = line.label ?? "";
      if (label === "") {
        sawDefaultInGroup = true;
        continue;
      }
      if (isPercussionTrackLabel(label)) {
        continue;
      }
      if (label === "T1") {
        expected = "T2";
        sawDefaultInGroup = false;
        continue;
      }
      if (sawDefaultInGroup || label !== expected) {
        const expectedText = expected === "T1" ? "T1" : `${expected} or T1`;
        this.error(`Track labels must start at T1 and increase within each group. Expected ${expectedText}.`, line.range);
        return;
      }
      expected = this.nextTrackLabel(label);
    }
  }

  private resolveTrackProgram(header: Header, label: string): number | undefined {
    if (isPercussionTrackLabel(label)) {
      return header.trackPrograms[label] ?? header.program ?? 128;
    }
    return header.trackPrograms[label] ?? header.program;
  }

  private validateNoteKinds(lines: ScoreLine[], header: Header) {
    for (const line of lines) {
      const label = line.label ?? "";
      const program = this.resolveTrackProgram(header, label);
      if (program === undefined) continue;
      const drumMode = program >= 128;
      for (const measure of line.measures) {
        for (const note of measure.notes) {
          if (note.kind === "drum" && !drumMode) {
            this.warning("Drum note 'X' used on a melodic track. Set a drum Program (128-174) to enable drum mode.", note.range);
          }
          if (note.kind === "pitch" && drumMode) {
            this.warning("Pitch note used on a drum track. Drum tracks should only contain 'X' notes and rests.", note.range);
          }
        }
      }
    }
  }

  private scoreLineGroups(lines: ScoreLine[]): ScoreLine[][] {
    if (!lines.some((line) => line.label !== undefined)) {
      return lines.map((line) => [line]);
    }
    const groups: ScoreLine[][] = [];
    let current: ScoreLine[] = [];
    for (const line of lines) {
      if (line.label === "T1" && current.length > 0) {
        groups.push(current);
        current = [];
      }
      current.push(line);
    }
    if (current.length > 0) {
      groups.push(current);
    }
    return groups;
  }

  private validateLyrics(lines: ScoreLine[]) {
    const hasLabels = lines.some((line) => line.label !== undefined);
    for (const group of this.scoreLineGroups(lines)) {
      const lyrics = group.flatMap((line) => line.lyrics ?? []);
      if (lyrics.length === 0) {
        continue;
      }
      const primaryLines = hasLabels ? group.filter((line) => line.label === undefined || line.label === "T1") : group;
      const soundingNoteCount = primaryLines
        .flatMap((line) => line.measures)
        .flatMap((measure) => measure.notes)
        .filter((note) => note.kind !== "rest").length;
      for (const lyric of lyrics) {
        if (lyric.syllables.length > 1 && lyric.syllables.length !== soundingNoteCount) {
          this.warning(`Lyric has ${lyric.syllables.length} syllables but the main voice has ${soundingNoteCount} notes.`, lyric.range);
        }
      }
    }
  }

  private nextTrackLabel(label: string): string {
    const number = Number(label.slice(1));
    return number === 9 ? "T11" : `T${number + 1}`;
  }

  private validateTies(lines: ScoreLine[]) {
    for (const trackLines of this.trackLineGroups(lines)) {
      this.validateTrackTies(trackLines);
    }
  }

  private validateTrackTies(lines: ScoreLine[]) {
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

  private formatEnding(endings: number[]): string {
    return `[${endings.join(",")}]`;
  }

  private sameEnding(left: number[] | undefined, right: number[] | undefined): boolean {
    if (left === undefined || right === undefined) {
      return left === right;
    }
    return left.length === right.length && left.every((ending, index) => ending === right[index]);
  }

  private maxEnding(endings: number[]): number {
    return Math.max(...endings);
  }

  private firstMissingEnding(endings: number[]): number | undefined {
    const endingSet = new Set(endings);
    const maxEnding = Math.max(...endingSet);
    for (let ending = 1; ending <= maxEnding; ending += 1) {
      if (!endingSet.has(ending)) {
        return ending;
      }
    }
    return undefined;
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
    for (const trackLines of this.trackLineGroups(lines)) {
      this.validateTrackRepeatedEndings(trackLines);
    }
  }

  private validateTrackRepeatedEndings(lines: ScoreLine[]) {
    const measures = lines.flatMap((line) => line.measures);
    const endingGroups = this.groupEndingBlocks(measures);
    for (const endingBlocks of endingGroups) {
      if (endingBlocks.length === 1 && !(endingBlocks[0]!.endings.includes(1) && endingBlocks[0]!.endings.includes(2))) {
        const block = endingBlocks[0]!;
        const measure = measures[block.startIndex]!;
        this.error(`Repeated endings need at least [1] and [2].`, measure.range);
      }
      if (!endingBlocks.some((block) => measures[block.endIndex]?.repeatEnd)) {
        const block = endingBlocks[0]!;
        const measure = measures[block.startIndex]!;
        this.error(`Repeated endings need at least one ending with ':|'.`, measure.range);
      }
      const finalBlock = endingBlocks.at(-1)!;
      if (measures[finalBlock.endIndex]?.repeatEnd) {
        const measure = measures[finalBlock.startIndex]!;
        this.error(`Repeated endings need a final ending without ':|'.`, measure.range);
      }

      for (let blockIndex = 0; blockIndex < endingBlocks.length - 1; blockIndex += 1) {
        const block = endingBlocks[blockIndex]!;
        const endingMeasure = measures[block.endIndex]!;
        const internalRepeatEnd = measures.slice(block.startIndex, block.endIndex).find((measure) => measure.repeatEnd);
        if (internalRepeatEnd) {
          this.error(`Ending ${this.formatEnding(block.endings)} has ':|' before its last measure; move ':|' to the end of the ending.`, internalRepeatEnd.range);
        } else if (!endingMeasure.repeatEnd) {
          const nextBlock = endingBlocks[blockIndex + 1]!;
          this.error(`Ending ${this.formatEnding(block.endings)} should end with ':|' before ending ${this.formatEnding(nextBlock.endings)}.`, endingMeasure.range);
        }
      }

      const seenEndings = new Set<number>();
      let previousBlockMinEnding = 0;
      for (const [blockIndex, block] of endingBlocks.entries()) {
        const blockEndings = new Set<number>();
        const duplicateEnding = block.endings.find((ending) => {
          const duplicate = blockEndings.has(ending) || seenEndings.has(ending);
          blockEndings.add(ending);
          return duplicate;
        });
        if (duplicateEnding !== undefined) {
          const measure = measures[block.startIndex]!;
          this.error(`Ending [${duplicateEnding}] appears more than once. Use each ending number only once.`, measure.range);
          break;
        }
        const blockMinEnding = Math.min(...block.endings);
        if (blockIndex === 0 && blockMinEnding > 1) {
          const measure = measures[block.startIndex]!;
          this.error(`Ending ${this.formatEnding(block.endings)} is out of order; write ending [1] before it.`, measure.range);
          break;
        }
        if (blockMinEnding < previousBlockMinEnding) {
          const measure = measures[block.startIndex]!;
          this.error(`Ending ${this.formatEnding(block.endings)} is out of order; write ending [${previousBlockMinEnding}] before it.`, measure.range);
          break;
        }
        for (const ending of block.endings) {
          seenEndings.add(ending);
        }
        previousBlockMinEnding = blockMinEnding;
      }

      const endingNumbers = endingBlocks.flatMap((block) => block.endings);
      const missingEnding = this.firstMissingEnding(endingNumbers);
      if (missingEnding !== undefined) {
        const laterBlock = endingBlocks.find((block) => block.endings.some((ending) => ending > missingEnding))!;
        const measure = measures[laterBlock.startIndex]!;
        this.error(`Ending [${missingEnding}] is missing before ending ${this.formatEnding(laterBlock.endings)}.`, measure.range);
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
      while (this.sameEnding(measures[endingEndIndex + 1]?.ending, measure.ending)) {
        endingEndIndex += 1;
      }
      endingBlocks.push({ endings: measure.ending, startIndex: measureIndex, endIndex: endingEndIndex });
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
      if (
        previousBlock &&
        block.endings.includes(1) &&
        (!measures[previousBlock.endIndex]?.repeatEnd || this.hasRepeatStartBetween(measures, previousBlock.endIndex + 1, block.startIndex))
      ) {
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
    for (const trackLines of this.trackLineGroups(lines)) {
      this.normalizeTrackFinalEnding(trackLines);
    }
  }

  private normalizeTrackFinalEnding(lines: ScoreLine[]) {
    const measures = lines.flatMap((line) => line.measures);
    const endingBlocks = this.collectEndingBlocks(measures);
    for (let blockIndex = 0; blockIndex < endingBlocks.length; blockIndex += 1) {
      const block = endingBlocks[blockIndex]!;
      const nextBlock = endingBlocks[blockIndex + 1];
      if (nextBlock && this.maxEnding(nextBlock.endings) > this.maxEnding(block.endings)) {
        continue;
      }
      for (let index = block.startIndex + 1; this.sameEnding(measures[index]?.ending, block.endings); index += 1) {
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
