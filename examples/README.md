# Examples

These example scores are intended to exercise the current parser, renderer,
player, and exporters. Every example should parse without warnings; the test
suite enforces that so examples remain clean fixtures rather than collections of
known-bad input.

Try them with:

```sh
pnpm run cli -- validate examples/scale.jp
pnpm run cli -- export-svg examples/twinkle.jp -o twinkle.svg
pnpm run cli -- export-midi examples/twinkle.jp -o twinkle.mid
pnpm run cli -- export-wav examples/twinkle.jp -o twinkle.wav
pnpm run cli -- export-mp3 examples/twinkle.jp -o twinkle.mp3
```

## Files

| File | Purpose |
| --- | --- |
| `scale.jp` | Small scale reference with explicit metadata and octave marks |
| `twinkle.jp` | Compact notation, dashes, and a traditional melody header |
| `ode-to-joy.jp` | Key signature, dotted/slashed rhythm, and multi-line score |
| `6-8-example.jp` | 6/8 example with 16th notes side by side |
| `drums.jp` | Drum-note syntax and short durations |
| `jingle-bells.jp` | Song example with dotted/slashed rhythms |
| `happy-birthday.jp` | 3/4 example with compact rests |
| `dear-little-wish.jp` | Long example with dense compact notation |
| `burning-field.jp` | Example with rests, ties, and octave marks |
| `blocky-heroes.jp` | Example with naturals and dense sixteenth notes |
| `shining-from-the-underground.jp` | Example with measure octave prefixes |
