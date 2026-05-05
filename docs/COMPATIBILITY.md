# Behavior Notes

This document records the supported behavior, validation rules, and intentional
format choices for Modern Jianpu Markup.

## Product Goals

Modern Jianpu Markup should:

- parse current example scores
- render recognizable Jianpu SVG
- support browser preview and playback
- export SVG, PNG, and MIDI
- provide backend PNG export
- keep compact notation convenient
- keep notation behavior explicit and documented

The examples in `examples/*.jp` are clean fixtures. The automated example test
parses each file, renders SVG/PNG, and exports MIDI/WAV. MP3 export is covered
by focused backend and CLI tests.

## Supported Syntax

Current supported syntax is documented in `public/grammar.html`.

Important supported features:

- optional header before `=`
- score-only documents
- compact notation such as `1155|665-|`
- comments beginning with `;`
- notes `1` to `7`
- rest `0`
- drum note `X`
- accidentals `#`, `##`, `b`, `bb`, `%`
- octave suffixes `'` and `,`
- measure-level octave prefixes
- chords with `{ ... }`
- duration suffixes with `-`, `/`, and `.`
- leading tie marker `~`
- optional leading and trailing bars

## Header Behavior

Supported semantic header fields:

- `title`
- `subtitle`
- `composer`
- `key`
- `time`
- `tempo`
- `hidden`

Unknown header fields are preserved in `header.raw` but have no behavior.

Defaults:

- key: `C`
- time: `4/4`
- tempo: `120`
- title/subtitle/composer/hidden: empty

Invalid key, time, or tempo values are parse errors.

## Validation Rules

### Ties

The parser validates ties before returning a successful parse.

These are errors:

- first note is tied
- tied note follows a rest
- tied note target does not match the previous sounding note
- tied pitch target differs after measure-local accidental persistence

### Empty Measures

Empty measures are parse errors:

```jianpu
1 2 || 3 4
```

### Header Mode

If an `=` appears later in the file, the parser treats earlier lines as header
lines. Malformed header lines before the separator are errors.

## Non-Fatal Conditions

### Empty Files

Empty files currently parse successfully as an empty score with default header
values.

### Measure Duration

Measure duration mismatches are warnings, not errors.

For example, this parses successfully but reports a warning in `4/4`:

```jianpu
1 2
```

The renderer and player still operate on the parsed notes.

## Renderer Behavior

The renderer returns deterministic SVG string output.

Notable behavior:

- bars are SVG line primitives rather than music-font bar glyphs
- final bar is a thin line plus a thick line
- tempo marks are character glyphs with symbol font fallback
- chords render as stacked text
- `pageWidth` wraps between measures
- active-note highlighting uses `data-note-index`
- color and background are explicit render/export options

Known limitations:

- no pagination
- no full collision avoidance
- no automatic splitting inside a measure

## Player Behavior

The player uses one shared melody compiler for browser playback, MIDI export,
WAV export, and MP3 export.

Supported behavior:

- key signature shifts pitch mapping
- accidentals persist within the current measure
- accidentals reset at measure boundaries
- ties merge durations
- rests produce time without pitch
- chords play/export simultaneous notes

Drum behavior:

- `X` in melodic mode maps to MIDI note `60`
- programs `128..220` enable drum mode
- drum mode maps `X` to `program - 128 + 35`
- MIDI drum mode uses channel 10 and omits program change

Browser playback and backend audio export both use the WebAudioTinySynth
implementation for lightweight Program and drum timbres. Browser playback uses
a real `AudioContext`; backend WAV/MP3 export uses an offline
`@descript/web-audio-js` rendering context. WAV writes the rendered samples into
a WAV container, while MP3 encodes the same rendered samples with `lamejs`.

## Export Differences

Backend CLI currently supports:

- SVG
- PNG
- MIDI
- WAV
- MP3

Frontend currently supports:

- SVG download
- PNG download through browser SVG-to-canvas rendering
- MIDI download
- WAV download through browser `OfflineAudioContext`
- MP3 download through browser `OfflineAudioContext` and bundled `lamejs`
- download filenames: `jianpu-score.svg`, `jianpu-score.png`,
  `jianpu-score.mid`, `jianpu-score.wav`, and `jianpu-score.mp3`
- light/dark theme toggle for the app and preview/export color presets, with
  saved preference and system dark-mode initialization
- Settings panel for automatic or manual page width, preview/export colors,
  Program, volume, browser audio sample rate, Program audition, and
  initial-rest omission
- volume uses a `0..200%` range and `100%` default
- empty initial source editor with an input placeholder
- Examples panel with focused two-column editor/preview workspace. Loading an
  example stops active playback and closes the panel. Play and Stop actions
  also close the examples panel.
- grammar reference page at `grammar.html`

## Dependencies And Packaging

The project uses:

- pnpm
- TypeScript
- Vite
- React
- Node's built-in test runner
- `@resvg/resvg-js` for backend PNG export

The parser is hand-written rather than generated through Nearley/Moo.

## Test Coverage

The current automated test suite covers:

- parser examples
- invalid header values
- ties
- measure duration warnings
- renderer output features
- PNG export
- MIDI export
- WAV export
- MP3 export
- CLI behavior
- all example files through parse, SVG, PNG, MIDI, and WAV paths

Additional golden SVG snapshots and browser-level UI smoke tests would further
improve confidence.
