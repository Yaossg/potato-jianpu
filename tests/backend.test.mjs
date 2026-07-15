import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { parse } from "../dist/parser/index.js";
import { PAGE_ORIENTATIONS, PAPER_PRESET_LIST, renderSvg, renderSvgPages, resolvePageSize } from "../dist/renderer/index.js";
import { exportMp3Bytes, exportWavBytes, renderPdfBytes, renderPngBytes } from "../dist/backend/index.js";

function pdfContentStreams(pdf) {
  const buffer = Buffer.from(pdf);
  const startMarker = Buffer.from("stream\n", "latin1");
  const endMarker = Buffer.from("\nendstream", "latin1");
  const streams = [];
  let offset = 0;
  while ((offset = buffer.indexOf(startMarker, offset)) !== -1) {
    const start = offset + startMarker.length;
    const end = buffer.indexOf(endMarker, start);
    if (end === -1) {
      break;
    }
    try {
      streams.push(inflateSync(buffer.subarray(start, end)).toString("latin1"));
    } catch {
      // Font streams are not Flate-compressed content streams.
    }
    offset = end + endMarker.length;
  }
  return streams.join("\n");
}

function pngDimensions(png) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= upDistance && leftDistance <= upperLeftDistance ? left : upDistance <= upperLeftDistance ? up : upperLeft;
}

function pngHasOnlyOpaquePixels(png) {
  const buffer = Buffer.from(png);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  assert.equal(buffer[24], 8, "PNG opacity test expects 8-bit channels");
  const colorType = buffer[25];
  if (colorType === 2) {
    return true;
  }
  assert.equal(colorType, 6, "PNG opacity test expects RGB or RGBA output");

  const idatChunks = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") {
      idatChunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  let rawOffset = 0;
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset++];
    const row = new Uint8Array(stride);
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[rawOffset++];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const prediction =
        filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paethPredictor(left, up, upperLeft);
      row[x] = (encoded + prediction) & 0xff;
    }
    for (let x = 3; x < stride; x += bytesPerPixel) {
      if (row[x] !== 0xff) {
        return false;
      }
    }
    previous = row;
  }
  return true;
}

function pdfMediaBoxes(pdf) {
  const text = Buffer.from(pdf).toString("latin1");
  return [...text.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/g)].map((match) => ({
    width: Number(match[1]),
    height: Number(match[2]),
  }));
}

test("renders SVG output to PNG bytes", () => {
  const result = parse(`title: "PNG"\n===\n1 2 3 4 | 5 - |`);
  assert.equal(result.ok, true);
  const png = renderPngBytes(renderSvg(result.value));
  assert.deepEqual([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(pngDimensions(png).width, 2000);
  assert.ok(png.length > 100);
});

test("renders deterministic opaque PNG output with bundled fonts", () => {
  const result = parse(`title: "茉莉花"\ncomposer: "中国民歌"\n===\n1(^) 2(v) 3(tr) 4 |`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 320, background: "rgba(255, 0, 0, 0.5)" });
  const png = renderPngBytes(svg);
  assert.deepEqual(pngDimensions(png), { width: 640, height: 340 });
  assert.equal(pngHasOnlyOpaquePixels(png), true);
  assert.equal(createHash("sha256").update(png).digest("hex"), "c461091d1a610a64726df7c3ecff744803863742c403bbf3eadeafa2fcbbcb66");
  assert.equal(pngHasOnlyOpaquePixels(renderPngBytes(renderSvg(result.value, { pageWidth: 320 }), { background: "rgba(255, 0, 0, 0.5)", scale: 1 })), true);
});

test("renders PNG output at an explicit scale", () => {
  const result = parse("1 2 3 4");
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 240 });
  assert.deepEqual(pngDimensions(renderPngBytes(svg, { scale: 1 })), { width: 240, height: 124 });
  assert.deepEqual(pngDimensions(renderPngBytes(svg, { scale: 3 })), { width: 720, height: 372 });
  assert.throws(() => renderPngBytes(svg, { scale: 0 }), /PNG scale must be a positive number/);
});

test("renders SVG pages to PDF bytes", async () => {
  const result = parse(`title: "PDF"\n===\n1 2 3 4 | 5 - |`);
  assert.equal(result.ok, true);
  const pdf = await renderPdfBytes(renderSvgPages(result.value), { title: result.value.header.title });
  assert.equal(String.fromCharCode(...pdf.slice(0, 4)), "%PDF");
  assert.ok(pdf.length > 100);
});

test("renders Unicode text to PDF with an embedded Unicode font", async () => {
  const result = parse(`title: "茉莉花"\ncomposer: "中国民歌"\n===\n1 2 3 4 | 5 - |\nL1: "茉 莉 花"`);
  assert.equal(result.ok, true);
  const pdf = await renderPdfBytes(renderSvgPages(result.value), { title: result.value.header.title });
  const text = Buffer.from(pdf).toString("latin1");
  assert.equal(String.fromCharCode(...pdf.slice(0, 4)), "%PDF");
  assert.match(text, /NotoSansSC/);
  assert.match(text, /\/ToUnicode\b/);
});

test("embeds Bravura for SMuFL ornament glyphs in PDF", async () => {
  const result = parse("1(^) 2(v)");
  assert.equal(result.ok, true);
  const pdf = await renderPdfBytes(renderSvgPages(result.value), { title: result.value.header.title });
  const text = Buffer.from(pdf).toString("latin1");
  assert.match(text, /Bravura/);
});

test("raises the PDF time signature fraction line", async () => {
  const result = parse(`time: 6/8\n===\n1 2 3`);
  assert.equal(result.ok, true);
  const pdf = await renderPdfBytes(renderSvgPages(result.value), { title: result.value.header.title });
  assert.match(pdfContentStreams(pdf), /\b86 33\.16 m\s+102 33\.16 l\b/);
});

test("renders paginated SVG pages to a multi-page PDF", async () => {
  const result = parse(`title: "PDF"\n===\n1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |`);
  assert.equal(result.ok, true);
  const pages = renderSvgPages(result.value, { pageWidth: 120, paginate: true, pageHeight: 160 });
  assert.ok(pages.length > 1);
  const pdf = await renderPdfBytes(pages);
  const text = Buffer.from(pdf).toString("latin1");
  assert.equal([...text.matchAll(/\/Type\s*\/Page\b/g)].length, pages.length);
});

test("renders paper preset dimensions consistently for SVG, PNG, and PDF", async () => {
  const result = parse("hidden: true\n===\n1 2 | 3 4 |\n---\n5 6 | 7 1' |");
  assert.equal(result.ok, true);

  for (const preset of PAPER_PRESET_LIST) {
    for (const orientation of PAGE_ORIENTATIONS) {
      const pageSize = resolvePageSize({ paper: preset.name, orientation });
      const pages = renderSvgPages(result.value, {
        pageWidth: pageSize.pageWidth,
        paginate: true,
        pageHeight: pageSize.pageHeight,
        background: "#ffffff",
      });
      assert.equal(pages.length, 2);
      assert.equal(pages[0].width, pageSize.pageWidth);
      assert.equal(pages[0].height, pageSize.pageHeight);
      assert.match(
        pages[0].svg,
        new RegExp(`<svg[^>]+width="${pageSize.pageWidth}" height="${pageSize.pageHeight}" viewBox="0 0 ${pageSize.pageWidth} ${pageSize.pageHeight}"`),
      );

      assert.deepEqual(pngDimensions(renderPngBytes(pages[0].svg, { scale: 1 })), {
        width: pageSize.pageWidth,
        height: pageSize.pageHeight,
      });

      assert.deepEqual(pdfMediaBoxes(await renderPdfBytes([pages[0]])), [{ width: pageSize.pageWidth, height: pageSize.pageHeight }]);
    }
  }
});

test("exports melody to WAV bytes", () => {
  const result = parse(`tempo: 120\n===\n1 2 3 4`);
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
  const result = parse(`tempo: 120\n===\n0 0 1 2`);
  assert.equal(result.ok, true);
  const withRests = exportWavBytes(result.value, { sampleRate: 8000 });
  const withoutRests = exportWavBytes(result.value, { sampleRate: 8000, omitInitialRests: true });
  assert.ok(withoutRests.length < withRests.length);
});

test("exports melody to MP3 bytes", () => {
  const result = parse(`tempo: 120\n===\n1 2 3 4`);
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
