import WebAudioTinySynth from '@/player/webaudio-tinysynth.js';

import { parseMelody, MelodyNote, skipInitialNotes, DEFAULT_VELOCITY } from './melody';
import { RenderingAudioContext } from '@descript/web-audio-js';

function totalTimeOf(notes: MelodyNote[], beatDuration: number) {
    let totalTime = 0;
    for (const note of notes) {
        totalTime += note.duration * beatDuration;
    }
    return totalTime;
}

function recordSound(synth: WebAudioTinySynth, notes: MelodyNote[], beatDuration: number) {
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
    }
}

export async function synthMusic(source: string, program: number, volume: number, sampleRate: number, startIndex: number): Promise<Blob | null> {
    const melody = parseMelody(source);
    if (melody === null) {
        return null;
    }
    const notes = skipInitialNotes(melody.notes, startIndex);
    const beatDuration = 60 / melody.tempo * melody.timeSignature.beatsPerWholeNote;
    const synth = new WebAudioTinySynth({
        voices: notes.length,
        internalcontext: false
    });
    // @ts-ignore
    const context = new RenderingAudioContext({
        sampleRate,
    });
    // @ts-ignore
    synth.setAudioContext(context);
    await synth.ready();
    synth.reset();
    synth.setMasterVol(volume);
    synth.setProgram(0, program);
    recordSound(synth, notes, beatDuration);
    context.processTo(totalTimeOf(notes, beatDuration));
    const audioData = context.exportAsAudioData();
    // @ts-ignore
    const blob = new Blob([await context.encodeAudioData(audioData)], { type: "audio/wav" });
    return blob;
}
