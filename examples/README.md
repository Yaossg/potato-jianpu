# Examples

These example scores are intended to exercise the current parser, renderer,
player, and exporters. Every example should parse without warnings; the test
suite enforces that so examples remain clean fixtures rather than collections of
known-bad input.

Try them with:

```sh
pnpm run cli -- validate examples/scale.jpu
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3
```

## Files

| File | Purpose |
| --- | --- |
| `scale.jpu` | Small scale reference with explicit metadata and octave marks |
| `twinkle.jpu` | Compact notation, dashes, and a traditional melody header |
| `ode-to-joy.jpu` | Key signature, dotted/slashed rhythm, and multi-line score |
| `6-8-example.jpu` | 6/8 example with 16th notes side by side |
| `drums.jpu` | Drum-note syntax and short durations |
| `jingle-bells.jpu` | Song example with dotted/slashed rhythms |
| `happy-birthday.jpu` | 3/4 example with compact rests |
| `edelweiss.jpu` | Two-track 3/4 song with aligned Chinese and English lyrics |
| `canon.jpu` | Multi-track arrangement with chords, repeats, and dense rhythm |
| `dear-little-wish.jpu` | Long example with dense compact notation |
| `burning-field.jpu` | Example with rests, ties, and octave marks |
| `blocky-heroes.jpu` | Example with naturals and dense sixteenth notes |
| `shining-from-the-underground.jpu` | Example with measure octave prefixes |
