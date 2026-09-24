import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as playerModule from "../dist/player/index.js";

const source = await readFile(new URL("../src/web/audio.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});

function harness() {
  const context = { currentTime: 10, async resume() {} };
  const timers = new Map();
  const starts = [];
  const ends = [];
  let timerId = 0;
  class Synth {
    async ready() {}
    reset() {}
    setMasterVol() {}
    setProgram() {}
    getAudioContext() { return context; }
    noteOn(channel, note, velocity, time) {
      starts.push({ channel, note, velocity, time, submittedAt: context.currentTime });
    }
    noteOff(channel, note, time) { ends.push({ channel, note, time }); }
  }
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(path) {
      if (path === "../player/index.js") return playerModule;
      if (path === "../player/webaudio-tinysynth.js") return { default: Synth };
      throw new Error(`Unexpected import: ${path}`);
    },
    window: {
      setTimeout(callback, milliseconds) {
        timers.set(++timerId, { callback, time: context.currentTime + milliseconds / 1000 });
        return timerId;
      },
      clearTimeout(id) { timers.delete(id); },
    },
  });
  // Flush async synth setup and scheduler continuations without wall-clock waits.
  async function flush() {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  }
  async function tick(advanceAudio = true) {
    await flush();
    const entry = [...timers.entries()].sort((a, b) => a[1].time - b[1].time)[0];
    assert.ok(entry, "playback should have a pending timer");
    const [id, timer] = entry;
    timers.delete(id);
    if (advanceAudio) context.currentTime = timer.time;
    timer.callback();
    await flush();
  }
  return { player: new exports.PreviewAudioPlayer(), context, starts, ends, timers, flush, tick };
}

function arrangement(...tracks) {
  const timing = { tempo: 120, beatsPerWholeNote: 4, beatsPerMeasure: 4 };
  return {
    ...timing,
    tracks: tracks.map((notes, index) => ({ ...timing, notes, name: `T${index + 1}`, program: 0, volume: 1 })),
  };
}

test("long multi-track playback keeps every onset within the rolling window", async () => {
  const h = harness();
  const notes = Array.from({ length: 600 }, (_, index) => ({ chord: [60, 64, 67], duration: 1, index }));
  let ended = 0;
  const playing = h.player.play(arrangement(notes, notes), () => ended++);
  await h.flush();
  for (let i = 0; ended === 0 && i < 5000; i++) await h.tick();
  assert.equal(ended, 1);
  await playing;
  assert.equal(h.starts.length, 3600);
  assert.equal(h.ends.length, 3600);
  for (const [index, start] of h.starts.entries()) {
    assert.ok(start.time - start.submittedAt <= 1, `onset ${index} was queued too early`);
    assert.ok(start.submittedAt <= start.time, `onset ${index} was queued late`);
    assert.equal(start.time, 10 + Math.floor(index / 6) * 2);
    assert.equal(h.ends[index].time, start.time + 2);
  }
  assert.equal(h.timers.size, 0);
});

test("long rests and a stationary audio clock do not allocate future voices", async () => {
  const h = harness();
  let ended = false;
  const playing = h.player.play(arrangement([
    { chord: "rest", duration: 60, index: 0 },
    { chord: [72], duration: 0.25, index: 1 },
  ]), () => { ended = true; });
  await h.flush();
  assert.equal(h.starts.length, 0);
  for (let i = 0; i < 10; i++) await h.tick(false);
  assert.equal(h.starts.length, 0);
  for (let i = 0; !ended && i < 300; i++) await h.tick();
  assert.equal(ended, true);
  await playing;
  assert.equal(h.starts.length, 1);
  assert.equal(h.starts[0].time, 130);
  assert.ok(h.starts[0].submittedAt >= 129);
});

test("restarting during a scheduling wait cancels the old notes and completion", async () => {
  const h = harness();
  let oldEnded = false;
  const oldPlay = h.player.play(arrangement([
    { chord: [60], duration: 60, index: 0 },
    { chord: [62], duration: 1, index: 1 },
  ]), () => { oldEnded = true; });
  await h.flush();
  assert.equal(h.starts.length, 1);
  let newEnded = false;
  const newPlay = h.player.play(arrangement([
    { chord: [72], duration: 0.25, index: 0 },
  ]), () => { newEnded = true; });
  await h.flush();
  await oldPlay;
  await h.tick();
  await newPlay;
  assert.equal(oldEnded, false);
  assert.equal(newEnded, true);
  assert.deepEqual(h.starts.map((start) => start.note), [60, 72]);
  assert.equal(h.timers.size, 0);
});
