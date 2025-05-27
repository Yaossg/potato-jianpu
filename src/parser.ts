import nearley from "nearley";
// @ts-ignore
import grammar from "./generated/grammar";

export interface DurableNote {
    accidental?: number;
    note?: number;
    octave?: number;
    rest?: boolean;
    nopitch?: boolean;
    tie?: boolean;
    hyphens?: number;
    halves?: number;
    dots?: number;
}

export type Measure = DurableNote[];

export type ScoreLine = Measure[];

export type Score = ScoreLine[];

export class ParseError {
    error: string;
    cause?: any;
    constructor(error: string, cause?: any) {
        this.error = error;
        this.cause = cause;
    }
}

export function parse(input: string): Score | ParseError {
    if (input.trim() === "") {
        return [];
    }
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    try {
        parser.feed(input);
    } catch (error) {
        console.log("Error parsing input: ", error);
        return new ParseError("Error parsing input", error);
    }
    if (parser.results.length === 0) {
        console.log("Input is incomplete or invalid: ", input);
        return new ParseError("Input is incomplete or invalid: ", input);
    }
    if (parser.results.length > 1) {
        console.error("(Internal compiler error) Ambiguous grammar: multiple parse trees found: ", parser.results);
        return new ParseError("(Internal compiler error) Ambiguous grammar: multiple parse trees found", parser.results);
    }
    return parser.results[0];
}

export function noteLength(note: DurableNote): number {
    const { hyphens = 0, halves = 0, dots = 0 } = note;
    if (hyphens) {
        return 1 + hyphens;
    }
    let one = 1;
    let dot = 1/2;
    for (let i = 0; i < dots; i++) {
        one += dot;
        dot /= 2;
    }
    return one / (2 ** halves);
}
