import { RenderingAudioContext } from "@descript/web-audio-js";
import type { Document } from "../core/index.js";
import { arrangementDuration, compileArrangement, skipInitialArrangementRests, type Arrangement, type MelodyNote } from "../player/index.js";
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

const DEFAULT_VELOCITY = 64;
const DRUM_CHANNEL = 9;
const MELODIC_CHANNEL = 0;
const RENDER_TAIL_SECONDS = 0.25;

function secondsPerWholeNote(arrangement: Arrangement): number {
  return (60 / arrangement.tempo) * arrangement.beatsPerWholeNote;
}

function totalSeconds(arrangement: Arrangement): number {
  return arrangementDuration(arrangement) * secondsPerWholeNote(arrangement);
}

function scheduleTrack(synth: WebAudioTinySynth, notes: MelodyNote[], secondsPerWhole: number, channel: number) {
  const context = synth.getAudioContext();
  let currentTime = context.currentTime;

  for (const note of notes) {
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

function scheduleTinySynth(synth: WebAudioTinySynth, arrangement: Arrangement, program: number) {
  const secondsPerWhole = secondsPerWholeNote(arrangement);
  const channel = program >= 128 ? DRUM_CHANNEL : MELODIC_CHANNEL;
  for (const track of arrangement.tracks) {
    scheduleTrack(synth, track.notes, secondsPerWhole, channel);
  }
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
    voices: Math.max(64, arrangement.tracks.reduce((sum, track) => sum + track.notes.length, 0)),
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
  scheduleTinySynth(synth, arrangement, program);

  context.processTo(Math.max(0.01, totalSeconds(arrangement) + RENDER_TAIL_SECONDS));
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
