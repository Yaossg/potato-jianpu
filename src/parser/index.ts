import * as Grammar from "./grammar";
import { ParseError, Accidental, NoteType } from "./grammar";

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

function parseTimeSignature(time: string): TimeSignature | null {
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

function parseKeySignature(key: string): KeySignature | null {
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

export interface ParsedHeader {
    title: string,
    subtitle: string,
    composer: string,
    keySignature: KeySignature,
    timeSignature: TimeSignature,
    tempo: number
}

function parseHeader(header: Grammar.Header): ParsedHeader | ParseError {
    const { title = '', subtitle = '', composer = '', tempo = '120', key = 'C', time = '4/4' } = header;
    const tempoNumber = Number(tempo);
    if (isNaN(tempoNumber) || tempoNumber <= 0) {
        return new ParseError("Error: invalid tempo", tempo);
    }
    const timeSignature = parseTimeSignature(time);
    if (timeSignature === null) {
        return new ParseError("Error: invalid time signature", time);
    }
    const keySignature = parseKeySignature(key);
    if (keySignature === null) {
        return new ParseError("Error: invalid key signature", key);
    }
    return { title, subtitle, composer, keySignature, timeSignature, tempo: tempoNumber };
}

function durationOf({ dashes = 0, halves = 0, dots = 0 }: Grammar.DurableNote): number {
    let unit = (1 + dashes) / 4;
    let dot = unit / 2;
    for (let i = 0; i < dots; i++) {
        unit += dot;
        dot /= 2;
    }
    return unit / (2 ** halves);
}

export interface ParsedNote {
    accidental?: Accidental;
    note?: number;
    octave?: number;
    type: NoteType;
    tie: boolean;
    dashes: number;
    halves: number;
    dots: number;
    
    duration: number;
    tieAfter: boolean; // true if next note is a tie

    indexOfScore: number;
    lineno: number;
    measureno: number;
}

export type ElementType = 'note' | 'bar' | 'linebreak';

export type Bar = '𝄀' | '𝄂';

interface ParsedMeasure {
    notes: ParsedNote[];
    bar: Bar;
}

export type ParsedScoreLine = ParsedMeasure[]

export type ParsedScore = ParsedScoreLine[];

function parseScore(score: Grammar.Score): ParsedScore | ParseError {
    let indexOfScore = 0;
    const ps: ParsedScore = [];
    for (const [lineno, measures] of score.entries()) {
        const pm: ParsedScoreLine = [];
        for (const [measureno, measure] of measures.entries()) {
            const pn: ParsedNote[] = [];
            for (const noteObj of measure) {
                const { type, note, octave, accidental, dashes = 0, halves = 0, dots = 0, tie = false } = noteObj;
                pn.push({
                    type, note, octave, accidental, // no defaults
                    dashes, halves, dots, tie, // defaults to zero
                    duration: durationOf(noteObj),
                    tieAfter: false, // placeholder, fill later
                    indexOfScore: indexOfScore++,
                    lineno: lineno + 1,
                    measureno: measureno + 1
                })
            }
            pm.push({
                notes: pn,
                bar: measureno === measures.length - 1 && lineno === score.length - 1 ? '𝄂' : '𝄀'
            })
        }
        ps.push(pm);
    }
    const notes = ps.flatMap($ => $).flatMap($ => $.notes);
    if (notes.length > 0 && notes[0].tie) {
        return new ParseError("Error: first note cannot be a tie", JSON.stringify(notes[0]));
    }
    for (const [index, note] of notes.entries()) {
        if (index > notes.length - 2) {
            break;
        }
        const next = notes[index + 1];
        note.tieAfter = next.tie;
    }
    return ps;
}

export interface ParsedFile {
    header: ParsedHeader;
    score: ParsedScore;
}

export function parse(source: string): ParsedFile | ParseError {
    const file = Grammar.parse(source);
    if (file instanceof ParseError) {
        return file;
    }
    const { header, score } = file;
    const parsedHeader = parseHeader(header);
    if (parsedHeader instanceof ParseError) {
        return parsedHeader;
    }
    const parsedScore = parseScore(score);
    if (parsedScore instanceof ParseError) {
        return parsedScore;
    }
    return { header: parsedHeader, score: parsedScore };
}

// re-export
export { ParseError } from './grammar'
export type { Accidental, NoteType } from './grammar'
