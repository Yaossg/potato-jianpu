import { RenderingAudioContext } from "@descript/web-audio-js";
import type { Document } from "../core/index.js";
import { arrangementDuration, compileArrangement, skipInitialArrangementRests, type Arrangement } from "../player/index.js";
import { AUDIO_RENDER_BLOCK_SIZE, audioRenderStepFrames, createOfflineSchedule } from "../player/offline-schedule.js";
import WebAudioTinySynth from "../player/webaudio-tinysynth.js";

export interface AudioRenderOptions {
  sampleRate?: number;
  program?: number;
  amplitude?: number;
  omitInitialRests?: boolean;
}

export interface RenderedPcm {
  sampleRate: number;
  channelCount: number;
  frames: number;
  pcm: Int16Array;
}

export const DEFAULT_SAMPLE_RATE = 44100;
export const DEFAULT_AMPLITUDE = 1;
export const CHANNEL_COUNT = 2;
export const BITS_PER_SAMPLE = 16;

const RENDER_TAIL_SECONDS = 0.25;

function secondsPerWholeNote(arrangement: Arrangement): number {
  return (60 / arrangement.tempo) * arrangement.beatsPerWholeNote;
}

function totalSeconds(arrangement: Arrangement): number {
  return arrangementDuration(arrangement) * secondsPerWholeNote(arrangement);
}

export function normalizeAudioOptions(options: AudioRenderOptions, label: string) {
  const sampleRate = Math.round(options.sampleRate ?? DEFAULT_SAMPLE_RATE);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`${label} sample rate must be a positive number.`);
  }

  const amplitude = options.amplitude ?? DEFAULT_AMPLITUDE;
  if (!Number.isFinite(amplitude) || amplitude <= 0 || amplitude > 1) {
    throw new Error(`${label} amplitude must be greater than 0 and no more than 1.`);
  }

  return {
    sampleRate,
    amplitude,
    program: options.program ?? 0,
  };
}

export function renderDocumentPcm(document: Document, options: AudioRenderOptions, label: string): RenderedPcm {
  const { sampleRate, amplitude, program } = normalizeAudioOptions(options, label);
  const compiled = compileArrangement(document, program);
  const arrangement = options.omitInitialRests ? skipInitialArrangementRests(compiled) : compiled;
  const synth = new WebAudioTinySynth({
    // Offline export must preserve every voice, including dense chords.
    // Windowed scheduling lets TinySynth reclaim finished voices as time advances.
    voices: Number.POSITIVE_INFINITY,
    internalcontext: false,
  });
  const context = new RenderingAudioContext({
    sampleRate,
    blockSize: AUDIO_RENDER_BLOCK_SIZE,
    numberOfChannels: CHANNEL_COUNT,
    bitDepth: BITS_PER_SAMPLE,
    floatingPoint: false,
  });
  synth.setAudioContext(context as unknown as AudioContext);
  synth.reset();
  synth.setMasterVol(amplitude);
  const scheduleUntil = createOfflineSchedule(synth, arrangement);
  const frames = Math.ceil(Math.max(0.01, totalSeconds(arrangement) + RENDER_TAIL_SECONDS) * sampleRate);
  const step = audioRenderStepFrames(sampleRate);
  for (let frame = 0; frame < frames; frame += step) {
    const endFrame = Math.min(frame + step, frames);
    // Include one extra quantum for processTo's floating-point block rounding.
    scheduleUntil((endFrame + AUDIO_RENDER_BLOCK_SIZE) / sampleRate);
    context.processTo(endFrame / sampleRate);
  }
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

  return {
    sampleRate,
    channelCount: audioData.numberOfChannels,
    frames: audioData.length,
    pcm,
  };
}
