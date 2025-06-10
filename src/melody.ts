import { ParsedNote, TimeSignature, parse, ParseError } from "./parser";

export interface MelodyNote {
    note: number | 'rest';
    duration: number;
    indexOfScore: number;
}

export interface Melody {
    notes: MelodyNote[];
    timeSignature: TimeSignature;
    tempo: number;
}

const C_MAJOR_NOTE_MAP = [60, 62, 64, 65, 67, 69, 71];

function parseNote(noteObj: ParsedNote, noteMap: number[]): MelodyNote {
    const { note = 1, octave = 0, type, indexOfScore } = noteObj;
    const duration = noteObj.duration;
    switch (type) {
        case 'rest':
            return { note: 'rest', duration, indexOfScore };
        case 'drum':
            return { note: 60, duration, indexOfScore };
        default:
            return { note: noteMap[note - 1] + octave * 12, duration, indexOfScore };
    }
}

export function parseMelody(source: string): Melody | null {
    const file = parse(source);
    if (file instanceof ParseError) {
        console.log("Error parsing score", file);
        return null;
    }
    const { header, score } = file;
    const { tempo, keySignature, timeSignature } = header;
    const measures = score.flatMap(line => line);
    const notes: MelodyNote[] = [];
    const NOTE_MAP = C_MAJOR_NOTE_MAP.map(note => note + keySignature);
    for (const measure of measures) {
        const noteMap = NOTE_MAP.slice();
      
        for (const noteObj of measure.notes) {
            const { accidental = null, note = 1, tie} = noteObj;
            if (accidental !== null) {
                const noteIndex = note - 1;
                noteMap[noteIndex] = NOTE_MAP[noteIndex] + accidental;
            }
            const melodyNote = parseNote(noteObj, noteMap);
            if (tie) {
                // for the sake of simplicity, we use previous note directly
                // so that possible accidental tie is properly handled
                // if (melody[melody.length - 1].note !== note.note) {
                //     return null;
                // }
                notes[notes.length - 1].duration += melodyNote.duration;
            } else {
                notes.push(melodyNote);
            }
        }
    }
    return { notes, timeSignature, tempo };
}