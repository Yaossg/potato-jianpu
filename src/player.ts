/// <reference path="webaudio-tinysynth.d.ts" />
import WebAudioTinySynth from 'webaudio-tinysynth';

import { ParsedNote, TimeSignature, parse, ParseError } from "./parser";

interface MelodyNote {
    note: number | 'rest';
    duration: number;
    indexOfScore: number;
}

interface Melody {
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

function parseMelody(source: string): Melody | null {
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

function dropWhile<T>(array: T[], pred: (element: T) => boolean): T[] {
    let i = 0;
    for (; i < array.length; i++) {
        if (!pred(array[i])) {
            break;
        }
    }
    return array.slice(i);
}

const synth = new WebAudioTinySynth();

class Continuation {
    id: number = -1;

    async delay(seconds: number) {
        await new Promise(resolve => this.id = setTimeout(resolve, seconds * 1000));
        this.id = -1;
    }

    cancel() {
        if (this.id !== -1) {
            clearTimeout(this.id);
            this.id = -1;
        }
    }
}

const noteDisplayPause = new Continuation();
const soundPlayPause = new Continuation();

async function displayNote(notes: MelodyNote[], beatDuration: number, setPlayingNote: (note: number) => void) {
    const audioContext = synth.getAudioContext();
    let baseTime = audioContext.currentTime;
    const displayUntils = notes.map(note => ({display: note.indexOfScore, until: baseTime += note.duration * beatDuration}))
    for (const { display, until } of displayUntils) {
        setPlayingNote(display);
        await noteDisplayPause.delay(until - audioContext.currentTime);
    }
}

async function playSound(notes: MelodyNote[], beatDuration: number) {
    const audioContext = synth.getAudioContext();
    let currentTime = audioContext.currentTime;
    for (let i = 0; i < notes.length; i++) {
        const { note, duration } = notes[i];
        const actualDuration = duration * beatDuration;
        if (note !== 'rest') {
            synth.noteOn(0, note, 64, currentTime);
            synth.noteOff(0, note, currentTime + actualDuration);
        }
        currentTime += actualDuration;
        // if the next note is more than 1 second away, wait for it
        if (currentTime > audioContext.currentTime + 1) {
            await soundPlayPause.delay(0.5);
        }
    }
    // wait for the last note to play
    await soundPlayPause.delay(currentTime - audioContext.currentTime);
}

export async function playMusic(source: string, program: number, volume: number, startIndex: number, setPlayingNote: (note: number) => void) {
    await synth.ready();
    stopMusic();
    synth.setMasterVol(volume);
    synth.setProgram(0, program)
    const melody = parseMelody(source);
    if (melody === null) {
        return;
    }
    const notes = dropWhile(melody.notes, note => note.indexOfScore < startIndex)
    const beatDuration = 60 / melody.tempo * melody.timeSignature.thNotePerBeat;
    await Promise.all([
        displayNote(notes, beatDuration, setPlayingNote), 
        playSound(notes, beatDuration)
    ]);
}

export function stopMusic() {
    synth.reset();
    soundPlayPause.cancel();
    noteDisplayPause.cancel();
}