# Player Reference

This document describes the current playback and audio export behavior in the
reloaded implementation.

## Modules

Player-related code is split across shared player modules, frontend playback,
and backend export adapters:

```text
src/player/
  melody.ts   shared document-to-melody compiler
  midi.ts     MIDI writer
  synth.ts    shared lightweight synthesis constants and helpers

src/web/
  audio.ts    browser preview player

src/backend/
  wav.ts      backend WAV writer
```

The shared compiler is the common timing and pitch source for browser playback,
MIDI export, and WAV export.

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

Browser playback and WAV export render the duration as silence.

`skipInitialRests(melody)` removes leading rest events while preserving tempo,
time-signature metadata, and note indexes for the remaining events. The frontend
uses this for from-start playback when "Omit initial rests" is enabled. MIDI and
WAV export can also opt into the same behavior.

## Chords

Pitch notes with multiple chord members compile to a MIDI note array:

```ts
{ chord: [60, 64, 67], duration, index }
```

Browser playback schedules one oscillator per MIDI note.

MIDI export emits note-on events for every chord note at the same logical start
time and note-off events after the shared duration.

WAV export mixes chord triangle waves evenly before applying amplitude and the
shared envelope.

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

`PreviewAudioPlayer` in `src/web/audio.ts` uses the Web Audio API.

Behavior:

- creates a new `AudioContext` for each play request
- stops any existing playback before starting a new one
- schedules triangle oscillators for pitch/chord events
- skips sound generation for rests
- uses exponential gain ramps for a short attack and release
- schedules note-start timers for frontend highlighting
- supports starting from a parsed note index

The frontend exposes a Settings panel with Program, volume, audition, and
initial-rest controls. Browser playback and MIDI download use the selected
Program. The browser UI presents it as a grouped selection list with General
MIDI programs and drum-note programs. Values `128..220` trigger the drum mapping
described above.

The frontend also exposes playback volume as a `0..200%` slider with a `100%`
default, matching the original settings UI. This controls browser preview gain
only; it does not alter the parsed score, MIDI note velocity, or exported SVG.

The Audition button plays a short built-in phrase with the current Program and
volume. Melodic programs play a scale; drum programs play repeated `X` notes.

The frontend passes the active note index back into `renderSvg()` so the SVG can
highlight the currently playing note.

Clicking a rendered note starts playback from that note index.

Browser playback and WAV export share the same basic synth constants from
`src/player/synth.ts`:

- default waveform: `triangle`
- attack: `0.008` seconds
- release: `0.02` seconds
- browser oscillator gain: `0.12`

Program values now choose a deterministic base waveform for browser playback and
WAV export:

| Program range | Waveform |
| --- | --- |
| `0..23`, `40..55`, `64..79`, `120..127` | `triangle` |
| `24..39`, `56..63` | `sawtooth` |
| `80..103`, `128..220` | `square` |
| `104..119` | `sine` |

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

The writer creates two tracks:

1. Meta track
2. Music track

The meta track contains:

- tempo meta event
- time-signature meta event
- end-of-track event

The music track contains:

- optional program change in melodic mode
- note-on events
- note-off events
- end-of-track event

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
- amplitude: `0.24`
- program: `0`

Output format:

- RIFF/WAVE
- mono
- 16-bit PCM
- one data chunk

The WAV synthesizer is intentionally simple and deterministic:

- deterministic waveform per MIDI note based on Program
- chord notes mixed evenly
- short attack of `0.008` seconds
- short release of `0.02` seconds
- rest events are silence

Invalid sample rates and amplitudes throw errors.

The CLI exposes WAV amplitude through `export-wav --amplitude`.

The CLI exposes initial-rest omission through `--omit-initial-rest` for MIDI and
WAV export.

## Current Limitations

The current player/export layer is functional but not a full synthesizer:

- no instrument synthesis for melodic MIDI programs in browser or WAV
- no velocity syntax
- no multi-track arrangement model
- no stereo output
- MP3 export is deferred from the current release target
- drum WAV output currently uses triangle waves at percussion MIDI note
  frequencies, not drum samples
- browser playback uses simple oscillators rather than a sampled instrument

These limitations keep the rewrite dependency-light and deterministic while the
core parser, renderer, and export surfaces stabilize.
