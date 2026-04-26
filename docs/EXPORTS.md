# Export Behavior

This document describes the export surfaces currently implemented by the
reloaded backend CLI and frontend application.

## Targets

The rewrite has two product targets:

- Backend CLI: supports validation, parsing, SVG, PNG, MIDI, and WAV export.
- Frontend web app: supports editing, preview, playback, SVG export, and MIDI
  export.

PNG and WAV export are backend-only. The frontend intentionally does not expose
PNG, WAV, or MP3 export.

MP3 export is intentionally deferred from the current release target. WAV export
is the backend audio export for now and can be used as an intermediate if MP3
encoding is added later.

## CLI Commands

Run commands through the package script during development:

```sh
pnpm run cli -- validate examples/twinkle.jp
pnpm run cli -- --version
pnpm run cli -- validate examples/twinkle.jp --json
pnpm run cli -- parse examples/twinkle.jp --json
pnpm run cli -- export-svg examples/twinkle.jp -o twinkle.svg --page-width 1000 --color "#111827" --background "#ffffff"
pnpm run cli -- export-png examples/twinkle.jp -o twinkle.png --page-width 1000 --color "#111827" --background "#ffffff"
pnpm run cli -- export-midi examples/twinkle.jp -o twinkle.mid --program 0 --omit-initial-rest
pnpm run cli -- export-wav examples/twinkle.jp -o twinkle.wav --sample-rate 44100 --amplitude 0.24 --omit-initial-rest
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
    "header": {},
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
pnpm run cli -- export-svg input.jp -o output.svg --page-width 1000
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

PNG export renders the same SVG output through the backend PNG adapter:

```sh
pnpm run cli -- export-png input.jp -o output.png --page-width 1000
```

Options:

- `--page-width <px>`: same behavior as SVG export.
- `--color <css>`: same behavior as SVG export.
- `--background <css>`: sets both the SVG background rectangle and the PNG
  renderer background.

PNG export uses the backend dependency `@resvg/resvg-js`. Font behavior is
intended to match the SVG preview by using the same SVG text and style output.

## MIDI Export

MIDI export compiles the parsed document through the shared melody compiler:

```sh
pnpm run cli -- export-midi input.jp -o output.mid --program 0
```

Options:

- `--program <number>`: integer from `0` to `220`.
- `--omit-initial-rest`: remove leading rests before writing note events.

Program behavior:

- `0` to `127`: normal melodic MIDI program on channel 1.
- `128` to `220`: drum mode on MIDI channel 10. Drum note `X` maps to
  percussion note `program - 128 + 35`, so `128` maps to bass drum note `35`.

The MIDI writer emits:

- format 1 header
- meta track with tempo and time signature events
- music track with note on/off events

Rests advance delta time without emitting note events. Tied notes are merged by
the melody compiler before MIDI writing.

## WAV Export

WAV export uses the same melody compiler as MIDI export and writes a mono
16-bit PCM WAV file:

```sh
pnpm run cli -- export-wav input.jp -o output.wav --program 0 --sample-rate 44100 --amplitude 0.24
```

Options:

- `--program <number>`: same range and drum mapping as MIDI export.
- `--sample-rate <hz>`: positive number. Defaults to `44100`.
- `--amplitude <number>`: number greater than `0` and no more than `1`.
  Defaults to `0.24`.
- `--omit-initial-rest`: remove leading rests before rendering audio.

The current synthesizer is intentionally simple and deterministic:

- deterministic waveform per MIDI note, shared with browser preview playback
- chord notes mixed evenly
- short attack and release envelope
- rests render as silence
- mono 16-bit PCM output

This is a backend export feature, not a browser feature.
