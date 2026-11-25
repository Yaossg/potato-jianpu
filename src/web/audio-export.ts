import { renderSoundfontBlocks } from "../player/soundfont.js";
import { PeakLimiter } from "../player/peak-limiter.js";
import { browserMasterGain } from "./volume.js";
import { loadSoundfont, type AudioLoadListener } from "./soundfont.js";
import type { Document } from "../core/index.js";
import { compileArrangement, skipInitialArrangementRests } from "../player/index.js";
import * as lamejs from "lamejs";
import BitStream from "lamejs/src/js/BitStream.js";
import Lame from "lamejs/src/js/Lame.js";
import MPEGMode from "lamejs/src/js/MPEGMode.js";

export interface BrowserAudioExportOptions {
  signal?: AbortSignal;
  onLoadStatus?: AudioLoadListener;
  sampleRate?: number;
  program?: number;
  amplitude?: number;
  omitInitialRests?: boolean;
}

export interface BrowserMp3ExportOptions extends BrowserAudioExportOptions {
  bitRate?: number;
}

interface RenderedAudio {
  sampleRate: number;
  channelCount: number;
  frames: number;
  pcm: Int16Array;
}

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_AMPLITUDE = 1;
const DEFAULT_BIT_RATE = 128;
const CHANNEL_COUNT = 2;
const BITS_PER_SAMPLE = 16;
const HEADER_SIZE = 44;
const MP3_FRAME_SAMPLES = 1152;

const lameGlobals = globalThis as { MPEGMode?: unknown; Lame?: unknown; BitStream?: unknown };
lameGlobals.MPEGMode = MPEGMode;
lameGlobals.Lame = Lame;
lameGlobals.BitStream = BitStream;

function normalizeAudioOptions(options: BrowserAudioExportOptions, label: string) {
  const sampleRate = Math.round(options.sampleRate ?? DEFAULT_SAMPLE_RATE);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`${label} sample rate must be a positive number.`);
  }

  const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 2) {
    throw new Error(`${label} amplitude must be at least 0 and no more than 2.`);
  }

  return {
    sampleRate,
    amplitude,
    program: options.program ?? 0,
  };
}

function normalizeBitRate(bitRate: number | undefined): number {
  const normalized = Math.round(bitRate ?? DEFAULT_BIT_RATE);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("MP3 bit rate must be a positive number.");
  }
  return normalized;
}

export async function renderDocumentPcm(document: Document, options: BrowserAudioExportOptions, label: string): Promise<RenderedAudio> {
  options.signal?.throwIfAborted();
  const { sampleRate, amplitude, program } = normalizeAudioOptions(options, label);
  const compiled = compileArrangement(document, program);
  const arrangement = options.omitInitialRests ? skipInitialArrangementRests(compiled) : compiled;
  let bank: ArrayBuffer;
  options.onLoadStatus?.({ phase: "preparing" });
  try {
    bank = await loadSoundfont((status) => options.onLoadStatus?.(status ?? { phase: "preparing" }));
  } finally {
    options.onLoadStatus?.(null);
  }
  options.signal?.throwIfAborted();
  const render = renderSoundfontBlocks(arrangement, bank, sampleRate, browserMasterGain(amplitude), new PeakLimiter(sampleRate));
  try {
    let result = render.next();
    let yieldedAt = performance.now();
    while (!result.done) {
      options.signal?.throwIfAborted();
      if (performance.now() - yieldedAt > 20) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        yieldedAt = performance.now();
      }
      result = render.next();
    }
    return result.value;
  } finally {
    render.return(undefined as never);
  }
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function writeUint16(bytes: Uint8Array, offset: number, value: number) {
  const view = new DataView(bytes.buffer);
  view.setUint16(offset, value, true);
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  const view = new DataView(bytes.buffer);
  view.setUint32(offset, value, true);
}

function writeInt16(bytes: Uint8Array, offset: number, value: number) {
  const view = new DataView(bytes.buffer);
  view.setInt16(offset, value, true);
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

export async function exportBrowserWavBytes(document: Document, options: BrowserAudioExportOptions = {}): Promise<Uint8Array> {
  const { pcm, sampleRate } = await renderDocumentPcm(document, options, "WAV");
  const dataBytes = pcm.length * 2;
  const bytes = new Uint8Array(HEADER_SIZE + dataBytes);

  writeAscii(bytes, 0, "RIFF");
  writeUint32(bytes, 4, bytes.length - 8);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  writeUint32(bytes, 16, 16);
  writeUint16(bytes, 20, 1);
  writeUint16(bytes, 22, CHANNEL_COUNT);
  writeUint32(bytes, 24, sampleRate);
  writeUint32(bytes, 28, sampleRate * CHANNEL_COUNT * (BITS_PER_SAMPLE / 8));
  writeUint16(bytes, 32, CHANNEL_COUNT * (BITS_PER_SAMPLE / 8));
  writeUint16(bytes, 34, BITS_PER_SAMPLE);
  writeAscii(bytes, 36, "data");
  writeUint32(bytes, 40, dataBytes);

  for (let index = 0; index < pcm.length; index += 1) {
    writeInt16(bytes, HEADER_SIZE + index * 2, pcm[index]!);
  }

  return bytes;
}

export async function exportBrowserMp3Bytes(document: Document, options: BrowserMp3ExportOptions = {}): Promise<Uint8Array> {
  const bitRate = normalizeBitRate(options.bitRate);
  const { pcm, frames, sampleRate, channelCount } = await renderDocumentPcm(document, options, "MP3");
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
