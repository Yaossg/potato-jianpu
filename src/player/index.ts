export {
  arrangementDuration,
  arrangementNoteCount,
  compileArrangement,
  compileMelody,
  skipInitialArrangementRests,
  skipInitialRests,
  trimArrangementAtNote,
} from "./melody.js";
export type { Arrangement, ArrangementTrack, Melody, MelodyNote } from "./melody.js";
export { exportMidiBytes } from "./midi.js";
export type { MidiExportOptions } from "./midi.js";
export { DRUM_PROGRAMS, GM_PROGRAMS } from "./programs.js";
export type { ProgramOption } from "./programs.js";
export {
  amplitudeEnvelope,
  midiToFrequency,
  SYNTH_ATTACK_SECONDS,
  SYNTH_BROWSER_GAIN,
  SYNTH_RELEASE_SECONDS,
  SYNTH_WAVEFORM,
  sampleWave,
  triangleWave,
  waveformForProgram,
} from "./synth.js";
export type { SynthWaveform } from "./synth.js";
