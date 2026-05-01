# Modern Jianpu Reloaded - Current Plan

This document describes the current state of Modern Jianpu Reloaded and the
remaining work. The project has a working backend CLI, frontend web app, parser,
renderer, player pipeline, exports, examples, tests, and documentation.

Use this file as the project roadmap. Historical implementation details belong
in git history and the focused docs under `docs/`.

## Product Decisions

The project targets two editions built from shared TypeScript source:

- Backend CLI edition
- Frontend browser edition

The backend CLI includes the full export surface:

- parse and validate Jianpu files
- export SVG
- export PNG
- export MIDI
- export WAV
- export MP3
- print diagnostics for humans and JSON diagnostics for scripts

The frontend browser edition includes:

- source editor
- SVG preview
- real-time playback
- note highlighting
- click-to-play-from-note
- SVG download
- PNG download
- MIDI download
- WAV download
- MP3 download
- examples
- settings
- grammar help
- diagnostics display

PNG, WAV, and MP3 export are available in both editions through target-specific
adapters. The backend uses Node-capable adapters; the frontend uses browser
SVG-to-canvas rendering for PNG, `OfflineAudioContext` for WAV/MP3 audio
rendering, and bundled `lamejs` for browser MP3 encoding.

Serverless deployment is not a target.

The parser is hand-written. Parser generation through Nearley/Moo is not part
of the architecture.

## Current Status

Status: usable project with remaining quality work.

Current validation command:

```sh
pnpm -C reloaded run test
```

Current known passing state:

- 79 tests pass.
- The test suite builds TypeScript before running Node tests.
- Coverage includes parser behavior, renderer snapshots, player timing, MIDI,
  backend PNG/WAV/MP3 export, examples, CLI behavior, release metadata, and a
  frontend production build smoke test covering SVG/PNG/MIDI/WAV/MP3 controls.
- The examples directory currently contains 11 curated `.jp` fixtures.
- Browser automation dependencies such as Playwright are intentionally not part
  of the current dependency set.

## Implemented

Core:

- Standalone nested git repository in `reloaded/`.
- pnpm package with TypeScript, Vite, React, Node test runner, and package
  metadata.
- Shared core document model for headers, score lines, measures, notes,
  durations, diagnostics, source spans, and time signatures.
- Public package entry points for core, parser, renderer, player, backend, and
  CLI binary output.

Parser:

- Hand-written tokenizer and parser.
- Optional header with `=` separator.
- Score-only documents.
- Empty document support.
- Header fields: `title`, `subtitle`, `composer`, `key`, `time`, `tempo`,
  `hidden`.
- Unknown header field preservation in raw metadata.
- Notes `1..7`, rest `0`, drum note `X`.
- Accidentals `#`, `##`, `b`, `bb`, `%`.
- Per-note octave suffixes and measure-level octave prefixes.
- Chords with `{ ... }`.
- Duration suffixes with dashes, slashes, and dots.
- Leading tie marker `~`.
- Compact notation with optional spaces.
- Comments beginning with `;`.
- Source ranges for diagnostics.
- Validation for invalid headers, empty measures, empty chords, non-pitch chord
  members, malformed compact notation, stray duration suffixes, unmatched chord
  braces, unterminated strings, unterminated chords, tie legality, and
  measure-duration warnings.
- Accidental-first key spelling coverage such as `#C` and `bB`.

Renderer:

- Deterministic SVG string renderer.
- Header, score, layout, metrics, dimensions, styles, XML helpers, and drawing
  helpers are separated in the renderer implementation.
- Header metadata rendering including hidden-header behavior.
- Notes, rests, drums, accidentals, octave dots, chords, duration dots,
  dashes, underlines, ties, regular bars, and final bars.
- Tempo marks rendered with stable character choices.
- Score line labels with reserved horizontal space.
- Active-note highlighting for frontend playback.
- Note metadata for click-to-play.
- Theme/export color and background options.
- `pageWidth`-based measure wrapping.
- Overwide visual line scaling to keep the score inside page width.
- Golden SVG snapshots for minimal score, full headers, hidden headers,
  notation features, and wrapped ties.

Player and audio:

- Shared melody compiler from parsed document to timed melody events.
- Key signature, accidentals, octave marks, rests, chords, ties, and drum notes
  compile into playback/export events.
- Initial-rest omission helper.
- Program validation for `0..220`.
- Melodic programs `0..127`.
- Drum programs `128..220`, mapping `X` to percussion note
  `program - 128 + 35`.
- MIDI export with format 1 header, meta track, tempo, time signature,
  melodic program changes, channel 10 drum handling, note on/off events, and
  deterministic bytes.
- Browser playback uses the `WebAudioTinySynth` adapter.
- Browser playback schedules TinySynth events incrementally instead of queuing
  an entire song at once.
- Browser playback stops when the source editor changes.
- Backend WAV export uses the same `WebAudioTinySynth` adapter with
  `@descript/web-audio-js` offline rendering, so WAV timbres align with browser
  Program and drum playback.
- Backend MP3 export shares the same offline TinySynth render path and encodes
  the resulting stereo PCM with `lamejs`.
- Backend WAV output is stereo 16-bit PCM; backend MP3 output is compressed
  audio.
- Frontend WAV/MP3 export uses the browser `OfflineAudioContext` with the same
  TinySynth adapter as preview playback. Browser MP3 is encoded locally with
  `lamejs`.
- Browser playback and exports use fixed MIDI velocity `64`.

Backend CLI:

- `validate`
- `parse`
- `export-svg`
- `export-png`
- `export-midi`
- `export-wav`
- `export-mp3`
- `--version`
- `--help`
- Human-readable diagnostics on stderr.
- JSON output for `parse --json` and `validate --json`.
- Usage errors return exit code `2`.
- Parse/export failures return exit code `1`.
- CLI validates options before reading input files where possible.
- Option handling covers missing values, unknown options, negative numeric
  values, page width, audio sample rate, WAV/MP3 amplitude, MP3 bit rate, and
  program range.

Frontend:

- React/Vite browser app.
- Empty initial editor content and editor placeholder text.
- Source editor with programming-font ligatures disabled.
- SVG preview with scrollable width management.
- Play and Stop controls.
- Note highlighting during playback.
- Click rendered notes to start playback from that note.
- SVG and MIDI downloads using the `jianpu-score.*` filenames.
- PNG download using browser SVG-to-canvas rendering and the
  `jianpu-score.png` filename.
- Theme toggle with saved preference and system dark-mode initialization.
- Preview/export color and background controls.
- Page width control shared by preview and SVG export.
- Settings panel with grouped Program selection, volume, audition, and
  initial-rest omission.
- Program list covers General MIDI and drum-note programs.
- Volume control uses the `0..200%` range and `100%` default.
- Examples panel with curated examples.
- Loading an example stops active playback and closes the panel.
- Play and Stop close the examples panel.
- Grammar button opens `public/grammar.html`, copied into the frontend build.
  That page contains a prose Reference section followed by a Railroad and EBNF
  appendix generated from `docs/grammar.ebnf`.
- Frontend production build smoke test confirms SVG/PNG/MIDI/WAV/MP3 controls
  and download filenames are present.

Examples:

- 11 example scores are available as `examples/*.jp` fixtures.
- Examples have consistent metadata headers and are expected to parse without
  warnings.
- The examples panel intentionally omits standalone Accidentals and Chords
  entries; those syntax features remain covered by parser and renderer tests.
- Examples are covered by parse, SVG, PNG, MIDI, and WAV test paths. MP3 export
  is covered by focused backend and CLI tests.

Documentation:

- `README.md`
- `docs/GRAMMAR.md`
- `docs/RENDERER.md`
- `docs/PLAYER.md`
- `docs/EXPORTS.md`
- `docs/ARCHITECTURE.md`
- `docs/COMPATIBILITY.md`
- `docs/RELEASE.md`

Packaging and release shape:

- Package metadata declares library entry points and CLI binary.
- Release file boundaries are documented.
- npm publishing is deferred while the package remains private.
- Package manager version is pinned in package metadata.

## Outside Current Scope

The following pieces are intentionally not part of the current target:

- Serverless and API deployment folders.
- Browser WAV sample-rate setting.
- Nearley/Moo parser generation and `plugins/nearleyc.js`.
- Generated Nearley `public/grammar.html` railroad diagram.

The grammar is maintained in `docs/GRAMMAR.md` and mirrored for users in the
frontend static `grammar.html` reference. Backend audio sample rate is available
through `export-wav --sample-rate` and `export-mp3 --sample-rate`.

## Remaining Work

High priority:

- Add focused renderer golden snapshots only when behavior changes or an
  uncovered behavior edge case is found. The current snapshot set already
  covers the main header, notation, wrapping, and tie cases.
- Improve parser diagnostics and recovery for additional malformed compact
  notation and header edge cases discovered during testing.
- Validate TinySynth WAV/MP3 output quality and performance on longer example
  scores in both backend and browser exporters.

Medium priority:

- Review frontend responsive layout manually in real browsers when UI structure
  changes.
- Keep `public/grammar.html`, `docs/GRAMMAR.md`, and `docs/grammar.ebnf`
  aligned when grammar behavior changes.
- Finalize distribution polish after the current CLI/frontend surfaces settle.

Lower priority improvements:

- Pagination or multi-page output.
- More sophisticated note-level horizontal re-spacing.
- Fuller collision avoidance for dense chords, ties, and metadata.
- Velocity syntax.
- Multi-track arrangements.
- Richer drum controls.
- Optional npm publication after package policy is decided.
- Optional favicon/static asset polish.
- Optional browser-level automation after the dependency policy changes.

## Browser Automation Policy

Playwright or another browser automation dependency is not being introduced for
now. The project currently favors lightweight Node tests plus Vite production
build smoke coverage. Real-browser checks remain useful, but they are manual for
the current phase to avoid adding browser installation, CI, and sandbox
complexity before the UI and release workflow settle.

If this policy changes later, the first browser smoke test should load the built
frontend, open an example, verify non-empty rendered SVG, click a rendered note,
and exercise the export menu without relying on audio perception.

## Current Architecture

```text
source text
  |
  v
parser/tokenizer
  |
  v
core Document
  |
  +--> renderer -> SVG string -> backend/browser PNG adapters
  |
  +--> melody compiler -> browser TinySynth playback / browser audio export
  |
  +--> melody compiler -> MIDI writer
  |
  +--> melody compiler -> backend TinySynth audio renderer -> WAV / MP3
```

Dependency direction:

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

Rules:

- Core stays platform-neutral.
- Parser does not import renderer, player, backend, CLI, or web code.
- Renderer does not parse source text and does not import backend code.
- Player owns melody/MIDI/shared synth-facing logic but not UI.
- Backend owns Node-capable PNG, WAV, and MP3 adapters.
- Web owns the browser PNG adapter.
- Web does not import backend modules.
- CLI coordinates modules but should keep business logic thin.

## Behavior Position

Modern Jianpu Reloaded aims for practical, documented Jianpu behavior rather
than byte-for-byte or pixel-for-pixel identity with any other implementation.

Supported behavior:

- Current examples parse and export.
- Compact notation remains supported.
- Header defaults and known semantic header fields are supported.
- Unknown header fields are preserved.
- Measure-local accidental persistence is implemented.
- Ties merge playback/export duration.
- Browser playback uses WebAudioTinySynth.
- Browser playback is chunk-scheduled and is cancelled by source edits.
- Program and drum controls are available in the frontend.
- Initial-rest omission is available.
- Frontend source/editor/settings/examples/grammar workflows are available in
  the current UI style.

Intentional choices:

- Parser is strict in several malformed cases.
- Tie legality is validated before successful parse.
- Empty measure syntax is rejected.
- Measure duration mismatch is a warning, not a fatal error.
- Renderer output is deterministic SVG strings.
- Bars are SVG primitives rather than music-font glyphs.
- PNG, WAV, and MP3 are available in both editions through different adapters.
- Serverless is outside the target architecture.

## Milestone Status

Milestone 0: project setup

- Status: complete.
- Notes: pnpm, TypeScript, package metadata, test/build scripts, docs skeleton,
  and nested repo are in place.

Milestone 1: core model and parser

- Status: complete for current grammar target.
- Remaining work: more diagnostic recovery for newly found malformed inputs.

Milestone 2: renderer

- Status: substantially complete for the current renderer target.
- Remaining work: edge-case snapshots, pagination, finer spacing, and collision
  avoidance.

Milestone 3: playback and MIDI

- Status: substantially complete for the current playback and MIDI target.
- Notes: browser playback uses TinySynth; MIDI export supports melodic and drum
  programs; note highlighting, click-to-play, chunked scheduling, and
  edit-to-stop behavior work.
- Remaining work: optional richer musical features.

Milestone 4: backend exports and UI polish

- Status: substantially complete.
- Notes: CLI SVG/PNG/MIDI/WAV/MP3 exports work; frontend exposes
  SVG/PNG/MIDI/WAV/MP3; settings/examples/theme/page-width workflows are
  present; grammar.html is organized as Reference first, Railroad/EBNF second.
- Remaining work: manual real-browser responsive and workflow checks.

Milestone 5: packaging and distribution

- Status: partially complete.
- Notes: package entry points, CLI binary, release file boundaries, and release
  docs exist.
- Remaining work: final distribution checks and optional publication policy.

## Test Strategy

Current test layers:

- parser unit tests
- renderer SVG tests and golden snapshots
- player melody/MIDI tests
- backend PNG/WAV/MP3 tests
- CLI integration tests
- examples test
- package metadata test
- frontend production build smoke test

Testing gaps:

- No real-browser UI automation by current policy.
- No automated audio perceptual comparison.
- No PNG golden image comparison.
- No real-browser assertion that WAV/MP3 downloads complete successfully yet;
  current coverage verifies the production bundle contains the controls and
  export code.

Preferred additions:

- Focused regression tests whenever a behavior bug is fixed.
- Additional renderer snapshots only for meaningful visual behavior, not for
  every fixture.
- Source-level or jsdom-light smoke checks for frontend behavior that can be
  verified without adding a browser automation dependency.

## Risks

Browser automation dependency:

- Browser automation remains intentionally deferred. Adding it would improve UI
  confidence but also adds installation, CI, and sandbox complexity.

TinySynth offline rendering performance:

- WAV and MP3 export use TinySynth timbres, and rendering long examples can be
  slow.

Renderer complexity:

- Dense chords, ties, labels, metadata, and wrapping can still overlap in edge
  cases. Current layout is practical but not full engraving.

Parser behavior:

- The hand-written parser is intentionally strict in malformed cases. Future
  behavior issues should be resolved with explicit tests and documentation.

Scope creep:

- Jianpu notation can grow indefinitely. The project should preserve current
  behavior first and add new notation features only when they have clear syntax,
  rendering, playback, and test plans.
