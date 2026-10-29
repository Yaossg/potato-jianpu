import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as playerModule from "../dist/player/index.js";
import * as midiModule from "../dist/player/midi.js";
import { BasicMIDI, SpessaLog } from "spessasynth_core";
SpessaLog.setLogLevel(false, false, false);
const source = await readFile(new URL("../src/web/audio.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
function harness({ delayed = false, fail = false } = {}) {
  const context = { currentTime: 10, async resume() {} };
  const timers = new Map();
  const handlers = new Map();
  const songs = [];
  let timerId = 0, starts = 0, stops = 0, loads = 0, origin = 10;
  let release;
  const loading = delayed ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  const sequencer = {
    isFinished: false,
    get currentTime() { return context.currentTime - origin; },
    eventHandler: {
      addEvent(type, id, fn) { handlers.set(type, fn); },
      removeEvent(type) { handlers.delete(type); },
    },
    loadNewSongList(list) {
      songs.push(BasicMIDI.fromArrayBuffer(list[0].binary));
      queueMicrotask(() => handlers.get("songChange")?.({}));
    },
    play() { origin = context.currentTime; starts++; },
    pause() {},
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    Uint8Array,
    AudioContext: function () { return context; },
    require(path) {
      if (path === "../player/index.js") return playerModule;
      if (path === "../player/midi.js") return midiModule;
      if (path === "./soundfont.js") return { subscribeSoundfontProgress: () => () => {} };
      if (path === "./synth.js") return { async createPreviewSynth() {
        loads++;
        await loading;
        if (fail && loads === 1) throw new Error("Network failed");
        return { sequencer, synth: { setSystemParameter() {}, stopAll() { stops++; } } };
      } };
      throw new Error(`Unexpected import: ${path}`);
    },
    window: {
      setTimeout(callback, milliseconds) { timers.set(++timerId, { callback, time: context.currentTime + milliseconds / 1000 }); return timerId; },
      clearTimeout(id) { timers.delete(id); },
    },
  });
  async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
  async function tick(time) {
    context.currentTime = time;
    for (const [id, timer] of [...timers]) if (timer.time <= time) { timers.delete(id); timer.callback(); }
    await flush();
  }
  return { player: new exports.PreviewAudioPlayer(), context, songs, timers, flush, tick, release, get starts() { return starts; }, get stops() { return stops; }, get loads() { return loads; } };
}
function arrangement(notes) {
  const timing = { tempo: 120, beatsPerWholeNote: 4, beatsPerMeasure: 4 };
  return { ...timing, tracks: [{ ...timing, notes, name: "T1", program: 0, volume: 1 }] };
}
test("submits the whole long score once and follows the audio clock for highlighting", async () => {
  const h = harness();
  const notes = Array.from({ length: 600 }, (_, index) => ({ chord: [60, 64, 67], duration: 1, index }));
  let ended = 0;
  const highlights = [];
  const playing = h.player.play(arrangement(notes), () => ended++, ids => highlights.push([...ids]));
  await h.flush();
  assert.equal(h.songs.length, 1);
  assert.equal(h.songs[0].tracks.flatMap(t => t.events).filter(e => (e.statusByte & 0xf0) === 0x90).length, 1800);
  assert.deepEqual(highlights, [[0]]);
  await h.tick(12.01);
  assert.deepEqual(highlights.at(-1), [1]);
  await h.tick(1210.1);
  await playing;
  assert.equal(ended, 1);
  assert.equal(h.timers.size, 0);
});
test("stop while the sound bank loads cannot start stale playback", async () => {
  const h = harness({ delayed: true });
  let ended = 0;
  const statuses = [];
  const playing = h.player.play(arrangement([{ chord: [60], duration: 1, index: 0 }]), () => ended++, undefined, 1, status => statuses.push(status));
  await h.flush();
  assert.equal(statuses.at(-1).phase, "preparing");
  h.player.stop();
  assert.equal(statuses.at(-1), null);
  h.release();
  await playing;
  assert.equal(h.starts, 0);
  assert.equal(ended, 0);
});
test("rapid restart during loading reuses one synth and plays only the latest score", async () => {
  const h = harness({ delayed: true });
  let oldEnded = false, newEnded = false;
  const old = h.player.play(arrangement([{ chord: [60], duration: 1, index: 0 }]), () => oldEnded = true);
  await h.flush();
  const next = h.player.play(arrangement([{ chord: [72], duration: 0.25, index: 1 }]), () => newEnded = true);
  await h.flush();
  h.release();
  await h.flush();
  await old;
  await h.tick(11);
  await next;
  assert.equal(h.loads, 1);
  assert.equal(h.songs.length, 1);
  assert.equal(oldEnded, false);
  assert.equal(newEnded, true);
});
test("loading failures are retryable and stopped playback does not complete", async () => {
  const h = harness({ fail: true });
  const score = arrangement([{ chord: "rest", duration: 10, index: 0 }, { chord: [60], duration: 1, index: 1 }]);
  await assert.rejects(h.player.play(score, () => {}), /Network failed/);
  let ended = false;
  const retry = h.player.play(score, () => ended = true);
  await h.flush();
  assert.equal(h.loads, 2);
  assert.equal(h.songs[0].firstNoteOn, 3840);
  h.player.stop();
  await retry;
  assert.equal(ended, false);
  assert.equal(h.timers.size, 0);
  assert.ok(h.stops > 0);
});
