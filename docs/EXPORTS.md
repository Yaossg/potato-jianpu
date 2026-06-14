# Export Behavior

This document describes the export surfaces currently implemented by the backend
CLI and frontend application.

## Targets

The project has two product targets:

- Backend CLI: supports validation, parsing, SVG, PNG, MIDI, WAV, and MP3 export.
- Frontend web app: supports editing, preview, playback, SVG export, PNG
  export, MIDI export, WAV export, and MP3 export.

The backend and frontend use different adapters for binary exports. Backend PNG
uses `@resvg/resvg-js`, while frontend PNG uses SVG-to-canvas. Backend WAV/MP3
use a Node offline Web Audio adapter, while frontend WAV/MP3 use browser
`OfflineAudioContext` and local JavaScript MP3 encoding.

## CLI Commands

Run commands through the package script during development:

```sh
pnpm run cli -- validate examples/twinkle.jpu
pnpm run cli -- --version
pnpm run cli -- validate examples/twinkle.jpu --json
pnpm run cli -- parse examples/twinkle.jpu --json
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --page-width 1000 --color "#111827" --background "#ffffff"
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png --page-width 1000 --color "#111827" --background "#ffffff"
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid --program 0 --omit-initial-rest
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav --sample-rate 44100 --amplitude 1 --omit-initial-rest
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3 --sample-rate 44100 --amplitude 1 --bit-rate 128 --omit-initial-rest
```

The built package also exposes a `jianpu` binary mapped to
`dist/cli/main.js`.

## Diagnostics

Human-readable mode writes diagnostics to stderr:

- errors are prefixed with `error:`
- warnings are prefixed with `warning:`
- source locations are formatted as `line:column`

Machine-readable mode is available for `parse --json` and `validate --json`.
In JSON mode, diagnostics are emitted only in the JSON payload on stdout. This
keeps stderr clean for scripts.

Parse result shape:

```json
{
  "ok": true,
  "value": {
    "header": {
      "title": "",
      "subtitle": "",
      "composer": "",
      "keySignature": 0,
      "keySignatureText": "C",
      "timeSignature": {
        "beatsPerMeasure": 4,
        "beatsPerWholeNote": 4
      },
      "tempo": 120,
      "hidden": false,
      "trackNames": {},
      "trackPrograms": {},
      "trackVolumes": {},
      "lyricLabels": {}
    },
    "score": [],
    "diagnostics": []
  },
  "diagnostics": []
}
```

Validate result shape:

```json
{
  "ok": true,
  "diagnostics": []
}
```

Fatal parse or validation errors return exit code `1`. Usage errors, such as a
missing `-o`, invalid `--page-width`, invalid `--sample-rate`, or invalid
`--program`, return exit code `2`.

Unknown options and options missing their required value are rejected with exit
code `2`.

## SVG Export

SVG export uses the shared renderer:

```sh
pnpm run cli -- export-svg input.jpu -o output.svg --page-width 1000
```

Options:

- `--page-width <px>`: positive number. Defaults to the renderer default when
  omitted.
- `--color <css>`: CSS color used for `currentColor` SVG notation elements.
- `--background <css>`: CSS color used for an SVG background rectangle.

The renderer uses `pageWidth` for both the SVG viewport width and measure
wrapping. Measures are wrapped between measures when the next measure would
exceed the page width. A single measure wider than the page width is kept on its
own line rather than split internally.

## PNG Export

The backend CLI renders the same SVG output through the backend PNG adapter:

```sh
pnpm run cli -- export-png input.jpu -o output.png --page-width 1000
```

Options:

- `--page-width <px>`: same behavior as SVG export.
- `--color <css>`: same behavior as SVG export.
- `--background <css>`: sets both the SVG background rectangle and the PNG
  renderer background.

PNG export uses the backend dependency `@resvg/resvg-js`. Font behavior is
intended to match the SVG preview by using the same SVG text and style output.

The frontend also exposes PNG download. Browser PNG export uses a different
adapter: it turns the current SVG string into an SVG `Blob`, loads it into an
`Image`, draws that image to a canvas, and downloads the canvas result as
`jianpu-score.png`. It uses the same preview/export color, background, and page
width settings as SVG download.

## MIDI Export

MIDI export compiles the parsed document through the shared arrangement
compiler:

```sh
pnpm run cli -- export-midi input.jpu -o output.mid --program 0
```

Options:

- `--program <number>`: integer from `0` to `220`; used as the default Program
  for tracks without `Tn.program` headers.
- `--omit-initial-rest`: remove leading rests before writing note events.

Program behavior:

- `0` to `127`: normal melodic MIDI program.
- `128` to `220`: drum mode on MIDI channel 10. Drum note `X` maps to
  percussion note `program - 128 + 35`, so `128` maps to bass drum note `35`.
- `Tn.program` headers can override the default with melodic Programs `0..127`
  or quoted General MIDI Program names.

The MIDI writer emits:

- format 1 header
- meta track with tempo and time signature events
- one music track with note on/off events for unlabeled scores
- one music track per arrangement track for labeled scores

If any score line has a track label, that `Tn` label becomes the arrangement
track name. Score lines are divided into voice groups: every group starts at
`T1`, increases by track number, and may stop early. Lines in the same group
start together; each later group starts after the previous group finishes.
Unlabeled lines in a labeled score are treated as `T1`.
Header entries such as `T1.name: "Melody"` or the shorthand `T1: "Melody"` only
control rendered line names; they do not change MIDI track timing. Header
entries such as `T1.program: 24` or `T2.program: "Violin"` set per-track melodic
Programs for playback and export. Header entries such as `T1.volume: 0.5` set
per-track MIDI velocity multipliers from `0` to `2`; `1` is neutral, and values
above `1` are clamped to MIDI's maximum velocity after scaling. Labeled melodic
arrangement tracks use the MIDI channel named by their label, so `T1` uses MIDI
channel 1 and `T16` uses MIDI channel 16. `T10` is reserved for drums and is not
accepted as a melodic track label. Unlabeled melodic tracks use the next
available non-drum MIDI channel by export order. Drum mode uses channel 10 for
every arrangement track.

Rests advance delta time within their track without emitting note events. Tied
notes are merged by the arrangement compiler before MIDI writing.

## WAV Export

WAV export uses the same arrangement compiler as MIDI export and renders through
the same WebAudioTinySynth timbre engine used by browser preview playback. It
writes a stereo 16-bit PCM WAV file:

```sh
pnpm run cli -- export-wav input.jpu -o output.wav --program 0 --sample-rate 44100 --amplitude 1
```

Options:

- `--program <number>`: same range and drum mapping as MIDI export; used as the
  default Program for tracks without `Tn.program` headers.
- `--sample-rate <hz>`: positive number. Defaults to `44100`.
- `--amplitude <number>`: number greater than `0` and no more than `1`.
  Defaults to `1`.
- `--omit-initial-rest`: remove leading rests before rendering audio.

The WAV renderer:

- uses `WebAudioTinySynth` with an offline `RenderingAudioContext`
- schedules all arrangement tracks against the same offline audio clock
- uses the same Program, per-track Program, and drum-channel behavior as browser
  preview playback
- uses fixed base MIDI velocity `64`
- scales per-track note velocity with `Tn.volume`
- treats `--amplitude` as TinySynth master volume, applied together with
  per-track volume rather than replaced by it
- rests render as silence
- writes stereo 16-bit PCM output

Arrangement tracks may have different total durations. WAV rendering runs until
the longest track finishes, plus a short render tail.

The frontend also exposes WAV download. Browser WAV export uses
`OfflineAudioContext` with the same TinySynth adapter as preview playback, then
writes a RIFF/WAVE container locally in the browser. The frontend uses the
current Program, volume, and initial-rest settings.

## MP3 Export

MP3 export uses the same offline audio render path as WAV export, then encodes
the stereo PCM samples with `lamejs`:

```sh
pnpm run cli -- export-mp3 input.jpu -o output.mp3 --program 0 --sample-rate 44100 --amplitude 1 --bit-rate 128
```

Options:

- `--program <number>`: same range and drum mapping as MIDI and WAV export; used
  as the default Program for tracks without `Tn.program` headers.
- `--sample-rate <hz>`: positive number. Defaults to `44100`.
- `--amplitude <number>`: number greater than `0` and no more than `1`.
  Defaults to `1`.
- `--bit-rate <kbps>`: positive number. Defaults to `128`.
- `--omit-initial-rest`: remove leading rests before rendering audio.

The MP3 renderer:

- shares TinySynth scheduling, Program behavior, drum behavior, per-track
  volume, velocity, and rest handling with WAV export
- schedules all arrangement tracks against the same offline audio clock
- renders stereo PCM through the backend offline Web Audio context
- encodes the resulting samples as MP3 frames through `lamejs`

The frontend also exposes MP3 download. Browser MP3 export uses
`OfflineAudioContext` with the same TinySynth adapter as preview playback, then
encodes the rendered stereo PCM samples locally with `lamejs`. The frontend uses
the current Program, volume, and initial-rest settings.
