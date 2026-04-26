import type { Document } from "../core/index.js";
import { compileMelody, skipInitialRests, type Melody } from "../player/index.js";
import WebAudioTinySynth from "../player/webaudio-tinysynth.js";
import { RenderingAudioContext } from "@descript/web-audio-js";

export interface WavExportOptions {
  sampleRate?: number;
  program?: number;
  amplitude?: number;
  omitInitialRests?: boolean;
}

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_AMPLITUDE = 1;
const CHANNEL_COUNT = 2;
const BITS_PER_SAMPLE = 16;
const HEADER_SIZE = 44;
const DEFAULT_VELOCITY = 64;
const DRUM_CHANNEL = 9;
const MELODIC_CHANNEL = 0;
const RENDER_TAIL_SECONDS = 0.25;

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

function totalSeconds(melody: Melody): number {
  const secondsPerWhole = secondsPerWholeNote(melody);
  return melody.notes.reduce((sum, note) => sum + note.duration * secondsPerWhole, 0);
}

function scheduleTinySynth(synth: WebAudioTinySynth, melody: Melody, program: number) {
  const secondsPerWhole = secondsPerWholeNote(melody);
  const channel = program >= 128 ? DRUM_CHANNEL : MELODIC_CHANNEL;
  const context = synth.getAudioContext();
  let currentTime = context.currentTime;

  for (const note of melody.notes) {
    const duration = note.duration * secondsPerWhole;
    if (note.chord !== "rest") {
      for (const midiNote of note.chord) {
        synth.noteOn(channel, midiNote, DEFAULT_VELOCITY, currentTime);
        synth.noteOff(channel, midiNote, currentTime + duration);
      }
    }
    currentTime += duration;
  }
}

function renderPcm(melody: Melody, sampleRate: number, amplitude: number, program: number): Int16Array {
  const synth = new WebAudioTinySynth({
    voices: Math.max(64, melody.notes.length),
    internalcontext: false,
  });
  const context = new RenderingAudioContext({
    sampleRate,
    blockSize: 128,
    numberOfChannels: CHANNEL_COUNT,
    bitDepth: BITS_PER_SAMPLE,
    floatingPoint: false,
  });
  synth.setAudioContext(context as unknown as AudioContext);
  synth.reset();
  synth.setMasterVol(amplitude);
  if (program < 128) {
    synth.setProgram(MELODIC_CHANNEL, program);
  }
  scheduleTinySynth(synth, melody, program);

  context.processTo(Math.max(0.01, totalSeconds(melody) + RENDER_TAIL_SECONDS));
  const audioData = context.exportAsAudioData() as {
    channelData: Float32Array[];
    length: number;
    numberOfChannels: number;
  };
  const pcm = new Int16Array(audioData.length * audioData.numberOfChannels);

  for (let index = 0; index < audioData.length; index += 1) {
    for (let channel = 0; channel < audioData.numberOfChannels; channel += 1) {
      const sample = audioData.channelData[channel]?.[index] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      pcm[index * audioData.numberOfChannels + channel] = Math.round(clamped * 32767);
    }
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

  const program = options.program ?? 0;
  const compiled = compileMelody(document, program);
  const melody = options.omitInitialRests ? skipInitialRests(compiled) : compiled;
  const pcm = renderPcm(melody, sampleRate, amplitude, program);
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
