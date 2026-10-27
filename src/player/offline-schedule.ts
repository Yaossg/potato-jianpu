import { melodyPitchSpans, type Arrangement } from "./melody.js";
import type WebAudioTinySynth from "./webaudio-tinysynth.js";

export const AUDIO_RENDER_BLOCK_SIZE = 128;

// Render half-second windows aligned to audio render quanta.
export function audioRenderStepFrames(sampleRate: number): number {
  return Math.ceil(sampleRate / 2 / AUDIO_RENDER_BLOCK_SIZE) * AUDIO_RENDER_BLOCK_SIZE;
}

export function createOfflineSchedule(synth: WebAudioTinySynth, arrangement: Arrangement) {
  const channels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  const secondsPerWhole = 60 / arrangement.tempo * arrangement.beatsPerWholeNote;
  let melodicChannelIndex = 0;
  const events = arrangement.tracks.flatMap((track) => {
    const channel = track.program >= 128 ? 9 : channels[melodicChannelIndex++];
    if (channel === undefined) {
      throw new Error(`Audio export supports at most ${channels.length} melodic tracks.`);
    }
    if (track.program < 128) synth.setProgram(channel, track.program);
    return melodyPitchSpans(track.notes).map((span) => ({
      channel,
      note: span.note,
      start: span.offset * secondsPerWhole,
      end: (span.offset + span.duration) * secondsPerWhole,
      velocity: Math.max(0, Math.min(127, Math.round((span.velocity ?? 64) * track.volume))),
    }));
  }).sort((a, b) => a.start - b.start || a.note - b.note);

  let cursor = 0;
  return (untilSeconds: number) => {
    while (cursor < events.length && events[cursor]!.start < untilSeconds) {
      const event = events[cursor++]!;
      synth.noteOn(event.channel, event.note, event.velocity, event.start);
      synth.noteOff(event.channel, event.note, event.end);
    }
  };
}
