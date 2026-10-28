import { readFileSync } from "node:fs";
import { renderSoundfontBlocks } from "../player/soundfont.js";
import type { Document } from "../core/index.js";
import { compileArrangement, skipInitialArrangementRests } from "../player/index.js";

let soundfont: Buffer | undefined;

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
  soundfont ??= readFileSync(new URL("../../assets/soundfonts/GeneralUser-GS.sf2", import.meta.url));
  const bank = new Uint8Array(soundfont).buffer;
  const render = renderSoundfontBlocks(arrangement, bank, sampleRate, amplitude);
  let result = render.next();
  while (!result.done) result = render.next();
  return result.value;
}
