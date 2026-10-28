import { SoundBankLoader, SpessaLog, SpessaSynthProcessor } from "spessasynth_core";
import { arrangementDuration, melodyPitchSpans, type Arrangement } from "./melody.js";

// Keep CLI output and the browser console free of synthesizer diagnostics.
SpessaLog.setLogLevel(false, false, false);

export const AUDIO_TAIL_SECONDS = 2;
export const AUDIO_BLOCK_SIZE = 128;

/** Render uncompressed SF2 samples synchronously, without a Web Audio context. */
export function* renderSoundfontBlocks(arrangement: Arrangement, bank: ArrayBuffer, sampleRate: number, amplitude: number) {
  const synth = new SpessaSynthProcessor(sampleRate, { eventsEnabled: false });
  try {
    synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(bank), "main");
    synth.setSystemParameter("autoAllocateVoices", true);
    synth.setSystemParameter("gain", amplitude);
    const secondsPerWhole = 60 / arrangement.tempo * arrangement.beatsPerWholeNote;
    let melodicChannel = 0;
    const channels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
    const events = arrangement.tracks.flatMap((track) => {
      const channel = track.program >= 128 ? 9 : channels[melodicChannel++];
      if (channel === undefined) throw new Error("Audio supports at most 15 melodic tracks.");
      if (track.program < 128) synth.programChange(channel, track.program);
      return melodyPitchSpans(track.notes).flatMap((span) => {
        const velocity = Math.max(0, Math.min(127, Math.round((span.velocity ?? 64) * track.volume)));
        return [
          { frame: Math.round(span.offset * secondsPerWhole * sampleRate), on: true, channel, note: span.note, velocity },
          { frame: Math.round((span.offset + span.duration) * secondsPerWhole * sampleRate), on: false, channel, note: span.note, velocity },
        ];
      });
    }).sort((a, b) => a.frame - b.frame || Number(a.on) - Number(b.on));
    const frames = Math.ceil((arrangementDuration(arrangement) * secondsPerWhole + AUDIO_TAIL_SECONDS) * sampleRate);
    const pcm = new Int16Array(frames * 2);
    const left = new Float32Array(AUDIO_BLOCK_SIZE);
    const right = new Float32Array(AUDIO_BLOCK_SIZE);
    let cursor = 0;
    for (let frame = 0; frame < frames;) {
      while (cursor < events.length && events[cursor]!.frame <= frame) {
        const event = events[cursor++]!;
        if (event.on) synth.noteOn(event.channel, event.note, event.velocity);
        else synth.noteOff(event.channel, event.note);
      }
      const size = Math.min(AUDIO_BLOCK_SIZE, frames - frame, (events[cursor]?.frame ?? frames) - frame);
      left.fill(0);
      right.fill(0);
      synth.process(left, right, 0, size);
      for (let i = 0; i < size; i++) {
        pcm[(frame + i) * 2] = Math.round(Math.max(-1, Math.min(1, left[i]!)) * 32767);
        pcm[(frame + i) * 2 + 1] = Math.round(Math.max(-1, Math.min(1, right[i]!)) * 32767);
      }
      frame += size;
      yield frame;
    }
    return { sampleRate, channelCount: 2, frames, pcm };
  } finally {
    synth.destroy();
  }
}
