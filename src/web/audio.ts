import type { Melody, MelodyNote } from "../player/index.js";
import WebAudioTinySynth from "../player/webaudio-tinysynth.js";

const DEFAULT_VELOCITY = 64;
const DRUM_CHANNEL = 9;
const MELODIC_CHANNEL = 0;

function totalSeconds(notes: MelodyNote[], secondsPerWholeNote: number): number {
  return notes.reduce((sum, note) => sum + note.duration * secondsPerWholeNote, 0);
}

export class PreviewAudioPlayer {
  private synth: WebAudioTinySynth | null = null;
  private stopTimer: number | null = null;
  private noteTimers: number[] = [];

  async play(
    melody: Melody,
    onEnded: () => void,
    onNoteStart?: (noteIndex: number) => void,
    startNoteIndex = 0,
    volume = 1,
    program = 0,
  ) {
    this.stop();
    const startIndex = melody.notes.findIndex((note) => note.index >= startNoteIndex);
    const notes = startIndex >= 0 ? melody.notes.slice(startIndex) : [];
    const synth = await this.getSynth(volume, program);
    const context = synth.getAudioContext();
    await context.resume();

    const secondsPerWholeNote = (60 / melody.tempo) * melody.beatsPerWholeNote;
    let currentTime = context.currentTime;
    let elapsedSeconds = 0;
    const channel = program >= 128 ? DRUM_CHANNEL : MELODIC_CHANNEL;

    for (const note of notes) {
      const duration = note.duration * secondsPerWholeNote;
      this.noteTimers.push(
        window.setTimeout(() => {
          onNoteStart?.(note.index);
        }, elapsedSeconds * 1000),
      );
      if (note.chord !== "rest") {
        for (const midiNote of note.chord) {
          synth.noteOn(channel, midiNote, DEFAULT_VELOCITY, currentTime);
          synth.noteOff(channel, midiNote, currentTime + duration);
        }
      }
      currentTime += duration;
      elapsedSeconds += duration;
    }

    this.stopTimer = window.setTimeout(() => {
      this.stop();
      onEnded();
    }, totalSeconds(notes, secondsPerWholeNote) * 1000 + 80);
  }

  stop() {
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    for (const timer of this.noteTimers) {
      window.clearTimeout(timer);
    }
    this.noteTimers = [];
    this.synth?.reset();
  }

  private async getSynth(volume: number, program: number): Promise<WebAudioTinySynth> {
    this.synth ??= new WebAudioTinySynth();
    await this.synth.ready();
    this.synth.reset();
    this.synth.setMasterVol(Math.max(0, Math.min(2, volume)));
    if (program < 128) {
      this.synth.setProgram(MELODIC_CHANNEL, program);
    }
    return this.synth;
  }
}
