/// <reference path="webaudio-tinysynth.d.ts" />
import WebAudioTinySynth from 'webaudio-tinysynth';

import { tokenize, parse, DecoratedNote } from "./parser";

interface MelodyNote {
    note: number | 'rest';
    duration: number;
}

const synth = new WebAudioTinySynth();
let callbackId = -1;

function parseNote(result: DecoratedNote): MelodyNote {
    const noteLength = result.getNoteLength();
    if (result.note === 0) {
        return { note: 'rest', duration: noteLength };
    }
    const noteMap = [60, 62, 64, 65, 67, 69, 71];
    const { note, high, low } = result;
    const octave = high - low;
    return { note: noteMap[note - 1] + octave * 12, duration: noteLength };
}

function parseMelody(source: string): MelodyNote[] | null {
    const tokens = tokenize(source);
    const melody: MelodyNote[] = [];
    for (let token of tokens) {
        if (token === '|' || token === '|:' || token === ':|' || token === '||' || token === '\n') {
            continue;
        }
        const result = parse(token);
        if (result === null) {
            return null;
        }
        const note = parseNote(result);
        const { tie } = result;
        if (tie) {
            if (melody.length === 0) {
                return null;
            }
            // for the sake of simplicity, we use previous note directly
            // so that possible accidental tie is properly handled
            // if (melody[melody.length - 1].note !== note.note) {
            //     return null;
            // }
            melody[melody.length - 1].duration += note.duration;
        } else {
            melody.push(note);
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
        console.error("Invalid music source");
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
