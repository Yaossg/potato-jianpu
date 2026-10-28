import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "../dist/parser/index.js";
import * as player from "../dist/player/index.js";
import * as soundfont from "../dist/player/soundfont.js";

import { exportWavBytes } from "../dist/backend/index.js";

const source = await readFile(new URL("../src/web/audio-export.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
const bank = new Uint8Array(await readFile(new URL("../assets/soundfonts/GeneralUser-GS.sf2", import.meta.url))).buffer;
const browserExports = {};
const require = createRequire(import.meta.url);
vm.runInNewContext(outputText, {
  exports: browserExports,
  performance,
  setTimeout,
  require(path) {
    if (path === "../player/index.js") return player;
    if (path === "../player/soundfont.js") return soundfont;
    if (path === "./soundfont.js") return { loadSoundfont: async () => bank };
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

test("browser and backend render identical sampled audio including drums and dynamics", async () => {
  const score = document('tempo: 120\ntime: 4/4\nT2.program: 40\nP1.program: 130\n===\nT1: p 1 2 f 3 4 |\nT2: 5 - - - |\nP1: X 0 X 0 |');
  const backend = exportWavBytes(score, { sampleRate: 8000 });
  const browser = await browserExports.exportBrowserWavBytes(score, { sampleRate: 8000 });
  assert.deepEqual(new Uint8Array(browser), backend);
});

test("sampled export preserves the release tail and honors mute", async () => {
  const score = document('tempo: 120\ntime: 4/4\nprogram: 40\n===\n1 - - - |');
  const wav = exportWavBytes(score, { sampleRate: 8000 });
  assert.equal((wav.length - 44) / 4, 4 * 8000);
  assert.ok(rms(wav, 2, 2.1, 8000) > 0);
  const muted = await browserExports.exportBrowserWavBytes(score, { sampleRate: 8000, amplitude: 0 });
  assert.ok(muted.slice(44).every((byte) => byte === 0));
});
