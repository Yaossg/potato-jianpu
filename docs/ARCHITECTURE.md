# Architecture

This document describes the current module boundaries in the reloaded
implementation.

## Product Targets

The repository builds two targets from shared TypeScript source:

- Backend CLI
- Frontend web app

The backend CLI provides parse, validate, SVG, PNG, MIDI, and WAV export.

The frontend web app provides editing, SVG preview, playback, note highlighting,
SVG download, MIDI download, examples, and diagnostics. It intentionally does
not expose PNG, WAV, or MP3 export.

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
  +--> renderer -> SVG string -> PNG adapter
  |
  +--> melody compiler -> browser playback
  |
  +--> melody compiler -> MIDI writer
  |
  +--> melody compiler -> WAV writer
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

Backend-only exports such as PNG and WAV are exported from `src/backend`.

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
- normalize header values
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

PNG export is not part of the renderer. PNG export is a backend adapter that
consumes the SVG string.

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

The melody compiler is shared by browser playback, MIDI export, and WAV export.

Browser playback itself lives in `src/web/audio.ts` because it depends on Web
Audio APIs.

WAV export lives in `src/backend/wav.ts` because it is a backend export feature.

## Backend

Location:

```text
src/backend/
```

Responsibilities:

- PNG export from SVG using `@resvg/resvg-js`
- WAV export from parsed document using the shared melody compiler

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
- MIDI download
- preview/export page width and theme controls

The frontend imports shared parser, renderer, and player code. It does not
import backend PNG or WAV modules.

## Tests

Location:

```text
tests/
```

The test suite uses Node's built-in test runner.

Current coverage areas:

- parser behavior and diagnostics
- renderer SVG behavior
- backend PNG and WAV export
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

- The renderer is still one large file rather than split into header, score,
  layout, and primitive modules.
- There is no formal theme object yet; dimensions and styles are internal.
- Melody timing and note events are still named `Melody`, not a richer
  `TimedNote` model.
- Browser playback lives outside `src/player`, so the player package is not yet
  a complete runtime playback abstraction.
- MP3 export is not implemented.

These are acceptable for the current rewrite stage but should guide later
refactors.
