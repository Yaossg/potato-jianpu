import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as player from "../dist/player/index.js";
import * as renderer from "../dist/renderer/index.js";
import { parse } from "../dist/parser/index.js";

async function load(name, imports = {}, globals = {}) {
  const source = await readFile(new URL(`../src/web/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, setTimeout, performance, ...globals, require(path) {
    assert.ok(path in imports, `unexpected import ${path}`);
    return imports[path];
  } });
  return exports;
}
const timeline = await load("video-timeline");
function score(source) {
  const result = parse(source);
  assert.equal(result.ok, true);
  return result.value;
}

test("video highlights sustained simultaneous voices and clears them during the release tail", () => {
  const arrangement = player.compileArrangement(score("tempo: 120\n===\nT1: 1 - 2 - |\nT2: 3 4 5 6 |"));
  const at = timeline.createVideoTimeline(arrangement);
  const [first, second] = arrangement.tracks;
  assert.deepEqual([...at(0)], [first.notes[0].index, second.notes[0].index]);
  assert.deepEqual([...at(0.5)], [first.notes[0].index, second.notes[1].index]);
  assert.deepEqual([...at(1)], [first.notes[1].index, second.notes[2].index]);
  assert.deepEqual([...at(2)], []);
});

test("video follows expanded repeats, ornaments, and shared initial-rest trimming", () => {
  for (const source of ["tempo: 120\n===\n|: 1 2 3 4 :|", "tempo: 120\n===\n0 1(tr) 2 3 |"] ) {
    const arrangement = player.skipInitialArrangementRests(player.compileArrangement(score(source)));
    const at = timeline.createVideoTimeline(arrangement);
    let time = 0;
    for (const note of arrangement.tracks[0].notes) {
      assert.deepEqual([...at(time + 1e-6)], [note.index]);
      time += note.duration * 60 / arrangement.tempo * arrangement.beatsPerWholeNote;
    }
    assert.deepEqual([...at(time)], []);
  }
});

test("viewport follows forward and repeat-back jumps without moving for every note", () => {
  assert.equal(timeline.followVideoNotes(0, 450, 1600, [{ top: 100, bottom: 140 }]), 0);
  const next = timeline.followVideoNotes(0, 450, 1600, [{ top: 700, bottom: 740 }]);
  assert.equal(next, 660);
  assert.equal(timeline.followVideoNotes(next, 450, 1600, [{ top: 720, bottom: 760 }]), next);
  assert.equal(timeline.followVideoNotes(next, 450, 1600, [{ top: 100, bottom: 140 }]), 60);
  assert.equal(timeline.followVideoNotes(next, 450, 1600, []), next);
});

async function harness({ supported = ["avc", "aac"], cancelAtFrame, failFinalize = false } = {}) {
  const controller = new AbortController();
  const state = { video: [], audio: [], images: 0, disposed: 0, removed: 0, pcmCalls: 0, progress: [] };
  const root = {
    getAttribute: name => name === "width" ? "800" : "1200",
    setAttribute() {}, getBoundingClientRect: () => ({ width: 800, top: 0 }),
    querySelectorAll: () => [{
      getAttribute: () => "0", getBoundingClientRect: () => ({ top: 100, bottom: 130 }),
      classList: { add() {}, remove() {} },
    }],
  };
  const context = { fillRect() {}, drawImage() { state.images++; } };
  const modules = {
    mediabunny: {
      canEncodeVideo: async codec => supported.includes(codec),
      canEncodeAudio: async codec => supported.includes(codec),
      Quality: class {}, BufferTarget: class {}, Mp4OutputFormat: class {}, WebMOutputFormat: class {},
      Output: class {
        state = "pending";
        target = { buffer: new ArrayBuffer(1) };
        constructor() { state.output = this; }
        addVideoTrack() {} addAudioTrack() {}
        async start() { this.state = "started"; }
        async finalize() { if (failFinalize) throw Error("encoder failure"); this.state = "finalized"; }
        async cancel() { this.state = "canceled"; }
      },
      CanvasSource: class {
        async add(time, duration) {
          state.video.push({ time, duration });
          if (state.video.length === cancelAtFrame) controller.abort();
        }
        close() {}
      },
      AudioSampleSource: class { async add(sample) { state.audio.push(sample); } close() {} },
      AudioSample: class {
        constructor(init) { Object.assign(this, init); }
        close() { state.disposed++; }
      },
    },
    "../player/index.js": player,
    "../renderer/index.js": renderer,
    "./audio-export.js": { async renderDocumentPcm() {
      state.pcmCalls++;
      return { frames: 24001, sampleRate: 48000, pcm: new Int16Array(48002) };
    } },
    "./svg-fonts.js": { embedPngExportFonts: async text => text },
    "./video-timeline.js": timeline,
  };
  const exporter = await load("video-export", modules, {
    Blob, URL,
    Image: class { async decode() {} },
    DOMParser: class { parseFromString() { return { documentElement: root }; } },
    XMLSerializer: class { serializeToString() { return "<svg/>"; } },
    document: {
      fonts: { ready: Promise.resolve() }, body: { appendChild() {} },
      createElement: name => name === "canvas" ? { getContext: () => context } : {
        style: {}, setAttribute() {}, appendChild() {}, remove() { state.removed++; },
      },
    },
  });
  const run = () => exporter.exportBrowserVideo(score("1 2 3 4"), {
    signal: controller.signal, renderOptions: {},
    onProgress: phase => state.progress.push(phase),
  });
  return { run, state, exporter };
}

test("video chooses MP4 only when both encoders work, otherwise falls back to WebM", async () => {
  for (const [supported, expected] of [[ ["avc", "aac"], "mp4" ], [ ["avc", "vp9", "opus"], "webm" ]]) {
    const { run, state } = await harness({ supported });
    const result = await run();
    assert.equal(result.extension, expected);
    assert.equal(result.blob.type, `video/${expected}`);
    assert.equal(state.video.length, 16);
    assert.equal(state.video[0].time, 0);
    assert.equal(state.audio[0].timestamp, 0);
    const last = state.video.at(-1);
    assert.ok(Math.abs(last.time + last.duration - 24001 / 48000) < 1e-9);
    assert.equal(state.audio.reduce((sum, sample) => sum + sample.data.length / 2, 0), 24001);
    assert.equal(state.disposed, state.audio.length);
    assert.equal(state.output.state, "finalized");
    assert.equal(state.removed, 1);
    assert.ok(state.images < state.video.length, "unchanged notation reuses the last rasterized frame");
  }
});

test("unsupported video fails before loading the sound bank", async () => {
  const { run, state, exporter } = await harness({ supported: [] });
  await assert.rejects(run, exporter.VideoUnsupportedError);
  assert.equal(state.pcmCalls, 0);
});

test("cancel and encoder failure release the output without returning a download", async () => {
  for (const config of [{ cancelAtFrame: 2 }, { failFinalize: true }]) {
    const { run, state } = await harness(config);
    await assert.rejects(run);
    assert.equal(state.output.state, "canceled");
    assert.equal(state.removed, 1);
  }
});

test("aborting pending asset loading rejects promptly", async () => {
  const controller = new AbortController();
  const waiting = timeline.abortable(new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: "AbortError" });
});
