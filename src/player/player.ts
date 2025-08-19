/// <reference path="webaudio-tinysynth.d.ts" />
import WebAudioTinySynth from 'webaudio-tinysynth';

import { Continuation } from '@/util';
import { parseMelody, MelodyNote, skipInitialNotes, DEFAULT_VELOCITY } from './melody';

const synth = new WebAudioTinySynth();

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
        const { chord, duration } = notes[i];
        const actualDuration = duration * beatDuration;
        if (chord !== 'rest') {
            for (const midiNote of chord) {
                synth.noteOn(0, midiNote, DEFAULT_VELOCITY, currentTime);
                synth.noteOff(0, midiNote, currentTime + actualDuration);
            }
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
    const notes = skipInitialNotes(melody.notes, startIndex);
    const beatDuration = 60 / melody.tempo * melody.timeSignature.beatsPerWholeNote;
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