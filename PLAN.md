# Modern Jianpu Reloaded - Current Plan

This document describes the current state of the `reloaded/` rewrite and the
remaining work. It is no longer a pre-implementation proposal. The rewrite has a
working backend CLI, frontend web app, parser, renderer, player pipeline,
exports, examples, tests, and documentation.

Use this file as the project roadmap. Historical implementation details belong
in git history and the focused docs under `docs/`.

## Product Decisions

The rewrite targets two editions built from shared TypeScript source:

- Backend CLI edition
- Frontend browser edition

The backend CLI includes the full export surface:

- parse and validate Jianpu files
- export SVG
- export PNG
- export MIDI
- export WAV
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
- examples
- settings
- grammar help
- diagnostics display

Frontend WAV and MP3 export are intentionally out of scope. PNG export is
available in both editions: the backend uses a Node-capable adapter, while the
frontend uses browser SVG-to-canvas rendering. WAV belongs to the backend CLI.
MP3 export is deferred.

Serverless deployment is not a target. The backend CLI replaces the old
serverless/API export path.

The parser is hand-written. The old Nearley/Moo grammar and `nearleyc` build
plugin are not being carried forward.

## Current Status

Status: usable rewrite with remaining compatibility and quality work.

Current validation command:

```sh
pnpm -C reloaded run test
```

Current known passing state:

- 75 tests pass.
- The test suite builds TypeScript before running Node tests.
- Coverage includes parser behavior, renderer snapshots, player timing, MIDI,
  backend PNG/WAV export, examples, CLI behavior, release metadata, and a
  frontend production build smoke test.

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
- Legacy accidental-first key spelling coverage such as `#C` and `bB`.

Renderer:

- Deterministic SVG string renderer.
- Header, score, layout, metrics, dimensions, styles, XML helpers, and drawing
  modules are split from the original monolithic renderer path.
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
- Browser playback uses the legacy `WebAudioTinySynth` adapter.
- Backend WAV export uses the same `WebAudioTinySynth` adapter with
  `@descript/web-audio-js` offline rendering, so WAV timbres follow browser
  Program and drum playback more closely than the earlier simple oscillator
  path.
- WAV output is backend-only stereo 16-bit PCM.
- Browser playback and exports use fixed MIDI velocity `64`.

Backend CLI:

- `validate`
- `parse`
- `export-svg`
- `export-png`
- `export-midi`
- `export-wav`
- `--version`
- `--help`
- Human-readable diagnostics on stderr.
- JSON output for `parse --json` and `validate --json`.
- Usage errors return exit code `2`.
- Parse/export failures return exit code `1`.
- CLI validates options before reading input files where possible.
- Option handling covers missing values, unknown options, negative numeric
  values, page width, WAV sample rate, WAV amplitude, and program range.

Frontend:

- React/Vite browser app.
- Empty initial editor content and original editor placeholder text.
- Source editor with programming-font ligatures disabled.
- SVG preview with scrollable width management.
- Play and Stop controls.
- Note highlighting during playback.
- Click rendered notes to start playback from that note.
- SVG and MIDI downloads using the original `jianpu-score.*` filenames.
- PNG download using browser SVG-to-canvas rendering and the
  `jianpu-score.png` filename.
- Theme toggle with saved preference and system dark-mode initialization.
- Preview/export color and background controls.
- Page width control shared by preview and SVG export.
- Settings panel with grouped Program selection, volume, audition, and
  initial-rest omission.
- Program list covers General MIDI and drum-note programs.
- Volume control uses the original `0..200%` range and `100%` default.
- Examples panel with migrated legacy examples.
- Loading an example stops active playback and closes the panel.
- Play and Stop close the examples panel like the old UI.
- Grammar help panel backed by `docs/GRAMMAR.md`.
- Frontend production build smoke test confirms SVG/PNG/MIDI controls are
  present and WAV/MP3 controls are absent.

Examples:

- Legacy examples from the original examples panel are available as
  `examples/*.jp` fixtures.
- Examples are covered by parse, SVG, PNG, MIDI, and WAV test paths.

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

## Deliberately Not Ported

The following old-project pieces are intentionally not part of the current
rewrite target:

- Serverless and API deployment folders.
- Frontend WAV export.
- Frontend MP3 export.
- Old browser WAV sample-rate setting.
- Nearley/Moo parser generation and `plugins/nearleyc.js`.
- Generated `public/grammar.html` railroad diagram.

The grammar is now maintained in `docs/GRAMMAR.md`. Backend WAV sample rate is
available through `export-wav --sample-rate`.

## Remaining Work

High priority:

- Add browser-level frontend smoke tests. Current frontend verification builds
  the production bundle but does not open the app in a real browser, load an
  example, verify non-empty rendered SVG, click a note, or exercise playback and
  export buttons.
- Decide the browser test tool. Playwright is the strongest fit, but it requires
  adding a browser automation dependency and handling installation in this
  environment.
- Add focused renderer golden snapshots only when behavior changes or an
  uncovered compatibility edge case is found. The current snapshot set already
  covers the main header, notation, wrapping, and tie cases.

Medium priority:

- Improve parser diagnostics and recovery for additional malformed compact
  notation and header edge cases discovered during compatibility testing.
- Validate TinySynth WAV output quality and performance on longer example
  scores. The current examples pass, but offline TinySynth rendering is slower
  than the earlier simple waveform renderer.
- Review frontend responsive layout in a real browser after browser automation
  exists.
- Finalize distribution polish once browser smoke testing is decided.

Lower priority or post-parity improvements:

- Pagination or multi-page output.
- More sophisticated note-level horizontal re-spacing.
- Fuller collision avoidance for dense chords, ties, and metadata.
- Velocity syntax.
- Multi-track arrangements.
- Richer drum controls.
- Optional MP3 backend export.
- Optional npm publication after package policy is decided.
- Optional favicon/static asset polish.

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
  +--> melody compiler -> browser TinySynth playback
  |
  +--> melody compiler -> MIDI writer
  |
  +--> melody compiler -> backend TinySynth WAV renderer
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
- Backend owns Node-capable PNG and WAV adapters.
- Web owns the browser PNG adapter.
- Web does not import backend modules.
- CLI coordinates modules but should keep business logic thin.

## Compatibility Position

The rewrite currently aims for practical compatibility with the old project,
not byte-for-byte or pixel-for-pixel identity.

Preserved or restored behavior:

- Current legacy examples parse and export.
- Compact notation remains supported.
- Header defaults and known semantic header fields are supported.
- Unknown header fields are preserved.
- Measure-local accidental persistence is implemented.
- Ties merge playback/export duration.
- Browser playback uses WebAudioTinySynth.
- Program and drum controls are restored in the frontend.
- Initial-rest omission is restored.
- Frontend source/editor/settings/examples/grammar workflows are restored in
  the current UI style.

Intentional differences:

- Parser is stricter in several malformed cases.
- Tie legality is validated before successful parse.
- Empty measure syntax is rejected.
- Measure duration mismatch is a warning, not a fatal error.
- Renderer output is deterministic SVG strings rather than React element output.
- Bars are SVG primitives rather than music-font glyphs.
- WAV is backend-only; PNG is available in both editions through different
  adapters.
- Serverless is removed from the target architecture.

## Milestone Status

Milestone 0: project setup

- Status: complete.
- Notes: pnpm, TypeScript, package metadata, test/build scripts, docs skeleton,
  and nested repo are in place.

Milestone 1: core model and parser

- Status: complete for current grammar target.
- Remaining work: more diagnostic recovery for newly found malformed inputs.

Milestone 2: renderer

- Status: substantially complete for current parity target.
- Remaining work: edge-case snapshots, pagination, finer spacing, and collision
  avoidance.

Milestone 3: playback and MIDI

- Status: substantially complete for current parity target.
- Notes: browser playback uses TinySynth; MIDI export supports melodic and drum
  programs; note highlighting and click-to-play work.
- Remaining work: browser-level automation and optional richer musical features.

Milestone 4: backend exports and UI polish

- Status: substantially complete.
- Notes: CLI SVG/PNG/MIDI/WAV exports work; frontend exposes SVG/PNG/MIDI and
  intentionally excludes WAV/MP3; settings/examples/theme/page-width workflows
  are present.
- Remaining work: real-browser responsive and workflow checks.

Milestone 5: packaging and distribution

- Status: partially complete.
- Notes: package entry points, CLI binary, release file boundaries, and release
  docs exist.
- Remaining work: browser smoke tooling decision, final distribution checks,
  and optional publication policy.

## Test Strategy

Current test layers:

- parser unit tests
- renderer SVG tests and golden snapshots
- player melody/MIDI tests
- backend PNG/WAV tests
- CLI integration tests
- examples compatibility test
- package metadata test
- frontend production build smoke test

Testing gaps:

- No real-browser UI automation yet.
- No automated audio perceptual comparison.
- No PNG golden image comparison.

Preferred additions:

- Browser smoke test that starts the Vite build or preview, opens the app, loads
  an example, verifies rendered SVG, clicks a rendered note, and exercises SVG
  and MIDI export controls.
- Focused regression tests whenever a compatibility bug is fixed.
- Additional renderer snapshots only for meaningful visual behavior, not for
  every fixture.

## Risks

Browser automation dependency:

- The largest remaining test gap needs a browser automation tool. This will add
  dependency and installation complexity.

TinySynth offline rendering performance:

- WAV export now matches browser timbres more closely, but rendering long
  examples is slower than the previous deterministic oscillator path.

Renderer complexity:

- Dense chords, ties, labels, metadata, and wrapping can still overlap in edge
  cases. Current layout is practical but not full engraving.

Parser compatibility:

- The hand-written parser is intentionally stricter in malformed cases. Future
  compatibility issues should be resolved with explicit tests and documentation.

Scope creep:

- Jianpu notation can grow indefinitely. The rewrite should preserve current
  project behavior first and add new notation features only when they have clear
  syntax, rendering, playback, and test plans.
