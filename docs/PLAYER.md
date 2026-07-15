# Player Reference

This document describes the current playback and audio export behavior.

## Modules

Player-related code is split across shared player modules, frontend playback,
and backend export adapters:

```text
src/player/
  melody.ts   shared document-to-melody compiler
  midi.ts     MIDI writer
  synth.ts    shared lightweight synthesis constants and helpers
  webaudio-tinysynth.js

src/web/
  audio.ts    browser preview player
  audio-export.ts browser WAV/MP3 export adapter

src/backend/
  audio.ts    backend TinySynth offline PCM renderer
  wav.ts      backend WAV writer
  mp3.ts      backend MP3 encoder
```

The shared compiler is the common timing and pitch source for browser playback,
MIDI export, backend audio export, and browser audio export.

## Melody Model

`compileMelody(document, program?)` returns:

```ts
interface MelodyNote {
  chord: number[] | "rest";
  duration: number;
  index: number;
  velocity?: number;
  sustained?: number[];
}

interface Melody {
  notes: MelodyNote[];
  tempo: number;
  beatsPerMeasure: number;
  beatsPerWholeNote: number;
}
```

Durations are represented in whole-note units:

- quarter note: `0.25`
- eighth note: `0.125`
- half note: `0.5`
- whole note: `1`

`index` is the parsed note index from the core document. The frontend uses this
for playback highlighting.

`sustained` lists pitches that continue from the immediately preceding melody
event without a new attack. Ornament-expanded chords use it to hold unchanged
members while the highest sounding member moves. Playback and export resolve
these transitions through `melodyPitchSpans()`.

`compileMelody(document, program?)` keeps the legacy single-melody behavior and
flattens score lines in source order.

## Arrangement Model

`compileArrangement(document, program?)` returns simultaneous playback tracks:

```ts
interface ArrangementTrack extends Melody {
  name: string;
  program: number;
  volume: number;
}

interface Arrangement {
  tracks: ArrangementTrack[];
  tempo: number;
  beatsPerMeasure: number;
  beatsPerWholeNote: number;
}
```

If no score line has a track label, the arrangement contains one unnamed track
and matches `compileMelody()` timing. Melodic track labels are `T1:` through
`T9:` and `T11:` through `T16:`, each mapped to the corresponding MIDI channel.
`T10:` is reserved for MIDI channel 10 (the drum channel) and is not accepted as
a score-line label. Percussion track labels `P1:`, `P2:`, etc. write drum parts
that share MIDI channel 10, each with its own percussion Program. If any score
line has a track label, score lines are divided into voice groups:

- every group starts at `T1` and increases by track number
- a group may stop early, so `T1 T2 T3 T1 T2` is valid
- lines in the same group start together
- each later group starts after the previous group finishes
- repeated labels concatenate into the same arrangement track with rests inserted
  when that voice is absent from an earlier group
- unlabeled lines in a labeled score are treated as `T1`
- tracks may have different total durations; playback and export use the
  longest track duration

Orders such as `T1 T2 T2 T1`, `T1 T2 T2`, and `T1 T3` are errors.

The track label itself is not rendered in SVG. To render a visible line label,
define the same label in the header, for example `T1.name: "Melody"` or the
shorthand `T1: "Melody"`.

Header entries such as `T1.program: 40` or `T2.program: "Violin"` assign
melodic Programs to arrangement tracks. Numeric per-track Programs are limited
to `0..127`; quoted names resolve through the General MIDI Program list with
case-insensitive matching after trimming surrounding whitespace. A score with no
explicit `Tn:` line labels treats its single arrangement track as `T1` for
`T1.program` and `T1.name` lookup, while preserving the unnamed-track shape when
those headers are omitted. The `compileArrangement(document, program?)`
argument remains the default Program for tracks without an explicit
`Tn.program` header. `Tn.program` entries for tracks that do not appear in the
score body stay in the parsed header but do not create arrangement tracks.
Percussion tracks use `Pn.program` headers with the range `128..174`
(Percussion Program numbers). `Pn.name` and `Pn.volume` work the same way as
their T-track equivalents.

Header entries such as `T1.volume: 0.5` assign per-track volume multipliers for
playback and export. Values are limited to `0..2` or `0%..200%`; `1` and
`100%` are neutral. A score with no explicit `Tn:` line labels treats its single
arrangement track as `T1` for `T1.volume` lookup in the same way as
`T1.program`. Track volume combines with the browser master volume or audio
export amplitude; it does not override them. MIDI export applies it by scaling
note velocity.

The score-level `program` field can set the default Program for playback and
export. It accepts melodic Program names or numbers up to `174`, with
`128..174` enabling drum mode. The score-level `volume` field can set the
default track volume. Track-level `Tn.program` and `Tn.volume` override those
defaults rather than stacking on top of them.

Lyric lines such as `L1: "text"`, `L1: @"text"`, or a bare quoted lyric line
attach to the preceding score group for rendering only. They do not create
arrangement tracks and do not affect playback, MIDI, WAV, or MP3 timing. Header
entries such as `L1.name: "Verse"` or the shorthand `L1: "Verse"` only control
rendered lyric line names. Manual or automatically tokenized lyric syllables may
be visually aligned to main-voice notes by the renderer. Lyric alignment
placeholders such as `_` and `~` are also visual-only; neither syllable
alignment nor placeholders are part of playback or export scheduling.

Repeat barlines and repeated endings are expanded before navigation marks.
Navigation marks use `[Segno]` and `[Coda]` before measures, and `[Fine]`,
`[D.C.]`, `[D.S.]`, and `[To Coda]` after measures. `[D.C.]` jumps once to the
beginning of the expanded written timeline, and `[D.S.]` jumps once to
`[Segno]`. After that jump, `[Fine]` stops playback/export and `[To Coda]`
jumps once to `[Coda]`. If the jumped playback path does not encounter
`[Fine]` or `[To Coda]`, it continues to the written end.

For unlabeled scores, the single score stream controls navigation. For labeled
scores, navigation follows the primary `T1` timeline, including implicit `T1`
lines in labeled mode. Other simultaneous tracks follow the same group order.
Navigation marks written on non-primary tracks are visual-only and produce a
parser warning.

## Pitch Mapping

The base scale is C major:

```text
1  2  3  4  5  6  7
60 62 64 65 67 69 71
```

The document key signature is added as a semitone offset. For example, key `D`
adds `2`, so `1` becomes MIDI note `62`.

Each octave mark changes pitch by `12` MIDI semitones.

## Accidentals

Accidentals are applied during melody compilation.

If a pitch has an explicit accidental, it updates that scale degree for the
current measure. Later notes in the same measure inherit it.

Accidental state resets at every measure boundary.

Examples:

```jianpu
#4 4 | 4
```

The first two notes play as sharpened `4`; the note after the bar returns to the
key-signature pitch.

## Ornaments

Mordents, turns, trills, slides, and grace notes compile inside the written
duration of the anchor note.

Mordents use the first half of the written duration for a
main-neighbor-main figure, then sustain the anchor pitch for the remaining
duration. Upper mordents use the next scale degree; lower mordents use the
previous scale degree.

Turns use the first half of the written duration for four equal segments, then
sustain the anchor pitch for the remaining duration. A normal turn uses
upper-anchor-lower-anchor. An inverted turn uses lower-anchor-upper-anchor.

Trills alternate anchor-upper pairs across the full written duration. The
compiler targets one event per thirty-second note, uses an equal subdivision
that fills the duration exactly, and keeps at least one complete pair for
shorter notes. The `(tr)` and `(tr~)` spellings compile to identical events;
the long-trill extension is engraving-only.

Slides use the final quarter of the source note's written duration. The
compiler keeps the source pitch for the first three quarters, then walks by
equal chromatic semitone steps through the target pitch. The target note keeps
its own normal attack and duration after the slide finishes. Ascending and
descending slides use the same timing. A slide between notes at the same
sounding pitch is ignored with a parser warning, so it plays as an ordinary
source note.

Grace notes reserve one quarter of the written duration. Before-grace notes
use that time before the shortened anchor note; after-grace notes use it after
the shortened anchor. Multiple grace pitches split the grace duration evenly.

Auxiliary ornament pitches follow the current key signature and any active
accidental for that scale degree in the measure.

Mordents, turns, and trills may attach to a whole chord. The highest sounding
member receives the ornament while every other member sustains without a new
attack. Grace notes instead modify the onset of the whole chord: their sequence
reserves one quarter of the chord's written duration, so every chord member
shares the shortened remaining duration. Before-grace notes sound before that
shortened chord; after-grace notes sound after it. Slides remain limited to a
single-pitch source and target.

## Ties

The parser validates tie legality before successful playback/export:

- the first note cannot be tied
- a tied note must follow a sounding note
- a tied pitch note must match the previous sounding pitch or chord
- a tied drum note must follow a drum note

The melody compiler merges tied notes into the previous melody event by adding
the tied note duration.

Example:

```jianpu
1 ~1/
```

This compiles to one melody note with duration `3/8`.

## Rests

Rests compile to:

```ts
{ chord: "rest", duration, index }
```

MIDI export advances delta time without writing note events.

Browser playback, WAV export, and MP3 export render the duration as silence.

`skipInitialRests(melody)` removes leading rest events from a single melody
while preserving tempo, time-signature metadata, and note indexes for the
remaining events.

`skipInitialArrangementRests(arrangement)` removes the shared initial silence
before the first sounding track. Other tracks keep any remaining leading rests
after that shared trim. The frontend uses this for from-start playback when
"Omit initial rests" is enabled. MIDI, WAV, and MP3 export can also opt into the
same behavior.

## Chords

Pitch notes with multiple chord members compile to a MIDI note array:

```ts
{ chord: [60, 64, 67], duration, index }
```

Browser playback schedules note-on and note-off events for every MIDI note.

MIDI export emits note-on events for every chord note at the same logical start
time and note-off events after the shared duration.

WAV and MP3 export schedule the same note-on and note-off events into an
offline WebAudioTinySynth rendering context.

## Drum Mode

Drum notes use the `X` syntax.

Program behavior:

- `0` to `127`: normal melodic mode. Drum note `X` maps to MIDI note `60`.
- `128` to `174`: drum mode. Drum note `X` maps to percussion note
  `program - 128 + 35`.

Player APIs reject programs outside `0..174`.

In MIDI export, drum mode uses channel 10, which is zero-based channel `9` in
the MIDI bytes. Drum mode does not write a program-change event because
percussion instruments are selected by note number.

Examples:

| Program | Drum note `X` maps to |
| ---: | ---: |
| `128` | `35` |
| `129` | `36` |
| `174` | `127` |

The CLI rejects programs outside `0..174` before calling the player APIs.

### Percussion Tracks (P-labels)

Percussion track labels `P1:`, `P2:`, etc. create drum parts that share MIDI
channel 10. Each P-track can have its own Percussion Program (`Pn.program:
128..174`) so different tracks play different GM percussion sounds in the same
arrangement.

P-track programs default to `128` when omitted. Like T-tracks, `Pn.name` and
`Pn.volume` headers are supported. P-track labels do not participate in T-label
ordering — they can appear alongside T-tracks in any order.

Example:

```
P1.name: "Kick"    P1.program: 128
P2.name: "Snare"   P2.program: 130
P3.name: "Hi-Hat"  P3.program: 133
===
P1: X/ 0/ 0/ 0/ | X/ 0/ 0/ 0/ |
P2: 0/ 0/ X/ 0/ | 0/ 0/ X/ 0/ |
P3: X/ X/ X/ X/ | X/ X/ X/ X/ |
```

## Browser Preview Playback

`PreviewAudioPlayer` in `src/web/audio.ts` uses the
`WebAudioTinySynth` adapter in `src/player/webaudio-tinysynth.js`.

Behavior:

- lazily creates one `WebAudioTinySynth` instance
- resumes the synth-owned `AudioContext` for each play request
- stops any existing playback before starting a new one
- resets active synth voices before starting a new play request
- sets the selected melodic Program for programs `0..127`
- uses the score-level `program` header when present
- sets per-track melodic Programs when the score has `Tn.program` headers
- scales per-track note velocity when the score has `Tn.volume` headers
- schedules note-on and note-off events for pitch/chord events
- uses WebAudioTinySynth percussion channel playback for drum programs
  `128..174`
- skips sound generation for rests
- schedules note-start timers for frontend highlighting
- supports starting from a parsed note index
- schedules all arrangement tracks against the same audio clock

The frontend exposes a Settings panel with Default Program, volume, audition,
and initial-rest controls. Browser playback and MIDI download use the selected
Program as the default when the score omits `program`. The
browser UI presents it as a grouped selection list with General MIDI programs
and drum-note programs. Values `128..174` trigger the drum mapping described
above when no score-level or per-track melodic Program overrides that track.

The frontend also exposes playback volume as a `0..200%` slider with a `100%`
default. This controls browser preview master gain and combines with the
resolved score-level or per-track `volume` value. It does not alter the parsed
score or exported SVG.

The Audition button plays a short built-in phrase with the current Program and
volume. Melodic programs play a scale; drum programs play repeated `X` notes.

The frontend Settings panel also has an Export Settings section. Its audio
sample rate control applies only to browser WAV and MP3 downloads.

The frontend passes active note indexes back into `renderSvg()` so the SVG can
highlight simultaneous notes across arrangement tracks.

Clicking a rendered note starts playback from that note index.

Browser playback base velocity is currently `64`. The browser volume slider is
applied through WebAudioTinySynth master volume, and the resolved track volume
scales each track's note velocity.

Per-note dynamic markers (`ppp` through `fff`) set explicit MIDI-style
velocities. Gradual dynamic hairpins use paired `<` markers for crescendo and
paired `>` markers for diminuendo. For example, `p < 1 2 3 f < 4`
interpolates from `p` on `1` to `f` on `4`. The shared melody compiler
interpolates note velocities across the marked range. Explicit dynamic markers
at the hairpin start or end become the interpolation endpoints; when the ending
note has no explicit dynamic, the compiler applies a modest default rise or
fall from the starting velocity. When both endpoints have explicit dynamic
markers, the parser warns if a crescendo does not end louder than it starts or
a diminuendo does not end softer than it starts. Track volume and browser or
export master volume still scale the resulting per-note velocity.

Backend WAV and MP3 export use the same WebAudioTinySynth adapter with an
offline rendering context, so Program and drum timbres are aligned with browser
playback. Browser WAV and MP3 export use `OfflineAudioContext` with the same
adapter directly in the frontend.

## MIDI Export

`exportMidiBytes(document, program?, options?)` returns a `Uint8Array`.

Options:

```ts
interface MidiExportOptions {
  omitInitialRests?: boolean;
}
```

MIDI writer constants:

- format: `1`
- ticks per quarter note: `96`
- default velocity: `64`

For an unlabeled score, the writer creates two tracks:

1. Meta track
2. Music track

For labeled arrangements, the writer creates one music track per arrangement
track after the meta track.

The meta track contains:

- tempo meta event
- time-signature meta event
- end-of-track event

The music track contains:

- optional program change in melodic mode
- score-level Program default when present
- per-track melodic Program Change events when arrangement tracks have different
  Programs
- score-level or per-track note velocities from `volume`/`Tn.volume`
- per-note dynamic markers and interpolated hairpin velocities
- note-on events
- note-off events
- end-of-track event

Melodic arrangement tracks are assigned MIDI channels in order, skipping MIDI
channel 10. MIDI export rejects arrangements with more than 15 melodic tracks.
Drum mode uses MIDI channel 10 for every arrangement track.

Tempo bytes are computed from document tempo and denominator:

```text
microseconds per beat = (60000000 / tempo) * (beatsPerWholeNote / 4)
```

The time-signature meta event uses the parsed numerator and denominator. The
MIDI clocks-per-click byte is derived from `actualNotePerBeat()`.

## WAV Export

`exportWavBytes(document, options?)` returns a `Uint8Array`.

Options:

```ts
interface WavExportOptions {
  sampleRate?: number;
  program?: number;
  amplitude?: number;
  omitInitialRests?: boolean;
}
```

Defaults:

- sample rate: `44100`
- amplitude: `1`
- program: `0`

Output format:

- RIFF/WAVE
- stereo
- 16-bit PCM
- one data chunk

The WAV synthesizer uses WebAudioTinySynth offline:

- `@descript/web-audio-js` provides the backend `RenderingAudioContext`
- the shared melody compiler provides note timing and MIDI note numbers
- melodic programs `0..127` set TinySynth channel 1 Program
- drum programs `128..174` use TinySynth percussion channel 10 and the same
  percussion note mapping as MIDI export
- base note velocity is fixed at `64`
- per-note dynamic markers and hairpins set note velocity before resolved track
  volume scales it
- `amplitude` is applied as TinySynth master volume, so it combines with the
  resolved track volume
- rest events are silence

Invalid sample rates and amplitudes throw errors.

The CLI exposes WAV amplitude through `export-wav --amplitude`.

The CLI exposes initial-rest omission through `--omit-initial-rest` for MIDI,
WAV, and MP3 export.

## MP3 Export

`exportMp3Bytes(document, options?)` returns a `Uint8Array`.

Options:

```ts
interface Mp3ExportOptions {
  sampleRate?: number;
  program?: number;
  amplitude?: number;
  omitInitialRests?: boolean;
  bitRate?: number;
}
```

MP3 export shares the same backend TinySynth PCM render path as WAV export, then
encodes the stereo samples with `lamejs`. The default bit rate is `128` kbps.

The CLI exposes MP3 export as:

```sh
jianpu export-mp3 input.jpu -o output.mp3 --program 0 --sample-rate 44100 --amplitude 1 --bit-rate 128
```

The frontend exposes WAV and MP3 download through `src/web/audio-export.ts`.
Browser audio export uses the current Program, volume, and initial-rest settings
from the Settings panel unless the score header supplies its own `program` or
`volume` defaults. Browser MP3 uses the same `lamejs` encoder bundled into the
web build.
