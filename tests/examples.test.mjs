import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../dist/parser/index.js";
import { renderSvg } from "../dist/renderer/index.js";
import { exportMidiBytes } from "../dist/player/index.js";
import { exportWavBytes, renderPngBytes } from "../dist/backend/index.js";

const examplesDir = fileURLToPath(new URL("../examples/", import.meta.url));

test("all examples parse, render SVG, and export audio", async () => {
  const files = (await readdir(examplesDir)).filter((file) => file.endsWith(".jp"));
  assert.ok(files.length > 0);

  for (const file of files) {
    const source = await readFile(join(examplesDir, file), "utf8");
    const result = parse(source);
    assert.equal(result.ok, true, `${file} should parse: ${result.diagnostics.map((d) => d.message).join(", ")}`);
    assert.equal(result.diagnostics.length, 0, `${file} should be warning-free: ${result.diagnostics.map((d) => d.message).join(", ")}`);

    const svg = renderSvg(result.value);
    assert.match(svg, /<svg/);

    const png = renderPngBytes(svg);
    assert.deepEqual([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const midi = exportMidiBytes(result.value);
    assert.equal(String.fromCharCode(...midi.slice(0, 4)), "MThd");

    const wav = exportWavBytes(result.value, { sampleRate: 8000 });
    assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
    assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  }
});
