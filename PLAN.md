# Modern Jianpu Reloaded - Rewrite Plan

This document is the implementation plan for rewriting the existing Modern
Jianpu Markup project inside this standalone repository.

The plan has been reviewed and implementation has started. This document remains
the working plan for the rewrite and should be updated when scope or milestone
decisions change.

## Implementation Status

Completed initial slices:

- Project scaffold with pnpm, TypeScript, build script, and Node test runner.
- Shared core document model.
- Hand-written tokenizer and parser.
- CLI `parse` and `validate`.
- Backend SVG renderer and CLI `export-svg`.
- Melody compiler, MIDI writer, and CLI `export-midi`.
- Frontend preview application with SVG/MIDI export and basic playback.
- Example score set with parser/SVG/PNG/MIDI coverage.
- Backend PNG export through the CLI.
- Renderer layout pass closer to the legacy spacing/chord/tie model.
- Tie validation for mismatched pitches, rests, drums, and measure-local
  accidental persistence.
- Measure duration mismatch warnings based on the active time signature.
- Frontend playback highlighting and click-to-play-from-note behavior.
- Renderer measure wrapping based on `pageWidth`.
- Renderer horizontally scales overwide visual lines to stay within `pageWidth`.
- CLI `--page-width` option for SVG and PNG export.
- Frontend page width control shared by preview and SVG export.
- Machine-readable CLI diagnostics for `parse --json` and `validate --json`.
- MIDI tempo and time-signature meta event coverage.
- Backend WAV export through the CLI.
- Drum MIDI export coverage with percussion-channel program handling.
- Export behavior documentation in `docs/EXPORTS.md`.
- Current grammar documentation in `docs/GRAMMAR.md`.
- Current renderer documentation in `docs/RENDERER.md`.
- Current player documentation in `docs/PLAYER.md`.
- Frontend diagnostics status shows warning and error counts.
- Theme-aware SVG and PNG export color/background options.
- Frontend color/background controls shared by preview and SVG export.
- Example test coverage includes WAV export.
- Architecture documentation in `docs/ARCHITECTURE.md`.
- Compatibility documentation in `docs/COMPATIBILITY.md`.
- Frontend program control shared by playback and MIDI export.
- CLI `parse --json` and parser source range coverage.
- Parser diagnostics for empty chords and non-pitch chord members.
- CLI rejects flags with missing values.
- CLI rejects unknown options per command.
- Player APIs reject out-of-range programs.
- CLI validates options before reading input files.
- Unknown header fields are covered as preserved raw metadata.
- WAV export option validation is covered.
- Minimal renderer SVG snapshot coverage exists.
- CLI WAV sample-rate behavior is covered.
- Parser rejects mixed duration suffix styles with a specific diagnostic.
- Renderer options, dimensions, styles, and XML helpers are split from the main
  SVG renderer.
- Renderer note metrics and measure/line layout are split from SVG drawing.
- Renderer header and tempo mark drawing are split from score drawing.
- Renderer score, note, bar, and tie drawing are split from top-level SVG
  document serialization.
- Renderer golden snapshots cover both a minimal score and full header metadata.
- Renderer golden snapshots cover accidentals, octave dots, chords, rests,
  drums, dashes, dots, underlines, ties, and final bars.
- Renderer cross-line tie continuation stays within the wrapped visual line and
  is covered by a golden snapshot.
- Frontend production build smoke test covers the app shell and SVG/MIDI export
  controls while confirming PNG/WAV/MP3 exports stay out of the browser bundle.
- Package metadata declares backend/library entry points, the CLI binary, and
  release file boundaries, with tests covering built output paths.
- Release and distribution shape is documented in `docs/RELEASE.md`.
- MP3 export is explicitly deferred from the current release target; WAV is the
  backend audio export for now.
- Parser recovers malformed header lines without cascading into score syntax
  errors.
- Parser reports unterminated chords with a specific diagnostic.
- Parser tests cover comment/newline boundaries and invalid compact notation
  character positions.
- Parser reports stray compact duration suffixes and unmatched chord closing
  braces with specific diagnostics.
- Renderer displays score line labels with reserved horizontal space.
- Parser stops unterminated chords at line boundaries with a specific diagnostic.
- CLI `--version` reports the package version for release checks.
- Package metadata pins the expected package manager version.
- npm publication is explicitly deferred while the package remains private.
- CLI `export-wav` exposes the backend amplitude option.
- WAV export and browser preview playback share lightweight synth constants,
  MIDI frequency conversion, envelope timing, and triangle-wave tone shape.
- Frontend source editor disables programming-font ligatures, and playback
  controls include grouped Program selection, browser preview volume, and
  Program audition.
- Frontend theme toggle restores the original light/dark workflow while syncing
  SVG preview/export color presets.
- Frontend grammar help restores the original help entry point using the
  maintained `docs/GRAMMAR.md` reference.
- Legacy example songs from the original frontend examples panel are available
  as `examples/*.jp` fixtures and are covered by parse/render/export tests.
- Initial-rest omission from the original player settings is available for
  frontend from-start playback, MIDI export, WAV export, and CLI export flags.

Current test status:

- Parser, renderer, melody, MIDI, examples, and backend export tests pass.

Remaining rewrite and improvement work:

High priority:

- Add browser-level frontend smoke tests. Current frontend verification is a
  production build smoke test only; there is no automated test that opens the
  app in a real browser, loads an example, verifies non-empty rendered SVG, or
  exercises playback/export button interactions.
- Continue adding renderer golden SVG snapshots only for newly changed behavior
  or uncovered edge cases. Current snapshots already cover the main header,
  notation, wrapping, and tie cases from the first renderer test plan.

Medium priority:

- Finalize distribution polish. Package metadata, release shape, package manager
  version, and private npm-publish status are documented; automated browser
  smoke testing still needs a final dependency/tooling decision.
- Improve parser diagnostics and recovery for additional malformed inputs,
  especially additional compact-notation edge cases found during compatibility
  testing.

Lower priority or post-parity improvements:

- Continue improving WAV and browser playback sound quality. Playback/export now
  share deterministic triangle-wave synthesis, but still do not use instrument
  samples or realistic program-specific synthesis.
- Add optional musical features such as velocity, multi-track arrangements,
  stereo audio, richer drum audio, and fuller instrument handling.
- Improve renderer layout capabilities such as pagination, finer note-level
  horizontal re-spacing, and fuller collision avoidance for dense chords and
  ties.

## Goals

The rewrite should preserve the useful behavior of the current project while
making the system easier to test, extend, and reason about.

Primary goals:

- Define a stable Jianpu document model independent of React and browser APIs.
- Replace implicit parser/render/player coupling with explicit module contracts.
- Make grammar behavior testable with fixture-based parser tests.
- Make renderer output deterministic and snapshot-testable.
- Make playback and export share one timing/melody pipeline.
- Support a backend CLI edition with all export functionality.
- Support a frontend web edition with editor, preview, playback, SVG export, and
  MIDI export.
- Share parsing, rendering, and playback logic between editions without
  duplicating core behavior.
- Improve documentation so syntax, rendering behavior, and playback behavior are
  discoverable from the repo.

Non-goals for the first rewrite pass:

- Full music engraving quality.
- Full Jianpu feature coverage beyond the current project.
- Multi-track arrangement editing.
- A large visual redesign.
- Backward-incompatible syntax changes unless explicitly documented and migrated.

## Current Project Lessons

The existing project proves the core idea works:

- Nearley/Moo can parse the current markup.
- A parsed score can drive both SVG rendering and playback.
- React SVG is a practical way to build the browser preview.
- WebAudioTinySynth is adequate for lightweight browser playback.
- MIDI export can be implemented without a heavy dependency.

The rewrite should address these weaknesses:

- The parser grammar, post-parse validation, renderer assumptions, and player
  assumptions are not clearly separated.
- Some generated build outputs live in tracked-looking source locations and
  confuse linting.
- Several APIs have type mismatches, for example SVG export returning a string
  while some callers treat it like a Blob.
- Rendering has many layout constants embedded in one large file.
- Playback timing, highlighting, MIDI export, and WAV rendering share concepts
  but do not share a formal timing model.
- Documentation was not part of the original module boundaries.

## Repository Scope

This `reloaded/` directory is a separate Git repository. The outer repository
must ignore it.

Expected top-level shape once implementation begins:

```text
reloaded/
  PLAN.md
  README.md
  package.json
  pnpm-lock.yaml
  src/
    core/
    parser/
    renderer/
    player/
    cli/
    web/
  tests/
    fixtures/
    parser/
    renderer/
    player/
  docs/
```

Exact tooling can still change before implementation starts.

## Proposed Technology Choices

Recommended baseline:

- TypeScript for all new source files.
- Vite for local development and browser build.
- React for the interactive application shell and SVG preview.
- Vitest for unit tests and snapshot tests.
- ESLint with generated/build output ignored from the start.
- Prettier or one consistent formatter if the team wants automatic formatting.
- pnpm as the package manager.

Parser decision: use a hand-written tokenizer and parser.

The current language is small enough that a hand-written parser is preferable.
It should make diagnostics, source spans, error recovery, and compatibility
tests easier to control than a parser-generator pipeline.

Renderer choices:

- Keep React SVG for preview and SVG export.
- Keep `canvg` or equivalent only at the export boundary.
- Keep rendering pure: parsed score plus render options in, SVG tree/string out.

Player choices:

- Keep a pure melody/timing compiler as the shared core.
- Keep real-time playback behind an interface.
- Keep MIDI writer dependency-free unless new MIDI features justify a library.
- Treat backend audio export as an adapter rather than core functionality.

## Product Targets

The rewrite should produce two deployable targets from shared core packages.

### Backend Edition

The backend edition is a command-line application. It should include all
non-web functionality:

- parse and validate Jianpu files
- render/export SVG
- render/export PNG
- export MIDI
- export WAV as the current backend audio format
- export WAV if retained as an intermediate or user-facing format
- print diagnostics
- support fixture/debug commands useful during development

It does not provide a web page.

### Frontend Edition

The frontend edition is a browser application. It should include:

- editor
- SVG preview
- real-time playback
- note highlighting
- export SVG
- export MIDI
- examples
- settings
- diagnostics display

It should not include PNG or MP3 export. Those exports belong to the backend
edition because they are harder to implement reliably in the browser.

### Serverless

Serverless deployment is no longer a target. The backend CLI edition replaces
the need for serverless export endpoints.

## Architecture Overview

The rewrite should use a layered architecture:

```text
Text Source
  |
  v
Parser
  |
  v
Core Document Model
  |
  +--> Diagnostics
  |
  +--> Renderer Model
  |       |
  |       +--> React Preview
  |       +--> SVG Export
  |       +--> PNG Export (backend edition)
  |
  +--> Timing/Melody Model
          |
          +--> Real-Time Playback
          +--> MIDI Export
  +--> WAV Export (backend edition)
```

Important rule: renderer and player should not parse source text directly except
through a thin convenience function. The normal API should accept already parsed
and validated models.

## Core Model

Create a `src/core` package that owns shared data structures.

Suggested core types:

- `Document`
- `Header`
- `Score`
- `ScoreLine`
- `Measure`
- `Note`
- `Pitch`
- `Duration`
- `TimeSignature`
- `KeySignature`
- `SourceSpan`
- `Diagnostic`

The core model should distinguish:

- syntactic source representation
- normalized semantic representation
- render-specific layout representation
- player-specific timing representation

Avoid making React types, Web Audio types, or Blob APIs part of the core model.

## Parser Plan

Parser responsibilities:

- Tokenize source text.
- Parse header properties.
- Parse score lines, measures, notes, chords, ties, durations, accidentals, and
  octave marks.
- Preserve source locations for useful diagnostics.
- Apply basic normalization and validation.
- Return either a valid document or diagnostics.

Parser outputs should be deterministic and serializable.

Required parser behaviors to preserve:

- Score-only documents.
- Optional header with `=` separator.
- Header fields: `title`, `subtitle`, `composer`, `key`, `time`, `tempo`,
  `hidden`.
- Notes `1` to `7`.
- Rest `0`.
- Drum note `X`.
- Accidentals `#`, `##`, `b`, `bb`, `%`.
- Octave suffixes `,` and `'`.
- Measure-level octave prefixes.
- Chords with `{ ... }`.
- Durations using `-`, `/`, and `.`.
- Ties with leading `~`.
- Compact notation with optional spaces.
- Comments beginning with `;`, if kept.

Parser improvements:

- Decide and document whether empty files are valid.
- Decide and document whether unknown header fields are allowed.
- Add diagnostics for invalid measure duration as warning or error.
- Add diagnostics for tied notes with mismatched pitch.
- Add diagnostics for impossible or unsupported syntax rather than generic parser
  failures.
- Normalize accidental behavior explicitly.

Parser tests:

- one fixture per grammar feature
- compact notation fixtures
- invalid syntax fixtures
- header validation fixtures
- tie/cross-measure fixtures
- duration calculation fixtures
- source-span fixtures

## Renderer Plan

Renderer responsibilities:

- Accept a validated core document or render model.
- Produce deterministic SVG output.
- Support note click metadata for interactive preview.
- Support playing-note highlighting.
- Support SVG export without browser-only APIs.
- Support PNG export at a backend adapter boundary.

Renderer modules:

```text
src/renderer/
  index.ts
  render-document.ts
  render-header.ts
  render-score.ts
  layout/
    measure-layout.ts
    line-layout.ts
    chord-layout.ts
    tie-layout.ts
  svg/
    primitives.tsx
    styles.ts
```

Renderer improvements:

- Separate measurement from drawing.
- Keep all layout constants in one typed theme/options object.
- Avoid relying on `props.height` from React elements as the layout API.
- Make line width, page width, and wrapping behavior explicit.
- Decide whether page width should constrain score line layout.
- Make exported SVG colors explicit rather than relying only on `currentColor`.
- Support deterministic final bar rendering with named symbols.
- Document font assumptions.

Renderer tests:

- SVG snapshot for a minimal score.
- Header snapshot with each metadata field.
- Accidentals and octave dots.
- Chords.
- Rests and drums.
- Dashes, dots, and underlines.
- Local ties.
- Cross-measure ties.
- Cross-line ties.
- Empty score/header cases.

## Player Plan

Player responsibilities:

- Compile a validated document into a timing model.
- Compile timing model into real-time playback events.
- Compile timing model into MIDI events.
- Optionally compile timing model into offline audio.
- Provide predictable start/stop behavior and note highlighting.

Player modules:

```text
src/player/
  index.ts
  melody-compiler.ts
  timing.ts
  realtime/
    synth-player.ts
  midi/
    midi-file.ts
    midi-export.ts
  audio-export/
    wav-export.ts
```

Player improvements:

- Create a single `TimedEvent` or `TimedNote` model shared by playback and MIDI.
- Represent tempo and time signature explicitly.
- Keep rests as timed events or gaps with clear semantics.
- Make accidentals and key mapping testable.
- Make drum program behavior explicit.
- Validate ties before compiling playback.
- Decouple note highlighting from sound scheduling.
- Make cancellation robust for overlapping play requests.

Player tests:

- pitch-to-MIDI mapping by key and octave.
- accidental persistence/reset by measure.
- tie duration merging.
- rest skipping behavior.
- drum mapping.
- MIDI byte snapshots for small fixtures.
- tempo and time-signature meta events.

## CLI Plan

The backend edition should expose a CLI rather than a web server.

Possible commands:

```text
jianpu parse input.jp
jianpu validate input.jp
jianpu export-svg input.jp -o score.svg
jianpu export-png input.jp -o score.png
jianpu export-midi input.jp -o score.mid
jianpu export-wav input.jp -o score.wav
```

Exact command names can change during implementation, but the CLI should keep
input/output behavior explicit and scriptable.

CLI requirements:

- non-zero exit code on fatal parse/export errors
- human-readable diagnostics by default
- optional machine-readable diagnostics, for example JSON
- no browser-only APIs
- export behavior should use the same core parser, renderer, and player modules
  as the frontend edition

## App/UI Plan

The frontend application UI should be practical, not redesigned from scratch.

Initial UI:

- editor panel
- SVG preview panel
- play/stop controls
- export SVG
- export MIDI
- settings modal or settings panel
- examples panel
- parse diagnostics display

UI improvements:

- Use clear buttons and accessible labels.
- Avoid garbled icon glyphs by using text labels or an icon library.
- Make mobile layout usable.
- Keep examples in fixture files or data modules, not deeply embedded in a large
  component.
- Show parse errors with line/column when available.

## Export Plan

SVG:

- Export should return a string or Blob consistently.
- API should make the return type explicit.
- Backend and frontend exports should share serialization code.

PNG:

- Backend edition only.
- Render SVG into PNG through one Node-capable adapter.
- Do not expose PNG export in the frontend edition.
- Respect light/dark/export theme explicitly.

MIDI:

- Keep deterministic writer.
- Add tests around bytes and event timing.
- Support one track initially.

WAV/MP3:

- WAV can be retained as an intermediate format if useful for MP3 encoding or as
  a user-facing backend export.
- Do not expose MP3 export in the frontend edition.
- MP3 export is deferred from the current release target. If added later, it
  should be implemented as a backend adapter on top of the audio pipeline.

## Documentation Plan

Docs should be part of the rewrite, not an afterthought.

Initial docs:

- `README.md`: what the project is and how to run it.
- `docs/GRAMMAR.md`: user-facing syntax reference.
- `docs/ARCHITECTURE.md`: module boundaries and data flow.
- `docs/RENDERER.md`: renderer behavior and layout model.
- `docs/PLAYER.md`: playback/export behavior.
- `docs/COMPATIBILITY.md`: compatibility with the old project.

Docs should be updated in the same milestone as behavior changes.

## Migration And Compatibility

Start with current syntax compatibility unless there is a clear reason to change
behavior.

Compatibility checklist:

- Existing example scores parse.
- Existing examples render recognizably.
- Existing examples play with comparable pitches and durations.
- SVG export works for example scores.
- MIDI export works for example scores.

If behavior changes are intentional, document them in `docs/COMPATIBILITY.md`.

Potential behavior decisions:

- Whether empty documents are valid.
- Whether comments create newline separators.
- Whether unknown header fields are kept.
- Whether accidentals persist for the measure.
- Whether ties must match pitch.
- Whether measure duration mismatch is an error or warning.
- Whether chord ordering should use first or last note as the visual base.

## Milestones

### Milestone 0: Project Setup

Deliverables:

- package manager and TypeScript setup
- lint/test/build commands
- basic directory structure
- CI-ready scripts, even if CI is not configured yet
- initial docs skeleton

Exit criteria:

- pnpm workspace/package setup exists
- `install`, `test`, `lint`, and `build` commands exist
- empty app or library builds
- no generated files are linted

### Milestone 1: Core Model And Parser

Deliverables:

- core data model
- parser/tokenizer
- diagnostics
- parser fixtures
- grammar documentation draft

Exit criteria:

- current examples parse
- invalid fixtures produce useful diagnostics
- duration/key/time parsing has tests

### Milestone 2: Renderer

Deliverables:

- header renderer
- score renderer
- SVG serialization
- renderer snapshots
- browser preview integration

Exit criteria:

- current examples render
- parse errors display in UI
- SVG export returns a valid SVG string or Blob consistently

### Milestone 3: Playback And MIDI

Deliverables:

- timing/melody compiler
- real-time playback
- note highlighting
- MIDI export
- player tests

Exit criteria:

- examples play
- clicking a note starts playback from that note
- MIDI exports open in common MIDI players
- timing tests pass

### Milestone 4: CLI Backend Exports And UI Polish

Deliverables:

- backend CLI shell
- backend PNG export
- backend WAV export implementation
- theme-aware export behavior
- settings UI
- examples UI
- responsive layout pass

Exit criteria:

- backend PNG export works from the CLI
- frontend intentionally omits PNG and MP3 export
- UI is usable on desktop and mobile widths
- examples are easy to load and inspect

### Milestone 5: Packaging And Distribution

Deliverables:

- CLI packaging
- frontend production build
- release documentation
- compatibility documentation
- optional WAV polishing

Exit criteria:

- backend CLI can run from a built package
- frontend build runs without serverless support
- export commands are documented
- WAV export is tested on representative examples

## Testing Strategy

Prefer small deterministic tests over broad manual checks.

Test layers:

- parser unit tests
- core model normalization tests
- renderer SVG snapshots
- player timing tests
- MIDI byte/event tests
- UI smoke tests

Recommended fixture layout:

```text
tests/fixtures/
  valid/
  invalid/
  examples/
  snapshots/
```

Every syntax feature should have at least one parser fixture and, when visual,
one renderer fixture.

## Risks

Parser ambiguity:

- Compact notation is convenient but can make diagnostics harder.
- Mitigation: write a tokenizer that preserves source spans and test compact
  cases carefully.

Renderer complexity:

- Chords, octave dots, duration marks, and ties can overlap.
- Mitigation: separate measurement from drawing and snapshot representative
  cases.

Playback compatibility:

- The current implementation has implicit behavior around accidentals and ties.
- Mitigation: write tests that capture the intended behavior before changing it.

Platform API differences:

- PNG and audio rendering should be backend responsibilities where practical.
- Mitigation: isolate adapters and provide clear support/fallback decisions.

Scope creep:

- Music notation can expand indefinitely.
- Mitigation: preserve current behavior first, then add features only after the
  rewrite reaches parity.

## Immediate Next Decision

Before writing production code, decide:

1. Exact package layout for shared core, backend CLI, and frontend app.
2. Exact test tooling around Vitest, snapshots, and possible browser tests.
3. Whether first milestone targets a library-only parser or a minimal app shell.
4. WAV synthesis strategy and any future MP3 adapter decision.
5. Compatibility rules for ties, accidentals, empty files, and measure duration
   validation.
