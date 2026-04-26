import type { Document } from "../core/index.js";
import { compileMelody, type Melody } from "../player/index.js";

export interface WavExportOptions {
  sampleRate?: number;
  program?: number;
  amplitude?: number;
}

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_AMPLITUDE = 0.24;
const CHANNEL_COUNT = 1;
const BITS_PER_SAMPLE = 16;
const HEADER_SIZE = 44;
const RELEASE_SECONDS = 0.02;
const ATTACK_SECONDS = 0.008;

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function secondsPerWholeNote(melody: Melody): number {
  return (60 / melody.tempo) * melody.beatsPerWholeNote;
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

function envelope(sampleOffset: number, sampleLength: number, sampleRate: number): number {
  const attackSamples = Math.max(1, Math.round(ATTACK_SECONDS * sampleRate));
  const releaseSamples = Math.max(1, Math.round(RELEASE_SECONDS * sampleRate));
  const attack = Math.min(1, sampleOffset / attackSamples);
  const release = Math.min(1, (sampleLength - sampleOffset) / releaseSamples);
  return Math.max(0, Math.min(attack, release));
}

function renderPcm(melody: Melody, sampleRate: number, amplitude: number): Int16Array {
  const secondsPerWhole = secondsPerWholeNote(melody);
  const totalSeconds = melody.notes.reduce((sum, note) => sum + note.duration * secondsPerWhole, 0);
  const totalSamples = Math.max(1, Math.ceil(totalSeconds * sampleRate));
  const samples = new Float32Array(totalSamples);
  let cursor = 0;

  for (const note of melody.notes) {
    const sampleLength = Math.max(1, Math.round(note.duration * secondsPerWhole * sampleRate));
    if (note.chord !== "rest") {
      const frequencies = note.chord.map(midiToFrequency);
      for (let index = 0; index < sampleLength && cursor + index < samples.length; index += 1) {
        const time = index / sampleRate;
        const mixed = frequencies.reduce((sum, frequency) => sum + Math.sin(2 * Math.PI * frequency * time), 0) / frequencies.length;
        samples[cursor + index] += mixed * amplitude * envelope(index, sampleLength, sampleRate);
      }
    }
    cursor += sampleLength;
  }

  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]!));
    pcm[index] = Math.round(clamped * 32767);
  }
  return pcm;
}

export function exportWavBytes(document: Document, options: WavExportOptions = {}): Uint8Array {
  const sampleRate = Math.round(options.sampleRate ?? DEFAULT_SAMPLE_RATE);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("WAV sample rate must be a positive number.");
  }
  const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
  if (!Number.isFinite(amplitude) || amplitude <= 0 || amplitude > 1) {
    throw new Error("WAV amplitude must be greater than 0 and no more than 1.");
  }

  const melody = compileMelody(document, options.program ?? 0);
  const pcm = renderPcm(melody, sampleRate, amplitude);
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
