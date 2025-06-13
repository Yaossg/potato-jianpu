/// <reference path="webaudio-tinysynth.d.ts" />
import WebAudioTinySynth from 'webaudio-tinysynth';

import { dropWhile, Continuation } from '@/util';
import { parseMelody, MelodyNote } from './melody';
import { MIDIFile, MIDITrack } from './midi';

const DEFAULT_VELOCITY = 64;

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
        const { note, duration } = notes[i];
        const actualDuration = duration * beatDuration;
        if (note !== 'rest') {
            synth.noteOn(0, note, DEFAULT_VELOCITY, currentTime);
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

function skipInitialNotes(notes: MelodyNote[], startIndex: number) {
    if (startIndex < 0) { // omit initial rests
        startIndex = notes.findIndex(note => note.note !== 'rest');
    }
    return dropWhile(notes, note => note.indexOfScore < startIndex);
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

export function exportMusic(source: string, program: number, startIndex: number): string | null {
    const melody = parseMelody(source);
    if (melody === null) {
        return null;
    }
    const notes = skipInitialNotes(melody.notes, startIndex);
    const midiFile = new MIDIFile(melody.tempo, melody.timeSignature);
    const track = new MIDITrack(0, program);

    let delta = 0;
    for (const note of notes) {
        if (note.note === 'rest') {
            delta += note.duration;
            continue;
        }
        track.noteOn(delta, note.note, DEFAULT_VELOCITY);
        delta = 0;
        track.noteOff(note.duration, note.note);
    }
    midiFile.addTrack(track);
    return midiFile.toDataURI()
}