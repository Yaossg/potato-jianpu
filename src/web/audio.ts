import { arrangementDuration, type Arrangement } from "../player/index.js";
import { arrangementMidiBytes } from "../player/midi.js";
import { createPreviewSynth } from "./synth.js";

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
  private context: AudioContext | null = null;
  private engine: Awaited<ReturnType<typeof createPreviewSynth>> | null = null;
  private loading: Promise<Awaited<ReturnType<typeof createPreviewSynth>>> | null = null;
  private setup: Promise<void> = Promise.resolve();
  private generation = 0;
  private delay = new CancellableDelay();

  async play(arrangement: Arrangement, onEnded: () => void, onNoteStart?: (indices: number[]) => void, volume = 1) {
    this.stop();
    const generation = this.generation;
    try {
      // Resume in the user gesture, before downloading the sound bank.
      this.context ??= new AudioContext();
      const context = this.context;
      await context.resume();
      if (generation !== this.generation) return;
      this.loading ??= createPreviewSynth(context).then((engine) => {
        this.engine = engine;
        return engine;
      }).catch((error) => {
        this.loading = null;
        throw error;
      });
      const engine = await this.loading;
      if (generation !== this.generation) return;
      // Serialize song loads so an old songChange cannot acknowledge a new request.
      const setup = this.setup.then(async () => {
        if (generation !== this.generation) return;
        await new Promise<void>((resolve, reject) => {
          const events = engine.sequencer.eventHandler;
          const cleanup = () => {
            window.clearTimeout(timeout);
            events.removeEvent("songChange", "preview-load");
            events.removeEvent("midiError", "preview-load");
          };
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error("SoundFont sequence loading timed out."));
          }, 30000);
          events.addEvent("songChange", "preview-load", () => { cleanup(); resolve(); });
          events.addEvent("midiError", "preview-load", (error) => { cleanup(); reject(error); });
          try {
            engine.sequencer.loadNewSongList([{ binary: new Uint8Array(arrangementMidiBytes(arrangement)).buffer }]);
          } catch (error) { cleanup(); reject(error); }
        });
      });
      this.setup = setup.catch(() => {});
      await setup;
      if (generation !== this.generation) return;
      engine.synth.setSystemParameter("gain", Math.max(0, Math.min(2, volume)));
      engine.sequencer.play();
      const start = context.currentTime;
      const secondsPerWhole = 60 / arrangement.tempo * arrangement.beatsPerWholeNote;
      const duration = arrangementDuration(arrangement) * secondsPerWhole;
      const groups = this.noteStartGroups(arrangement, secondsPerWhole);
      let cursor = 0;
      while (generation === this.generation) {
        const elapsed = engine.sequencer.isFinished ? context.currentTime - start : engine.sequencer.currentTime;
        while (cursor < groups.length && groups[cursor]!.time <= elapsed) {
          const group = groups[cursor++]!;
          onNoteStart?.(group.indices);
        }
        // Include trailing rests even if the sequencer has reached its last note.
        if (elapsed >= duration) break;
        await this.delay.delay(0.02);
      }
      if (generation === this.generation) onEnded();
    } catch (error) {
      if (generation === this.generation) { this.stop(); throw error; }
    }
  }

  stop() {
    this.generation++;
    this.delay.cancel();
    this.engine?.sequencer.pause();
    this.engine?.synth.stopAll(true);
  }

  private noteStartGroups(arrangement: Arrangement, secondsPerWhole: number) {
    const notes = arrangement.tracks.flatMap((track) => {
      let offset = 0;
      return track.notes.map((note) => {
        const item = { index: note.index, time: offset * secondsPerWhole };
        offset += note.duration;
        return item;
      });
    }).filter((note) => note.index >= 0).sort((a, b) => a.time - b.time || a.index - b.index);
    const groups: Array<{ time: number; indices: number[] }> = [];
    for (const note of notes) {
      const last = groups.at(-1);
      if (last && Math.abs(last.time - note.time) < 1e-9) last.indices.push(note.index);
      else groups.push({ time: note.time, indices: [note.index] });
    }
    return groups;
  }
}
