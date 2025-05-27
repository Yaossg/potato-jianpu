import nearley from "nearley";
// @ts-ignore
import grammar from "./generated/grammar";

export interface DurableNote {
    accidental?: null | 0 | -1 | -2 | 1 | 2;
    note?: number;
    octave?: number;
    type: 'pitch' | 'rest' | 'drum';
    tie?: boolean;
    dashes?: number;
    halves?: number;
    dots?: number;
}

export type Measure = DurableNote[];

export interface ScoreLine {
    measures: Measure[];
    last_bar: boolean;
};

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

export function durationOf({ dashes = 0, halves = 0, dots = 0 }: DurableNote): number {
    if (dashes) {
        return 1 + dashes;
    }
    let one = 1;
    let dot = 1/2;
    for (let i = 0; i < dots; i++) {
        one += dot;
        dot /= 2;
    }
    return one / (2 ** halves);
}
