# Export Behavior

This document describes the export surfaces currently implemented by the backend
CLI and frontend application.

## Targets

The project has two product targets:

- Backend CLI: supports validation, parsing, SVG, PNG, PDF, MIDI, WAV, and MP3
  export.
- Frontend web app: supports editing, preview, playback, SVG export, PNG
  export, PDF export, MIDI export, WAV export, and MP3 export.

The backend and frontend use different adapters for binary exports. Backend PNG
uses `@resvg/resvg-js`, while frontend PNG uses SVG-to-canvas. Backend PDF uses
PDFKit with SVG-to-PDFKit, while frontend PDF uses jsPDF with svg2pdf.js.
Backend WAV/MP3 use a Node offline Web Audio adapter, while frontend WAV/MP3
use browser `OfflineAudioContext` and local JavaScript MP3 encoding.

## CLI Commands

Run commands through the package script during development:

```sh
pnpm run cli -- validate examples/twinkle.jpu
pnpm run cli -- --version
pnpm run cli -- validate examples/twinkle.jpu --json
pnpm run cli -- parse examples/twinkle.jpu --json
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --page-width 1000 --paginate --page-height 1400 --page-margin 40 --page-footer "modern-jianpu" --page-numbers --color "#111827" --background "#ffffff"
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --page-width 1000 --paginate --page-height 1400 --split-pages
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png --page-width 1000 --paginate --page-height 1400 --page-margin 40 --page-footer "modern-jianpu" --page-numbers --color "#111827" --background "#ffffff"
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png --page-width 1000 --paginate --page-height 1400 --split-pages
pnpm run cli -- export-pdf examples/twinkle.jpu -o twinkle.pdf --page-width 1000 --paginate --page-height 1400 --page-margin 40 --page-footer "modern-jianpu" --page-numbers --color "#111827" --background "#ffffff"
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
      "footer": "",
      "numbering": false,
      "paginate": false,
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

When present in the source header, score-level `program` and `volume` fields
also appear in the parsed header JSON.

Validate result shape:

```json
{
  "ok": true,
  "diagnostics": []
}
```

Fatal parse, validation, or export errors return exit code `1`. Usage errors,
such as a missing `-o`, invalid `--page-width`, invalid `--page-height`,
invalid `--page-margin`, invalid `--sample-rate`, or invalid `--program`,
return exit code `2`.

Unknown options and options missing their required value are rejected with exit
code `2`.

## SVG Export

SVG export uses the shared renderer:

```sh
pnpm run cli -- export-svg input.jpu -o output.svg --page-width 1000 --paginate --page-height 1400 --page-margin 40
pnpm run cli -- export-svg input.jpu -o output.svg --page-width 1000 --paginate --page-height 1400 --split-pages
```

Options:

- `--page-width <px>`: positive number. Defaults to the renderer default when
  omitted.
- `--paginate`: render one fixed-height multi-page SVG instead of the default
  adaptive-height SVG. When omitted, the renderer uses the parsed `paginate`
  header value.
- `--page-height <px>`: positive number. Defaults to `1400` when pagination is
  enabled. The value is validated even when `--paginate` is omitted, but it
  does not change non-paginated output by itself.
- `--page-margin <px>`: non-negative number. Defaults to `0`. The same margin
  is applied to all four sides of the page.
- `--page-footer <text>`: optional bottom-left page-level footer text. When
  omitted, the renderer uses the parsed `footer` header value.
- `--page-numbers`: renders centered page numbers as `current / total`. When
  omitted, the renderer uses the parsed `numbering` header value.
- `--color <css>`: CSS color used for `currentColor` SVG notation elements.
- `--background <css>`: CSS color used for SVG page background rectangles.
- `--split-pages`: write one SVG file per rendered page instead of one combined
  SVG file.

The renderer uses `pageWidth` for the SVG viewport width. Measures are wrapped
between measures when the next measure would exceed the content width, which is
`pageWidth` minus the left and right page margins. A single measure wider than
the content width is kept on its own line rather than split internally.

Paginated SVG export keeps one SVG file unless `--split-pages` is set. The root
height is the page height multiplied by the page count, each page is emitted as
a `.page` group, and the header appears only on the first page. When
`--page-margin` is non-zero, page content is shifted into a `.page-content`
group while backgrounds and page boundaries still use the full page size. Each
page also includes an exported `.page-boundary` rectangle so page edges are
visible in both SVG and PNG output. Optional pagination, page footer, and
page-number text can be set in the file header or CLI options. They render
inside the page groups, use the same export color as notation, and reserve
vertical content space so they do not overlap score content.

With `--split-pages`, `-o` is interpreted as an output stem. For example,
`-o score.svg` writes `score-01.svg`, `score-02.svg`, and so on. The page
number is zero-padded to at least two digits, or wider when the page count
requires it. Existing target files are not overwritten; if any generated page
path already exists, the command reports an export error before writing new
page files. Without pagination, split SVG export still writes one adaptive
page file.

## PNG Export

The backend CLI renders the same SVG output through the backend PNG adapter:

```sh
pnpm run cli -- export-png input.jpu -o output.png --page-width 1000 --paginate --page-height 1400 --page-margin 40
pnpm run cli -- export-png input.jpu -o output.png --page-width 1000 --paginate --page-height 1400 --split-pages
```

Options:

- `--page-width <px>`: same behavior as SVG export.
- `--paginate`: same behavior as SVG export.
- `--page-height <px>`: same behavior and validation as SVG export.
- `--page-margin <px>`: same behavior and validation as SVG export.
- `--page-footer <text>`: same behavior as SVG export.
- `--page-numbers`: same behavior as SVG export.
- `--color <css>`: same behavior as SVG export.
- `--background <css>`: sets both the SVG background rectangle and the PNG
  renderer background.
- `--split-pages`: write one PNG file per rendered page. `-o` uses the same
  stem, zero-padding, and no-overwrite behavior as split SVG export.

PNG export uses the backend dependency `@resvg/resvg-js`. Font behavior is
intended to match the SVG preview by using the same SVG text and style output.

The frontend also exposes PNG download. Browser PNG export uses a different
adapter: it turns the current SVG string into an SVG `Blob`, loads it into an
`Image`, draws that image to a canvas, and downloads the canvas result as
`jianpu-score.png`. It uses the same preview/export color, background, page
width, pagination, page height, and page margin settings as SVG download. When
Split pages is enabled in Export Settings, SVG and PNG downloads use the same
per-page naming pattern as CLI split output and trigger one browser download
per rendered page.

## PDF Export

PDF export uses the shared renderer's SVG page output and writes vector PDF
pages:

```sh
pnpm run cli -- export-pdf input.jpu -o output.pdf --page-width 1000 --paginate --page-height 1400 --page-margin 40
```

Options:

- `--page-width <px>`: same behavior as SVG export.
- `--paginate`: same behavior as SVG export.
- `--page-height <px>`: same behavior and validation as SVG export.
- `--page-margin <px>`: same behavior and validation as SVG export.
- `--page-footer <text>`: same behavior as SVG export.
- `--page-numbers`: same behavior as SVG export.
- `--color <css>`: same behavior as SVG export.
- `--background <css>`: same behavior as SVG export.

When pagination is enabled, each rendered SVG page becomes a separate PDF page
with the configured width and height. Without pagination, the adaptive-height
SVG render becomes one PDF page.

The backend CLI converts rendered SVG pages through PDFKit and SVG-to-PDFKit.
The frontend exposes PDF download through jsPDF and svg2pdf.js, using the same
preview/export color, background, page width, pagination, page height, page
margin, and justification settings as SVG and PNG download. Both PDF paths
embed Noto Sans SC for Unicode text such as Chinese titles, composer names, and
lyrics.

## MIDI Export

MIDI export compiles the parsed document through the shared arrangement
compiler:

```sh
pnpm run cli -- export-midi input.jpu -o output.mid --program 0
```

Options:

- `--program <number>`: integer from `0` to `174`; used as the default Program
  for tracks without `Tn.program` headers.
- `--omit-initial-rest`: remove leading rests before writing note events.

Program behavior, arrangement track grouping, track labels, per-track Program
and volume, drum mode, and MIDI channel assignment are described in
[docs/PLAYER.md](PLAYER.md).

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

The WAV renderer shares Program, per-track Program, drum-channel, and velocity
behavior with browser preview playback and MIDI export. See
[docs/PLAYER.md](PLAYER.md) for arrangement, Program, and volume behavior.

The WAV renderer uses `WebAudioTinySynth` with an offline
`RenderingAudioContext`, writes stereo 16-bit PCM output, and runs until the
longest arrangement track finishes plus a short render tail. `--amplitude` is
applied as TinySynth master volume, combined with the resolved track volume.

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

MP3 export shares the same backend TinySynth PCM render path as WAV export,
then encodes the stereo samples with `lamejs`. The default bit rate is
`128` kbps. See [docs/PLAYER.md](PLAYER.md) for arrangement, Program, and
volume behavior.

The frontend also exposes MP3 download. Browser MP3 export uses
`OfflineAudioContext` with the same TinySynth adapter as preview playback, then
encodes the rendered stereo PCM samples locally with `lamejs`. The frontend uses
the current Program, volume, and initial-rest settings.
