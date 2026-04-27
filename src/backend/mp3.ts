import { createRequire } from "node:module";
import type { Document } from "../core/index.js";
import { CHANNEL_COUNT, renderDocumentPcm, type AudioRenderOptions } from "./audio.js";

export interface Mp3ExportOptions extends AudioRenderOptions {
  bitRate?: number;
}

interface LameMp3Encoder {
  encodeBuffer(left: Int16Array, right?: Int16Array): Uint8Array | number[];
  flush(): Uint8Array | number[];
}

interface LameJsModule {
  Mp3Encoder: new (channels: number, sampleRate: number, bitRate: number) => LameMp3Encoder;
}

const require = createRequire(import.meta.url);
// lamejs 1.2.1 has a few translated modules that reference package peers as
// globals. Seed them before loading the public encoder entry point.
const lameGlobals = globalThis as { MPEGMode?: unknown; Lame?: unknown; BitStream?: unknown };
lameGlobals.MPEGMode = require("lamejs/src/js/MPEGMode.js");
lameGlobals.Lame = require("lamejs/src/js/Lame.js");
lameGlobals.BitStream = require("lamejs/src/js/BitStream.js");
const lamejs = require("lamejs") as LameJsModule;
const DEFAULT_BIT_RATE = 128;
const MP3_FRAME_SAMPLES = 1152;

function normalizeBitRate(bitRate: number | undefined): number {
  const normalized = Math.round(bitRate ?? DEFAULT_BIT_RATE);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("MP3 bit rate must be a positive number.");
  }
  return normalized;
}

function appendChunk(chunks: Uint8Array[], chunk: Uint8Array | number[]) {
  if (chunk.length > 0) {
    chunks.push(chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk));
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function exportMp3Bytes(document: Document, options: Mp3ExportOptions = {}): Uint8Array {
  const bitRate = normalizeBitRate(options.bitRate);
  const { pcm, frames, sampleRate, channelCount } = renderDocumentPcm(document, options, "MP3");
  if (channelCount !== CHANNEL_COUNT) {
    throw new Error(`MP3 export requires ${CHANNEL_COUNT} channels.`);
  }

  const encoder = new lamejs.Mp3Encoder(CHANNEL_COUNT, sampleRate, bitRate);
  const chunks: Uint8Array[] = [];

  for (let start = 0; start < frames; start += MP3_FRAME_SAMPLES) {
    const frameCount = Math.min(MP3_FRAME_SAMPLES, frames - start);
    const left = new Int16Array(frameCount);
    const right = new Int16Array(frameCount);
    for (let index = 0; index < frameCount; index += 1) {
      const pcmIndex = (start + index) * CHANNEL_COUNT;
      left[index] = pcm[pcmIndex] ?? 0;
      right[index] = pcm[pcmIndex + 1] ?? 0;
    }
    appendChunk(chunks, encoder.encodeBuffer(left, right));
  }

  appendChunk(chunks, encoder.flush());
  return concatChunks(chunks);
}
