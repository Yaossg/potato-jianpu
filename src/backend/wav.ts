import type { Document } from "../core/index.js";
import { BITS_PER_SAMPLE, CHANNEL_COUNT, renderDocumentPcm, type AudioRenderOptions } from "./audio.js";

export type WavExportOptions = AudioRenderOptions;

const HEADER_SIZE = 44;

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

export function exportWavBytes(document: Document, options: WavExportOptions = {}): Uint8Array {
  const { pcm, sampleRate } = renderDocumentPcm(document, options, "WAV");
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
