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

`skipInitialRests(melody)` removes leading rest events while preserving tempo,
time-signature metadata, and note indexes for the remaining events. The frontend
uses this for from-start playback when "Omit initial rests" is enabled. MIDI,
WAV, and MP3 export can also opt into the same behavior.

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

`PreviewAudioPlayer` in `src/web/audio.ts` uses the legacy
`WebAudioTinySynth` adapter in `src/player/webaudio-tinysynth.js`.

Behavior:

- lazily creates one `WebAudioTinySynth` instance
- resumes the synth-owned `AudioContext` for each play request
- stops any existing playback before starting a new one
- resets active synth voices before starting a new play request
- sets the selected melodic Program for programs `0..127`
- schedules note-on and note-off events for pitch/chord events
- uses WebAudioTinySynth percussion channel playback for drum programs
  `128..220`
- skips sound generation for rests
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

Browser playback velocity is currently fixed at MIDI velocity `64`. Volume is
applied through WebAudioTinySynth master volume.

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
- note velocity is fixed at `64`
- `amplitude` is applied as TinySynth master volume
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
jianpu export-mp3 input.jp -o output.mp3 --program 0 --sample-rate 44100 --amplitude 1 --bit-rate 128
```

The frontend exposes WAV and MP3 download through `src/web/audio-export.ts`.
Browser audio export uses the current Program, volume, and initial-rest settings
from the Settings panel. Browser MP3 uses the same `lamejs` encoder bundled into
the web build.

## Current Limitations

The current player/export layer is functional but not a full synthesizer:

- browser playback uses WebAudioTinySynth timbres rather than sampled
  instruments
- WAV and MP3 export use the same WebAudioTinySynth timbres through an offline
  context
- no velocity syntax
- no multi-track arrangement model

These limitations keep the rewrite focused while the core parser, renderer, and
export surfaces stabilize.
