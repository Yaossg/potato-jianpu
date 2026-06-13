import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";
import { renderSvg } from "../dist/renderer/index.js";
import { exportMp3Bytes, exportWavBytes, renderPngBytes } from "../dist/backend/index.js";

test("renders SVG output to PNG bytes", () => {
  const result = parse(`title: "PNG"\n=\n1 2 3 4 | 5 - |`);
  assert.equal(result.ok, true);
  const png = renderPngBytes(renderSvg(result.value));
  assert.deepEqual([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.length > 100);
});

test("exports melody to WAV bytes", () => {
  const result = parse(`tempo: 120\n=\n1 2 3 4`);
  assert.equal(result.ok, true);
  const wav = exportWavBytes(result.value, { sampleRate: 8000 });
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(String.fromCharCode(...wav.slice(36, 40)), "data");
  assert.equal(new DataView(wav.buffer, wav.byteOffset, wav.byteLength).getUint16(22, true), 2);
  assert.ok(wav.slice(44).some((byte) => byte !== 0));
  assert.ok(wav.length > 44);
});

test("WAV export can omit initial rests", () => {
  const result = parse(`tempo: 120\n=\n0 0 1 2`);
  assert.equal(result.ok, true);
  const withRests = exportWavBytes(result.value, { sampleRate: 8000 });
  const withoutRests = exportWavBytes(result.value, { sampleRate: 8000, omitInitialRests: true });
  assert.ok(withoutRests.length < withRests.length);
});

test("exports melody to MP3 bytes", () => {
  const result = parse(`tempo: 120\n=\n1 2 3 4`);
  assert.equal(result.ok, true);
  const mp3 = exportMp3Bytes(result.value, { sampleRate: 44100, bitRate: 64 });
  const syncOffset = mp3.findIndex((byte, index) => byte === 0xff && (mp3[index + 1] & 0xe0) === 0xe0);
  assert.ok(syncOffset >= 0);
  assert.ok(mp3.length > 100);
});

test("rejects invalid WAV export options", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  assert.throws(() => exportWavBytes(result.value, { sampleRate: 0 }), /sample rate must be a positive number/i);
  assert.throws(() => exportWavBytes(result.value, { amplitude: 2 }), /amplitude must be greater than 0/i);
});

test("rejects invalid MP3 export options", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  assert.throws(() => exportMp3Bytes(result.value, { bitRate: 0 }), /bit rate must be a positive number/i);
  assert.throws(() => exportMp3Bytes(result.value, { sampleRate: 0 }), /sample rate must be a positive number/i);
});
