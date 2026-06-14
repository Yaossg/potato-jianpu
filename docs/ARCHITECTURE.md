# Architecture

This document describes the current module boundaries.

## Product Targets

The repository builds two targets from shared TypeScript source:

- Backend CLI
- Frontend web app

The backend CLI provides parse, validate, SVG, PNG, MIDI, WAV, and MP3 export.

The frontend web app provides editing, SVG preview, playback, note highlighting,
SVG download, PNG download, MIDI download, WAV download, MP3 download, examples,
and diagnostics.

## Data Flow

```text
source text
  |
  v
parser/tokenizer
  |
  v
core Document
  |
  +--> renderer -> SVG string -> PNG adapters
  |
  +--> arrangement compiler -> browser playback / browser audio export
  |
  +--> arrangement compiler -> MIDI writer
  |
  +--> arrangement compiler -> backend audio renderer -> WAV writer / MP3 encoder
```

The parser is the only module that understands source text. Renderer, player,
backend exporters, CLI, and web UI all consume parsed core models.

## Public Barrel

`src/index.ts` exports the shared public surface:

```ts
export * from "./core/index.js";
export * from "./parser/index.js";
export * from "./player/index.js";
export * from "./renderer/index.js";
```

Backend-only exports such as WAV and MP3 are exported from `src/backend`.

## Core

Location:

```text
src/core/
```

Responsibilities:

- source ranges and diagnostics
- result type
- document model
- header model
- shared General MIDI Program option data and melodic Program name resolution
- score line, measure, note, pitch, and duration models
- time signature helper functions

Core has no dependency on React, DOM, Web Audio, filesystem APIs, CLI APIs, or
backend rendering libraries.

Important exported helpers:

- `actualBeatsPerMeasure(time)`
- `actualNotePerBeat(time)`

## Parser

Location:

```text
src/parser/
```

Responsibilities:

- tokenize source text
- parse optional header and score notation
- parse closed typed header properties
- parse score-level default Program/volume and per-track melodic Program/volume header properties
- validate tie semantics
- warn on measure duration mismatches
- preserve source ranges for diagnostics

The parser is hand-written. It returns:

```ts
Result<Document>
```

If diagnostics contain any errors, `ok` is `false`. Warnings do not make parsing
fail.

The parser does not render, play, export, or access the filesystem.

## Renderer

Location:

```text
src/renderer/
```

Responsibilities:

- accept parsed `Document`
- measure notes and measures
- wrap measures according to `pageWidth`
- render header and score as a deterministic SVG string
- attach note metadata for frontend interaction
- apply active-note highlighting
- support export color/background options

The renderer does not parse source text and does not use browser-only APIs.

PNG export is not part of the renderer. Backend PNG export uses a Node-capable
adapter that consumes the SVG string. Frontend PNG export uses a browser adapter
that loads the SVG string into an image and draws it to canvas.

## Player

Location:

```text
src/player/
```

Responsibilities:

- compile `Document` into `Melody`
- map pitches, key signatures, accidentals, octave marks, rests, chords, ties,
  and drum notes
- export MIDI bytes from the shared melody model

The melody compiler is shared by browser playback, MIDI export, WAV export, and
MP3 export.

Browser playback itself lives in `src/web/audio.ts` and uses the shared
`src/player/webaudio-tinysynth.js` adapter.

Backend WAV and MP3 export live in `src/backend`. They share a TinySynth offline
render path built on `@descript/web-audio-js`; WAV writes the PCM samples
directly, while MP3 encodes them with `lamejs`.

## Backend

Location:

```text
src/backend/
```

Responsibilities:

- PNG export from SVG using `@resvg/resvg-js`
- WAV and MP3 export from parsed document using the shared melody compiler

Backend modules may use Node-capable dependencies and binary export formats.
They should not be imported into the frontend bundle.

## CLI

Location:

```text
src/cli/main.ts
```

Responsibilities:

- read input files
- call parser
- print diagnostics
- write output files
- expose scriptable commands

Implemented commands:

- `validate`
- `parse`
- `export-svg`
- `export-png`
- `export-midi`
- `export-wav`
- `export-mp3`

The CLI returns:

- `0` for success
- `1` for parse/validation/export failure
- `2` for usage errors

`parse --json` and `validate --json` provide machine-readable diagnostics on
stdout without human-readable stderr diagnostics.

## Frontend

Location:

```text
src/web/
```

Responsibilities:

- editor
- examples
- diagnostics display
- SVG preview
- playback controls
- note highlighting
- click-to-play-from-note
- SVG download
- PNG download
- MIDI download
- WAV download
- MP3 download
- preview/export page width and theme controls

The frontend imports shared parser, renderer, and player code. It does not
import backend PNG, WAV, or MP3 modules. Browser PNG and audio export adapters
stay in `src/web` and use DOM canvas APIs, `OfflineAudioContext`, and browser
bundled encoders.

## Tests

Location:

```text
tests/
```

The test suite uses Node's built-in test runner.

Current coverage areas:

- parser behavior and diagnostics
- renderer SVG behavior
- backend PNG, WAV, and MP3 export
- CLI behavior
- all examples parsing and exporting
- melody compiler behavior
- MIDI header, tempo, time signature, and drum behavior

The package `test` script builds TypeScript before running tests:

```sh
pnpm run test
```

## Dependency Rules

Preferred dependency direction:

```text
core
  ^
parser
renderer
player
  ^
backend
cli
web
```

Practical rules:

- Core must stay dependency-light and platform-neutral.
- Parser must not import renderer, player, backend, CLI, or web modules.
- Renderer must not import parser or backend modules.
- Player must not import renderer, backend, CLI, or web modules.
- Backend may import renderer/player/core/parser-adjacent public APIs when
  needed by export adapters.
- Web must not import backend modules.
- CLI coordinates modules but should keep logic thin.

## Current Known Architecture Debt

- The renderer is split into focused modules, but note-level spacing and
  collision handling still have room to grow for dense notation.
- There is no formal theme object yet; dimensions and styles are internal.
- Melody timing and note events are still named `Melody`, not a richer
  `TimedNote` model.
- Browser playback lives outside `src/player`, so the player package is not yet
  a complete runtime playback abstraction.
- Backend audio export now has a shared render helper, but the WAV and MP3
  writers still own format-specific byte generation directly.

These are acceptable for the current development stage but should guide later
refactors.
