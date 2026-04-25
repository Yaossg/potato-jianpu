# Examples

These example scores are intended to exercise the current parser, renderer, and
MIDI exporter.

Try them with:

```sh
pnpm run cli -- validate examples/scale.jp
pnpm run cli -- export-svg examples/twinkle.jp -o twinkle.svg
pnpm run cli -- export-midi examples/twinkle.jp -o twinkle.mid
```

## Files

| File | Purpose |
| --- | --- |
| `scale.jp` | Minimal score-only notation and octave marks |
| `twinkle.jp` | Header metadata, compact notation, and dashes |
| `ode-to-joy.jp` | Key signature, dotted/slashed rhythm, multi-line score |
| `compound-6-8.jp` | Compound meter and dotted beat grouping |
| `accidentals-and-ties.jp` | Accidentals, naturals, ties across bars |
| `chords.jp` | Chord syntax, octave marks, and rests |
| `drums.jp` | Drum notes and short durations |

