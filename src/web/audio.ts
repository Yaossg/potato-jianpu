import type { Arrangement, MelodyNote } from "../player/index.js";
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
    arrangement: Arrangement,
    onEnded: () => void,
    onNoteStart?: (noteIndices: number[]) => void,
    volume = 1,
    program = 0,
  ) {
    this.stop();
    const generation = this.playGeneration;
    const synth = await this.getSynth(volume, program);
    if (generation !== this.playGeneration) {
      return;
    }
    const context = synth.getAudioContext();
    await context.resume();
    if (generation !== this.playGeneration) {
      return;
    }

    const secondsPerWholeNote = (60 / arrangement.tempo) * arrangement.beatsPerWholeNote;
    const channel = program >= 128 ? DRUM_CHANNEL : MELODIC_CHANNEL;

    void this.displayNotes(arrangement, secondsPerWholeNote, onNoteStart, generation);
    await this.scheduleSound(arrangement, secondsPerWholeNote, channel, synth, context, generation);
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
    arrangement: Arrangement,
    secondsPerWholeNote: number,
    onNoteStart: ((noteIndices: number[]) => void) | undefined,
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
    const startTime = context.currentTime;
    const displaySchedule = this.noteStartGroups(arrangement);

    for (const item of displaySchedule) {
      if (generation !== this.playGeneration) {
        return;
      }
      await this.displayDelay.delay(startTime + item.offset * secondsPerWholeNote - context.currentTime);
      if (generation !== this.playGeneration) {
        return;
      }
      onNoteStart(item.noteIndices);
    }
  }

  private async scheduleSound(
    arrangement: Arrangement,
    secondsPerWholeNote: number,
    channel: number,
    synth: WebAudioTinySynth,
    context: AudioContext,
    generation: number,
  ) {
    const startTime = context.currentTime;
    let latestEndTime = startTime;
    for (const item of this.noteSchedule(arrangement)) {
      if (generation !== this.playGeneration) {
        return;
      }
      const noteStartTime = startTime + item.offset * secondsPerWholeNote;
      const currentTime = noteStartTime;
      const duration = item.note.duration * secondsPerWholeNote;
      if (item.note.chord !== "rest") {
        for (const midiNote of item.note.chord) {
          synth.noteOn(channel, midiNote, DEFAULT_VELOCITY, noteStartTime);
          synth.noteOff(channel, midiNote, noteStartTime + duration);
        }
      }
      latestEndTime = Math.max(latestEndTime, noteStartTime + duration);

      if (currentTime > context.currentTime + SCHEDULE_AHEAD_SECONDS) {
        await this.scheduleDelay.delay(SCHEDULE_PAUSE_SECONDS);
      }
    }
    if (generation === this.playGeneration) {
      await this.scheduleDelay.delay(latestEndTime - context.currentTime + END_GRACE_SECONDS);
    }
  }

  private noteSchedule(arrangement: Arrangement): Array<{ note: MelodyNote; offset: number }> {
    const schedule: Array<{ note: MelodyNote; offset: number }> = [];
    for (const track of arrangement.tracks) {
      let offset = 0;
      for (const note of track.notes) {
        schedule.push({ note, offset });
        offset += note.duration;
      }
    }
    return schedule.sort((left, right) => left.offset - right.offset || left.note.index - right.note.index);
  }

  private noteStartGroups(arrangement: Arrangement): Array<{ noteIndices: number[]; offset: number }> {
    const groups: Array<{ noteIndices: number[]; offset: number }> = [];
    for (const item of this.noteSchedule(arrangement)) {
      if (item.note.index < 0) {
        continue;
      }
      const current = groups.at(-1);
      if (current && Math.abs(current.offset - item.offset) < 1e-9) {
        current.noteIndices.push(item.note.index);
      } else {
        groups.push({ noteIndices: [item.note.index], offset: item.offset });
      }
    }
    return groups;
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
