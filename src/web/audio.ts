import type { Melody, MelodyNote } from "../player/index.js";
import { midiToFrequency, SYNTH_ATTACK_SECONDS, SYNTH_BROWSER_GAIN, SYNTH_RELEASE_SECONDS, waveformForProgram } from "../player/synth.js";

function totalSeconds(notes: MelodyNote[], secondsPerWholeNote: number): number {
  return notes.reduce((sum, note) => sum + note.duration * secondsPerWholeNote, 0);
}

export class PreviewAudioPlayer {
  private context: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
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
    this.context = new AudioContext();
    await this.context.resume();

    const secondsPerWholeNote = (60 / melody.tempo) * melody.beatsPerWholeNote;
    let currentTime = this.context.currentTime;
    let elapsedSeconds = 0;

    for (const note of notes) {
      const duration = note.duration * secondsPerWholeNote;
      this.noteTimers.push(
        window.setTimeout(() => {
          onNoteStart?.(note.index);
        }, elapsedSeconds * 1000),
      );
      if (note.chord !== "rest") {
        for (const midiNote of note.chord) {
          this.scheduleTone(midiNote, currentTime, duration, volume, program);
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
    for (const oscillator of this.oscillators) {
      try {
        oscillator.stop();
      } catch {
        // Oscillator may already have stopped.
      }
    }
    this.oscillators = [];
    void this.context?.close();
    this.context = null;
  }

  private scheduleTone(midiNote: number, start: number, duration: number, volume: number, program: number) {
    if (!this.context) {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = waveformForProgram(program);
    oscillator.frequency.setValueAtTime(midiToFrequency(midiNote), start);
    gain.gain.setValueAtTime(0.0001, start);
    const gainValue = Math.max(0.0001, SYNTH_BROWSER_GAIN * Math.max(0, Math.min(2, volume)));
    gain.gain.exponentialRampToValueAtTime(gainValue, start + SYNTH_ATTACK_SECONDS);
    gain.gain.setValueAtTime(
      gainValue,
      Math.max(start + SYNTH_ATTACK_SECONDS, start + duration - SYNTH_RELEASE_SECONDS),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    this.oscillators.push(oscillator);
  }
}
