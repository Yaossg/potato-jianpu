import type { Arrangement } from "../player/index.js";

/** A monotonic cursor over the same expanded arrangement used by audio export. */
export function createVideoTimeline(arrangement: Arrangement) {
  const secondsPerWhole = 60 / arrangement.tempo * arrangement.beatsPerWholeNote;
  const events = arrangement.tracks.flatMap(track => {
    let offset = 0;
    return track.notes.flatMap(note => {
      const start = offset * secondsPerWhole;
      offset += note.duration;
      return note.index < 0 ? [] : [
        { time: start, index: note.index, delta: 1 },
        { time: offset * secondsPerWhole, index: note.index, delta: -1 },
      ];
    });
  }).sort((a, b) => a.time - b.time || a.delta - b.delta);
  const active = new Map<number, number>();
  let cursor = 0;
  return (seconds: number): number[] => {
    while (cursor < events.length && events[cursor]!.time <= seconds + 1e-9) {
      const event = events[cursor++]!;
      const count = (active.get(event.index) ?? 0) + event.delta;
      if (count > 0) active.set(event.index, count);
      else active.delete(event.index);
    }
    return [...active.keys()].sort((a, b) => a - b);
  };
}

export interface VideoBounds { top: number; bottom: number }

/** Keep a stable viewport until the active notes leave it, including repeat jumps. */
export function followVideoNotes(previousTop: number, height: number, scoreHeight: number, bounds: VideoBounds[]) {
  if (!bounds.length) return previousTop;
  const top = Math.min(...bounds.map(b => b.top));
  const bottom = Math.max(...bounds.map(b => b.bottom));
  const padding = Math.min(40, height / 8);
  if (top >= previousTop + padding && bottom <= previousTop + height - padding) return previousTop;
  return Math.max(0, Math.min(top - padding, scoreHeight - height));
}

export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}
