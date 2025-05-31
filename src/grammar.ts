import nearley from "nearley";
// @ts-ignore
import grammar from "./generated/grammar";

export type Accidental = null | 0 | -1 | -2 | 1 | 2;

export type NoteType = 'pitch' | 'rest' | 'drum';

export interface DurableNote {
    accidental?: Accidental;
    note?: number;
    octave?: number;
    type: NoteType;
    tie?: boolean;
    dashes?: number;
    halves?: number;
    dots?: number;
}

export type Measure = DurableNote[];

export type ScoreLine = Measure[];

export type Score = ScoreLine[];

export interface Header {
    [key: string]: string;
}

export interface File {
    header: Header;
    score: Score;
}

export class ParseError {
    digest: string;
    detail: string;
    constructor(digest: string, detail: string) {
        this.digest = digest;
        this.detail = detail;
    }
}

export function parse(input: string): File | ParseError {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    try {
        parser.feed(input);
    } catch (error) {
        if (error instanceof Error) {
            return new ParseError(error.message.substring(0, error.message.indexOf('\n') - 1), error.message);
        } else {
            return new ParseError("Internal Error: unknown compilation exception caught", JSON.stringify(error));
        }
    }
    if (parser.results.length === 0) {
        return new ParseError("Error: incomplete input, more tokens expected", input);
    }
    if (parser.results.length > 1) {
        return new ParseError("Internal Error: ambiguous grammar, please report this to developer", JSON.stringify(parser.results));
    }
    const { header, score } = parser.results[0];
    return { header: header ?? {}, score: score ?? [] };
}