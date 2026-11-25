import { arrangementDuration, type Arrangement } from "../player/index.js";
import { arrangementMidiBytes } from "../player/midi.js";
import { subscribeSoundfontProgress, type AudioLoadListener } from "./soundfont.js";
import { createPreviewSynth } from "./synth.js";
import { browserMasterGain } from "./volume.js";

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
  private loadingListener?: AudioLoadListener;
  private unsubscribeProgress?: () => void;

  async play(arrangement: Arrangement, onEnded: () => void, onNoteStart?: (indices: number[]) => void, volume = 1, onLoadStatus?: AudioLoadListener) {
    this.stop();
    const generation = this.generation;
    this.loadingListener = onLoadStatus;
    if (!this.engine) {
      onLoadStatus?.({ phase: "preparing" });
      this.unsubscribeProgress = subscribeSoundfontProgress((status) => {
        if (generation === this.generation) onLoadStatus?.(status ?? { phase: "preparing" });
      });
    }
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
            events.removeEvent("timeChange", "preview-load");
            events.removeEvent("midiError", "preview-load");
          };
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error("SoundFont sequence loading timed out."));
          }, 30000);
          events.addEvent("songChange", "preview-load", () => {
            // Song loading preserves the main-thread paused clock. Wait for
            // the worklet to acknowledge zero before consuming note groups.
            events.addEvent("timeChange", "preview-load", ({ newTime }) => {
              if (newTime !== 0) return;
              cleanup();
              resolve();
            });
            engine.sequencer.currentTime = 0;
          });
          events.addEvent("midiError", "preview-load", (error) => { cleanup(); reject(error); });
          try {
            engine.sequencer.loadNewSongList([{ binary: new Uint8Array(arrangementMidiBytes(arrangement)).buffer }]);
          } catch (error) { cleanup(); reject(error); }
        });
      });
      this.setup = setup.catch(() => {});
      await setup;
      if (generation !== this.generation) return;
      engine.masterGain.gain.value = browserMasterGain(Math.max(0, Math.min(2, volume)));
      this.clearLoadStatus();
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
    this.clearLoadStatus();
    this.engine?.sequencer.pause();
    this.engine?.synth.stopAll(true);
  }

  private clearLoadStatus() {
    this.unsubscribeProgress?.();
    this.unsubscribeProgress = undefined;
    this.loadingListener?.(null);
    this.loadingListener = undefined;
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
