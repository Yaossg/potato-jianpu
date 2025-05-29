/// <reference path="webaudio-tinysynth.d.ts" />
import WebAudioTinySynth from 'webaudio-tinysynth';

import { parse, DurableNote, durationOf, ParseError, KeySignature, TimeSignature, parseTimeSignature, parseKeySignature } from "./parser";

interface MelodyNote {
    note: number | 'rest';
    duration: number;
}

interface Melody {
    notes: MelodyNote[];
    timeSignature: TimeSignature;
    tempo: number;
}

const synth = new WebAudioTinySynth();
let callbackId = -1;
const C_MAJOR_NOTE_MAP = [60, 62, 64, 65, 67, 69, 71];

function parseNote(durableNote: DurableNote, noteMap: number[]): MelodyNote {
    const { note = 1, octave = 0, type } = durableNote;
    const duration = durationOf(durableNote);
    switch (type) {
        case 'rest':
            return { note: 'rest', duration };
        case 'drum':
            return { note: 60, duration };
        default:
            return { note: noteMap[note - 1] + octave * 12, duration };
    }
}

function parseMelody(source: string): Melody | null {
    const file = parse(source);
    if (file instanceof ParseError) {
        console.log("Error parsing score", file);
        return null;
    }
    const { header, score } = file;
    const { tempo = '120', key = 'C', time = '4/4' } = header;
    const timeSignature = parseTimeSignature(time);
    const keySignature = parseKeySignature(key);
    const tempoNumber = Number(tempo);
    if (isNaN(tempoNumber) || tempoNumber <= 0 || timeSignature === null || keySignature === null) {
        console.error("Error: Invalid header", header);
        return null;
    }
    const measures = score.flatMap(line => line.measures);
    const notes: MelodyNote[] = [];
    const NOTE_MAP = C_MAJOR_NOTE_MAP.map(note => note + keySignature);
    for (const measure of measures) {
        const noteMap = NOTE_MAP.slice();
      
        for (const durableNote of measure) {
            const { accidental = null, note = 1, tie = false } = durableNote;
            if (accidental !== null) {
                const noteIndex = note - 1;
                noteMap[noteIndex] = NOTE_MAP[noteIndex] + accidental;
            }
            const melodyNote = parseNote(durableNote, noteMap);
            if (tie) {
                // if (notes.length === 0) {
                //     return null;
                // }
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
    return { notes, timeSignature, tempo: tempoNumber };
}

export async function playMusic(source: string, program: number, volume: number) {
    stopMusic();
    synth.setMasterVol(volume);
    synth.setProgram(0, program)
    const melody = parseMelody(source);
    if (melody === null) {
        return;
    }
    const beatDuration = 60 / melody.tempo * melody.timeSignature.thNotePerBeat;
    const audioContext = synth.getAudioContext();
    for (let i = 0; i < melody.notes.length; i++) {
        const { note, duration } = melody.notes[i];
        const actualDuration = duration * beatDuration;
        if (note !== 'rest') {
            const baseTime = audioContext.currentTime;
            synth.noteOn(0, note, 64, baseTime);
            synth.noteOff(0, note, baseTime + actualDuration);
        }
        await new Promise(resolve => callbackId = setTimeout(resolve, actualDuration * 1000));
        callbackId = -1;
    }
}

export function stopMusic() {
    synth.reset();
    if (callbackId !== -1) {
        clearTimeout(callbackId);
        callbackId = -1;
    }
}
