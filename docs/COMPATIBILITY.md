# Compatibility Notes

This document records compatibility expectations and known differences between
the reloaded implementation and the original project.

The rewrite is intended to preserve useful existing behavior while making the
parser, renderer, player, and export boundaries explicit and testable.

## Compatibility Goals

The reloaded implementation should:

- parse current example scores
- render recognizable Jianpu SVG
- support browser preview and playback
- export SVG and MIDI
- provide backend PNG export
- keep compact notation convenient
- avoid intentional syntax breakage unless documented here

The legacy examples from the original frontend examples panel have been moved to
`examples/*.jp` fixtures. The automated example test parses each file, renders
SVG/PNG, and exports MIDI/WAV so these scores continue to act as compatibility
coverage.

## Supported Syntax

Current supported syntax is documented in `docs/GRAMMAR.md`.

Important preserved features:

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

## Header Compatibility

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

## Behavior That Is More Strict

### Ties

Reloaded validates ties before returning a successful parse.

These are errors:

- first note is tied
- tied note follows a rest
- tied note target does not match the previous sounding note
- tied pitch target differs after measure-local accidental persistence

This is stricter than treating ties as a rendering/playback hint only.

### Empty Measures

Empty measures are parse errors:

```jianpu
1 2 || 3 4
```

### Header Mode

If an `=` appears later in the file, the parser treats earlier lines as header
lines. Malformed header lines before the separator are errors.

## Behavior That Is More Lenient

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

## Renderer Differences

The reloaded renderer is deterministic SVG string output, not React element
output.

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

## Player Differences

The reloaded player uses one shared melody compiler for browser playback, MIDI
export, and WAV export.

Preserved behavior:

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

Browser playback uses the legacy WebAudioTinySynth implementation for
lightweight real-time Program and drum timbres. WAV export remains a simple
deterministic backend synthesizer; its Program setting selects a base waveform
and still does not attempt to emulate real instrument timbres.

## Export Differences

Backend CLI currently supports:

- SVG
- PNG
- MIDI
- WAV

Frontend currently supports:

- SVG download
- MIDI download
- original frontend download filename convention: `jianpu-score.svg` and
  `jianpu-score.mid`
- light/dark theme toggle for the app and preview/export color presets, with
  saved preference and system dark-mode initialization
- Settings panel for page width, preview/export colors, Program, volume,
  Program audition, and initial-rest omission
- volume uses the original `0..200%` frontend range and `100%` default
- empty initial source editor and placeholder text from the original frontend
- Examples panel with the migrated legacy examples and focused two-column
  editor/preview workspace. Loading an example stops active playback and closes
  the panel. Play and Stop actions also close the examples panel.
- grammar help panel backed by `docs/GRAMMAR.md`

Frontend intentionally does not support:

- PNG export
- WAV export
- MP3 export
- the old frontend sample-rate setting, because it only applied to browser WAV
  export. Use backend `export-wav --sample-rate` instead.

MP3 export is intentionally deferred from the current release target. WAV is the
current backend audio export.

## Dependency And Packaging Differences

Reloaded uses:

- pnpm
- TypeScript
- Vite
- React
- Node's built-in test runner
- `@resvg/resvg-js` for backend PNG export

The parser is hand-written rather than generated through Nearley/Moo.

## Compatibility Test Coverage

The current automated test suite covers:

- parser examples
- invalid header values
- ties
- measure duration warnings
- renderer output features
- PNG export
- MIDI export
- WAV export
- CLI behavior
- all example files through parse, SVG, PNG, MIDI, and WAV paths

Additional golden SVG snapshots and browser-level UI smoke tests would further
improve compatibility confidence.
