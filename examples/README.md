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
| `sunny-skips.jpu` | Original cheerful flute and nylon guitar miniature in 2/4 with slurs and dotted rhythms |
| `epic-begin.jpu` | Original epic instrumental with horn, strings, repeating four-bar harmony, and a steady backbeat in A minor |
| `epic-end.jpu` | Reflective variation with oboe, harp arpeggios, and a half-time drum groove |
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
| `the-same-song.jpu` | Image transcription with two lyric verses, repeats, alternate endings, and slurs |
| `burning-dreams.jpu` | Image transcription in F major with Chinese lyrics, slurs, ties, and alternate endings |
| `endless-flow.jpu` | Song in A major with Chinese lyrics, grace notes, ties, and alternate endings |
| `vivalavida.jpu` | Complete 129-bar two-track transcription with chords, repeats, and cross-measure ties |

## Epic Instrumentals

`Epic Begin` and `Epic End` share a 48-bar arrangement: intro (4), theme (8),
build (4), chorus (8), breakdown (4), theme (8), final chorus (8), and outro (4).
The theme repeats Am–G–F–E; the chorus repeats Am–F–C–G, with Am–F–E–Am
closing the final chorus. Each chord lasts a full bar. The melody varies to fit
these cycles, while the accompaniment keeps a consistent pattern within each
section. Fills occur at section boundaries rather than after every four bars.

`Epic Begin` locks bass attacks to the kick drum, places the snare on beats 2
and 4, and uses an eighth-note hi-hat. `Epic End` keeps the harp arpeggio
pattern throughout and places the snare on beat 3 for a half-time feel.
Both arrangements reduce percussion in the intro, breakdown, and outro;
choir layers and denser accompaniment distinguish the choruses.
