import { ParsedNote, TimeSignature, parse, ParseError } from "@/parser";
import { dropWhile } from "@/util";

export interface MelodyNote {
    chord: number[] | 'rest';
    duration: number;
    indexOfScore: number;
}

export interface Melody {
    notes: MelodyNote[];
    timeSignature: TimeSignature;
    tempo: number;
}

const C_MAJOR_NOTE_MAP = [60, 62, 64, 65, 67, 69, 71];

function parseNote(noteObj: ParsedNote, noteMap: number[], program: number): MelodyNote {
    const { type, chord, indexOfScore } = noteObj;
    const duration = noteObj.duration;
    switch (type) {
        case 'rest':
            return { chord: 'rest', duration, indexOfScore };
        case 'drum':
            return { chord: [program < 128 ? 60 : program - 128 + 35], duration, indexOfScore };
        case 'pitch':
            const midiNotes = chord!.map(pitchNote => {
                const { note = 1, octave = 0 } = pitchNote;
                return noteMap[note - 1] + octave * 12;
            });
            return { chord: midiNotes, duration, indexOfScore };
        default:
            return { chord: [60], duration, indexOfScore };
    }
}

export function parseMelody(source: string, program: number): Melody | null {
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
            for (const pitchNote of noteObj.chord || []) {
                if (pitchNote.accidental !== null && pitchNote.accidental !== undefined) {
                    const noteIndex = pitchNote.note - 1;
                    noteMap[noteIndex] = NOTE_MAP[noteIndex] + pitchNote.accidental;
                }
            }

            const melodyNote = parseNote(noteObj, noteMap, program);
            if (noteObj.tie) {
                // use previous note directly for the sake of simplicity
                // so that possible accidental tie is properly handled
                notes[notes.length - 1].duration += melodyNote.duration;
            } else {
                notes.push(melodyNote);
            }
        }
    }
    return { notes, timeSignature, tempo };
}

export function skipInitialNotes(notes: MelodyNote[], startIndex: number) {
    if (startIndex < 0) { // omit initial rests
        startIndex = notes.findIndex(note => note.chord !== 'rest');
    }
    return dropWhile(notes, note => note.indexOfScore < startIndex);
}

export const DEFAULT_VELOCITY = 64;
