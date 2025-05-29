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

export interface ScoreLine {
    measures: Measure[];
    last_bar: boolean;
};

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
            return new ParseError("Error: unknown compilation exception caught", JSON.stringify(error));
        }
    }
    if (parser.results.length === 0) {
        return new ParseError("Error: input is incomplete or invalid", input);
    }
    if (parser.results.length > 1) {
        return new ParseError("Internal Error: ambiguous grammar, please report this to developer", JSON.stringify(parser.results));
    }
    const { header, score } = parser.results[0];
    return { header: header ?? {}, score: score ?? [] };
}

export function durationOf({ dashes = 0, halves = 0, dots = 0 }: DurableNote): number {
    let unit = (1 + dashes) / 4;
    let dot = unit / 2;
    for (let i = 0; i < dots; i++) {
        unit += dot;
        dot /= 2;
    }
    return unit / (2 ** halves);
}

export class TimeSignature {
    beatsPerMeasure: 2 | 3 | 4 | 6 | 9 | 12;
    thNotePerBeat:  2 | 4 | 8 | 16;
    constructor(beatsPerMeasure: 2 | 3 | 4 | 6 | 9 | 12, thNotePerBeat: 2 | 4 | 8 | 16) {
        this.beatsPerMeasure = beatsPerMeasure;
        this.thNotePerBeat = thNotePerBeat;
    }

    // actual = treat 3n notes as n dotted notes (per beat)
    // only used for rendering purpose

    actualBeatsPerMeasure() {
        switch (this.beatsPerMeasure) {
            case 2: case 4:
                return this.beatsPerMeasure;
            default:
                return this.beatsPerMeasure / 3;
        }
    }

    actualNotePerBeat() {
        switch (this.thNotePerBeat) {
            case 2: case 4:
                return 1 / this.thNotePerBeat;
            default:
                return 3 / this.thNotePerBeat;
        }
    }
}

export function parseTimeSignature(time: string): TimeSignature | null {
    const [ beatsPerMeasure, thNotePerBeat ] = time.split('/', 2).map(s => s.trim()).map(Number);
    switch (beatsPerMeasure) {
        case 2: case 3: case 4:
        case 6: case 9: case 12:
            break;
        default:
            return null;
    }
    switch (thNotePerBeat) {
        case 2: case 4: case 8: case 16:
            break;
        default:
            return null;
    }
    return new TimeSignature(beatsPerMeasure, thNotePerBeat);
}

export type KeySignature = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

const keyMap: Record<string, KeySignature> = {
    'C': 0,
    'C#': 1,
    'Db': 1,
    'D': 2,
    'D#': 3,
    'Eb': 3,
    'E': 4,
    'F': 5,
    'F#': 6,
    'Gb': 6,
    'G': 7,
    'G#': 8,
    'Ab': 8,
    'A': 9,
    'A#': 10,
    'Bb': 10,
    'B': 11,
}

export function parseKeySignature(key: string): KeySignature | null {
    key = key.replace(' ', '');
    if (key in keyMap) {
        return keyMap[key];
    }
    const reversed = [...key].reverse().join("");
    if (reversed in keyMap) {
        return keyMap[reversed];
    }
    return null;
}
