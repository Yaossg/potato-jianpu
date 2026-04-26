export const SYNTH_ATTACK_SECONDS = 0.008;
export const SYNTH_RELEASE_SECONDS = 0.02;
export const SYNTH_BROWSER_GAIN = 0.12;
export const SYNTH_WAVEFORM = "triangle";

export function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export function amplitudeEnvelope(sampleOffset: number, sampleLength: number, sampleRate: number): number {
  const attackSamples = Math.max(1, Math.round(SYNTH_ATTACK_SECONDS * sampleRate));
  const releaseSamples = Math.max(1, Math.round(SYNTH_RELEASE_SECONDS * sampleRate));
  const attack = Math.min(1, sampleOffset / attackSamples);
  const release = Math.min(1, (sampleLength - sampleOffset) / releaseSamples);
  return Math.max(0, Math.min(attack, release));
}

export function triangleWave(phase: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(phase));
}
