/// <reference path="webaudio-tinysynth.d.ts" />
import WebAudioTinySynth from 'webaudio-tinysynth';

import { parse, DurableNote, noteLength, ParseError } from "./parser";

interface MelodyNote {
    note: number | 'rest';
    duration: number;
}

const synth = new WebAudioTinySynth();
let callbackId = -1;
const DEFAULT_NOTE_MAP = [60, 62, 64, 65, 67, 69, 71];

function parseNote(durableNote: DurableNote, noteMap: number[]): MelodyNote {
    const { note = 1, octave = 0, rest = false, nopitch = false } = durableNote;
    const duration = noteLength(durableNote);
    if (rest) {
        return { note: 'rest', duration };
    } else if (nopitch) {
        return { note: 60, duration };
    }
    return { note: noteMap[note - 1] + octave * 12, duration };
}

function parseMelody(source: string): MelodyNote[] | null {
    const measures = parse(source);
    if (measures instanceof ParseError) {
        console.log("Error parsing score: ", measures);
        return null;
    }
    const melody: MelodyNote[] = [];
    for (const measure of measures) {
        const noteMap = DEFAULT_NOTE_MAP.slice();
      
        for (const durableNote of measure) {
            const { accidental = null, note = 1, tie = false } = durableNote;
            if (accidental !== null) {
                const noteIndex = note - 1;
                noteMap[noteIndex] = DEFAULT_NOTE_MAP[noteIndex] + accidental;
            }
            const melodyNote = parseNote(durableNote, noteMap);
            if (tie) {
                if (melody.length === 0) {
                    return null;
                }
                // for the sake of simplicity, we use previous note directly
                // so that possible accidental tie is properly handled
                // if (melody[melody.length - 1].note !== note.note) {
                //     return null;
                // }
                melody[melody.length - 1].duration += melodyNote.duration;
            } else {
                melody.push(melodyNote);
            }

        }
    }
    return melody;
}

export async function playMusic(source: string, bpm: number, program: number, volume: number) {
    stopMusic();
    synth.setMasterVol(volume);
    synth.setProgram(0, program)

    const melody = parseMelody(source);
    if (melody === null) {
        console.error("(Internal synthesizer error) Error parsing melody", source);
        return;
    }
    const beatDuration = 60 / bpm;
    const audioContext = synth.getAudioContext();
    for (let i = 0; i < melody.length; i++) {
        const { note, duration } = melody[i];
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
