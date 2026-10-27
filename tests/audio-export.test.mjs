import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { RenderingAudioContext } from "@descript/web-audio-js";
import { parse } from "../dist/parser/index.js";
import * as player from "../dist/player/index.js";
import * as scheduling from "../dist/player/offline-schedule.js";
import WebAudioTinySynth from "../dist/player/webaudio-tinysynth.js";
import { exportWavBytes } from "../dist/backend/index.js";

// Exercise the browser export path with real synthesis and a deterministic
// offline clock. Native browser suspension remains a manual integration check.
class OfflineContext extends RenderingAudioContext {
  static instances = [];
  constructor(channels, frames, sampleRate) {
    super({ numberOfChannels: channels, sampleRate, blockSize: 128 });
    this.frames = frames;
    this.pauses = [];
    OfflineContext.instances.push(this);
  }
  suspend(time) {
    assert.ok(time > this.currentTime);
    return new Promise((resolve) => { this.pause = { time, resolve }; });
  }
  startRendering() {
    const result = new Promise((resolve, reject) => {
      this.finish = resolve;
      this.fail = reject;
    });
    this.advance();
    return result;
  }
  async resume() { if (this.finish) this.advance(); }
  advance() {
    queueMicrotask(() => {
      try {
        if (this.pause) {
          const { time, resolve } = this.pause;
          this.pause = undefined;
          this.processTo(time);
          this.pauses.push(this.currentTime);
          resolve();
        } else {
          this.processTo(this.frames / this.sampleRate);
          const data = this.exportAsAudioData();
          this.finish({
            length: this.frames,
            numberOfChannels: data.numberOfChannels,
            getChannelData: (channel) => data.channelData[channel],
          });
        }
      } catch (error) { this.fail(error); }
    });
  }
}

const source = await readFile(new URL("../src/web/audio-export.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
const browserExports = {};
const require = createRequire(import.meta.url);
vm.runInNewContext(outputText, {
  exports: browserExports,
  OfflineAudioContext: OfflineContext,
  require(path) {
    if (path === "../player/index.js") return player;
    if (path === "../player/offline-schedule.js") return scheduling;
    if (path === "../player/webaudio-tinysynth.js") return { default: WebAudioTinySynth };
    return require(path);
  },
});

function document(source) {
  const result = parse(source);
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
  return result.value;
}

function rms(wav, start, end, sampleRate) {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let energy = 0;
  let count = 0;
  for (let frame = Math.ceil(start * sampleRate); frame < Math.floor(end * sampleRate); frame++) {
    const sample = view.getInt16(44 + frame * 4, true);
    energy += sample * sample;
    count++;
  }
  return Math.sqrt(energy / count);
}

for (const [name, exportWav] of [
  ["backend", exportWavBytes],
  ["browser", browserExports.exportBrowserWavBytes],
]) {
  test(`${name} retains the opening and every chord of a voice-heavy export`, async () => {
    const score = document('tempo: 600\ntime: 4/4\n===\n' +
      Array(12).fill('{1 3 5} {2 4 6} {3 5 7} {1 3 5} |').join('\n'));
    const sampleRate = 8000;
    const wav = await exportWav(score, { sampleRate });
    // 48 chord events allocate 144 voices; the previous 64-voice budget
    // removed opening chords before rendering even started.
    for (let chord = 0; chord < 48; chord++) {
      assert.ok(rms(wav, chord * 0.1 + 0.015, chord * 0.1 + 0.075, sampleRate) > 20,
        `chord ${chord} must be audible`);
    }
    if (name === "browser") assert.ok(OfflineContext.instances.at(-1).pauses.length > 5);
  });

  test(`${name} preserves initial rests and notes after silent render windows`, async () => {
    const score = document('tempo: 120\ntime: 4/4\n===\n0 - - - | 1 - - - |');
    const sampleRate = 8000;
    const wav = await exportWav(score, { sampleRate });
    assert.equal(rms(wav, 0, 1.9, sampleRate), 0);
    assert.ok(rms(wav, 2.02, 2.2, sampleRate) > 20);
    const trimmed = await exportWav(score, { sampleRate, omitInitialRests: true });
    assert.ok(rms(trimmed, 0.02, 0.2, sampleRate) > 20);
    assert.ok(trimmed.length < wav.length);
  });
}

test("offline scheduling merges tracks and bounds allocation without shifting absolute times", () => {
  const score = document('tempo: 120\ntime: 4/4\n===\nT1: {1 3 5} - - - | 0 - - - | 2 - - - |\nT2: 5 - - - | 6 - - - | 7 - - - |');
  const starts = [];
  let now = 0;
  const synth = {
    setProgram() {},
    noteOn(channel, note, velocity, start) { starts.push({ channel, note, start, submitted: now }); },
    noteOff() {},
  };
  const schedule = scheduling.createOfflineSchedule(synth, player.compileArrangement(score));
  for (; now < 6; now += 0.5) schedule(now + 0.5);
  assert.equal(starts.length, 7);
  assert.deepEqual(starts.map((event) => event.start), [0, 0, 0, 0, 2, 4, 4]);
  for (const event of starts) {
    assert.ok(event.start >= event.submitted);
    assert.ok(event.start < event.submitted + 0.5);
  }
});
