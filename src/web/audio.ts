import type { Melody, MelodyNote } from "../player/index.js";
import WebAudioTinySynth from "../player/webaudio-tinysynth.js";

const DEFAULT_VELOCITY = 64;
const DRUM_CHANNEL = 9;
const MELODIC_CHANNEL = 0;
const SCHEDULE_AHEAD_SECONDS = 1;
const SCHEDULE_PAUSE_SECONDS = 0.5;
const END_GRACE_SECONDS = 0.08;

class CancellableDelay {
  private timer: number | null = null;
  private resolve: (() => void) | null = null;

  delay(seconds: number): Promise<void> {
    this.cancel();
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.resolve = null;
        resolve();
      }, Math.max(0, seconds) * 1000);
    });
  }

  cancel() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.resolve) {
      this.resolve();
      this.resolve = null;
    }
  }
}

export class PreviewAudioPlayer {
  private synth: WebAudioTinySynth | null = null;
  private playGeneration = 0;
  private scheduleDelay = new CancellableDelay();
  private displayDelay = new CancellableDelay();

  async play(
    melody: Melody,
    onEnded: () => void,
    onNoteStart?: (noteIndex: number) => void,
    startNoteIndex = 0,
    volume = 1,
    program = 0,
  ) {
    this.stop();
    const generation = this.playGeneration;
    const startIndex = melody.notes.findIndex((note) => note.index >= startNoteIndex);
    const notes = startIndex >= 0 ? melody.notes.slice(startIndex) : [];
    const synth = await this.getSynth(volume, program);
    if (generation !== this.playGeneration) {
      return;
    }
    const context = synth.getAudioContext();
    await context.resume();
    if (generation !== this.playGeneration) {
      return;
    }

    const secondsPerWholeNote = (60 / melody.tempo) * melody.beatsPerWholeNote;
    const channel = program >= 128 ? DRUM_CHANNEL : MELODIC_CHANNEL;

    void this.displayNotes(notes, secondsPerWholeNote, onNoteStart, generation);
    await this.scheduleSound(notes, secondsPerWholeNote, channel, synth, context, generation);
    if (generation === this.playGeneration) {
      onEnded();
    }
  }

  stop() {
    this.playGeneration += 1;
    this.scheduleDelay.cancel();
    this.displayDelay.cancel();
    this.synth?.reset();
  }

  private async displayNotes(
    notes: MelodyNote[],
    secondsPerWholeNote: number,
    onNoteStart: ((noteIndex: number) => void) | undefined,
    generation: number,
  ) {
    if (!onNoteStart) {
      return;
    }
    const synth = this.synth;
    if (!synth) {
      return;
    }
    const context = synth.getAudioContext();
    let currentTime = context.currentTime;
    const displaySchedule = notes.map((note) => {
      currentTime += note.duration * secondsPerWholeNote;
      return { noteIndex: note.index, until: currentTime };
    });

    for (const item of displaySchedule) {
      if (generation !== this.playGeneration) {
        return;
      }
      onNoteStart(item.noteIndex);
      await this.displayDelay.delay(item.until - context.currentTime);
    }
  }

  private async scheduleSound(
    notes: MelodyNote[],
    secondsPerWholeNote: number,
    channel: number,
    synth: WebAudioTinySynth,
    context: AudioContext,
    generation: number,
  ) {
    let currentTime = context.currentTime;
    for (const note of notes) {
      if (generation !== this.playGeneration) {
        return;
      }
      const duration = note.duration * secondsPerWholeNote;
      if (note.chord !== "rest") {
        for (const midiNote of note.chord) {
          synth.noteOn(channel, midiNote, DEFAULT_VELOCITY, currentTime);
          synth.noteOff(channel, midiNote, currentTime + duration);
        }
      }
      currentTime += duration;

      if (currentTime > context.currentTime + SCHEDULE_AHEAD_SECONDS) {
        await this.scheduleDelay.delay(SCHEDULE_PAUSE_SECONDS);
      }
    }
    if (generation === this.playGeneration) {
      await this.scheduleDelay.delay(currentTime - context.currentTime + END_GRACE_SECONDS);
    }
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
