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
and matches `compileMelody()` timing. Track labels are `T1:` through `T9:` and
`T11:` through `T16:`. `T10:` is reserved for MIDI drums and is not accepted as
a melodic track label. If any score line has a track label, score lines are
divided into voice groups:

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
`T10.program` and drum Program values are still deferred with the drum-track
design.

Header entries such as `T1.volume: 0.5` assign per-track volume multipliers for
playback and export. Values are limited to `0..2`; `1` is neutral. A score with
no explicit `Tn:` line labels treats its single arrangement track as `T1` for
`T1.volume` lookup in the same way as `T1.program`. Track volume combines with
the browser master volume or audio export amplitude; it does not override them.
MIDI export applies it by scaling note velocity.

The score-level `program` field can set the default Program for playback and
export. It accepts melodic Program names or numbers up to `220`, with
`128..220` enabling drum mode. The score-level `volume` field can set the
default track volume. Track-level `Tn.program` and `Tn.volume` override those
defaults rather than stacking on top of them.

Lyric lines such as `L1: "text"` or a bare `"text"` line attach to the
preceding score group for rendering only. They do not create arrangement tracks
and do not affect playback, MIDI, WAV, or MP3 timing. Header entries such as
`L1.name: "Verse"` or the shorthand `L1: "Verse"` only control rendered lyric
line names. Whitespace-separated lyric syllables may be visually aligned to
main-voice notes by the renderer, but that alignment is not part of playback or
export scheduling.

Repeat barlines and repeated endings are expanded independently inside each
arrangement track.

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
- `128` to `220`: drum mode. Drum note `X` maps to percussion note
  `program - 128 + 35`.

Player APIs reject programs outside `0..220`.

In MIDI export, drum mode uses channel 10, which is zero-based channel `9` in
the MIDI bytes. Drum mode does not write a program-change event because
percussion instruments are selected by note number.

Examples:

| Program | Drum note `X` maps to |
| ---: | ---: |
| `128` | `35` |
| `129` | `36` |
| `220` | `127` |

The CLI rejects programs outside `0..220` before calling the player APIs.

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
  `128..220`
- skips sound generation for rests
- schedules note-start timers for frontend highlighting
- supports starting from a parsed note index
- schedules all arrangement tracks against the same audio clock

The frontend exposes a Settings panel with Default Program, volume, audition,
and initial-rest controls. Browser playback and MIDI download use the selected
Program as the default when the score omits `program`. The
browser UI presents it as a grouped selection list with General MIDI programs
and drum-note programs. Values `128..220` trigger the drum mapping described
above when no score-level or per-track melodic Program overrides that track.

The frontend also exposes playback volume as a `0..200%` slider with a `100%`
default. This controls browser preview master gain and combines with the
resolved score-level or per-track `volume` value. It does not alter the parsed
score or exported SVG.

The Audition button plays a short built-in phrase with the current Program and
volume. Melodic programs play a scale; drum programs play repeated `X` notes.

The frontend passes active note indexes back into `renderSvg()` so the SVG can
highlight simultaneous notes across arrangement tracks.

Clicking a rendered note starts playback from that note index.

Browser playback base velocity is currently `64`. The browser volume slider is
applied through WebAudioTinySynth master volume, and the resolved track volume
scales each track's note velocity.

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
- drum programs `128..220` use TinySynth percussion channel 10 and the same
  percussion note mapping as MIDI export
- base note velocity is fixed at `64`
- resolved track volume scales note velocity
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

## Current Limitations

The current player/export layer is functional but not a full synthesizer:

- browser playback uses WebAudioTinySynth timbres rather than sampled
  instruments
- WAV and MP3 export use the same WebAudioTinySynth timbres through an offline
  context
- no per-note velocity syntax
- no per-track pan or tempo syntax

These limitations keep the core parser, renderer, and export surfaces focused.
