# AGENTS.md

This file is the handoff guide for agents working in this repository. Treat this
directory as the project root.

## Project Snapshot

Modern Jianpu Markup is a TypeScript toolkit and browser app for parsing,
rendering, playing, and exporting Jianpu scores.

The project has two editions built from shared source:

- Backend CLI edition.
- Frontend browser edition.

The backend CLI includes the full command surface:

- `validate`
- `parse`
- `export-svg`
- `export-png`
- `export-midi`
- `export-wav`
- `export-mp3`

The frontend browser app includes:

- source editor
- SVG preview
- playback
- active-note highlighting
- click-to-play from rendered notes
- SVG, PNG, MIDI, WAV, and MP3 downloads
- examples
- page and sound settings
- grammar help
- diagnostics display

Score examples and user-facing score files use the `.jpu` extension.

Serverless/API deployment is not a project target. The parser is hand-written;
Nearley/Moo parser generation is not part of this architecture.

## Working Commands

Use pnpm. The package manager version is pinned in `package.json`.

```sh
pnpm install
pnpm run check
pnpm run test
pnpm run web:build
pnpm run build
pnpm run dev
pnpm run cli -- --version
pnpm run cli -- validate examples/twinkle.jpu
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3
pnpm run grammar:railroad
```

Preferred verification before finishing meaningful changes:

```sh
pnpm run check
pnpm run test
pnpm run web:build
```

`pnpm run test` builds the backend TypeScript output, runs Node tests, and
includes the frontend production-build smoke test.

For release-oriented checks, also run:

```sh
npm pack --dry-run --json
```

Inspect the package file list manually after that command.

## Architecture Boundaries

Current data flow:

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
- Player owns melody, MIDI, and shared synth-facing logic, but not UI.
- Backend owns Node-capable PNG, WAV, and MP3 adapters.
- Web owns browser UI and browser adapters.
- Web must not import backend modules.
- CLI coordinates modules and should keep business logic thin.

## Current Capabilities

Parser:

- Hand-written tokenizer and parser.
- Optional line-oriented header before an `=` separator.
- Score-only documents and empty documents.
- Semantic header fields include `title`, `subtitle`, `composer`, `key`,
  `time`, `tempo`, and `hidden`.
- Unknown header fields are preserved in document metadata.
- Notes `1..7`, rest `0`, and drum note `X`.
- Accidentals `#`, `##`, `b`, `bb`, and `%`.
- Per-note octave suffixes and measure-level octave prefixes.
- Track labels `T1:` through `T16:` for multi-track arrangements, with `T10`
  reserved for drums.
- Chords with `{ ... }`.
- Duration suffixes with dashes, slashes, and dots.
- Leading tie marker `~`.
- Whitespace is optional between score tokens; spaced and unspaced notation are
  the same grammar, not separate parser modes.
- Comments beginning with `;`.
- Source ranges for diagnostics.
- Validation for malformed headers, invalid notes, empty measures, empty
  chords, invalid chord members, invalid score tokens, stray duration suffixes,
  unmatched chord braces, unterminated strings, tie legality, and
  measure-duration mismatches.

Renderer:

- Deterministic SVG string output.
- Header, score, layout, metrics, dimensions, style, XML, and drawing helpers
  are separated in implementation.
- Header metadata rendering, including hidden-header behavior.
- Notes, rests, drums, accidentals, octave dots, chords, duration dots, dashes,
  underlines, ties, regular bars, and final bars.
- Tempo marks with stable character choices.
- Score line labels with reserved horizontal space.
- Active-note highlighting for frontend playback.
- Note metadata for click-to-play.
- Theme/export color and background options.
- Page-width wrapping.
- Preview panel width inference, content-width inference, and manual page width
  modes.
- Overwide visual line scaling to keep rendered scores inside page width.

Player and export:

- Shared melody compiler from parsed document to timed melody events.
- Key signature, accidentals, octave marks, rests, chords, ties, and drum notes
  compile into playback/export events.
- Initial-rest omission helper.
- Program validation for `0..220`.
- Melodic programs `0..127`.
- Drum programs `128..220`, mapping `X` to percussion note
  `program - 128 + 35`.
- MIDI export with format 1 header, meta track, tempo, time signature, melodic
  program changes, channel 10 drum handling, one music track per labeled
  arrangement track, note on/off events, and deterministic bytes.
- Browser playback uses the `WebAudioTinySynth` adapter.
- Browser playback schedules TinySynth events incrementally.
- Browser playback stops when the source editor changes.
- Backend WAV export uses `WebAudioTinySynth` with
  `@descript/web-audio-js` offline rendering.
- Backend MP3 export shares the backend offline render path and encodes stereo
  PCM with `lamejs`.
- Frontend WAV/MP3 export uses browser `OfflineAudioContext` with the same
  TinySynth adapter as preview playback.
- Frontend MP3 encoding is local through bundled `lamejs`.
- Browser playback and exports use fixed MIDI velocity `64`.

Frontend:

- React/Vite app.
- Empty initial editor content and placeholder text.
- Source editor with programming-font ligatures disabled.
- SVG preview with scrollable width management.
- Export menu for SVG, PNG, MIDI, WAV, and MP3.
- Theme, preview/export color, and background controls.
- Page Settings and Sound Settings are visually separated.
- Grouped Program selection, volume, audition, and initial-rest omission.
- Program list covers General MIDI and drum-note programs.
- Volume control uses `0..200%` range and `100%` default.
- Browser audio sample-rate setting is available for WAV/MP3 export.
- Examples panel uses curated `.jpu` examples.
- Loading an example stops active playback and closes the panel.
- Grammar button opens `grammar.html` in the built frontend.

Examples:

- Curated fixtures live in `examples/*.jpu`.
- Examples should have useful metadata headers.
- Examples are expected to parse without warnings.
- Frontend examples import `.jpu?raw`.
- Keep examples representative rather than redundant.

## Source And Documentation Map

Key source directories:

- `src/core/`: shared document model and neutral types.
- `src/parser/`: tokenizer and parser.
- `src/renderer/`: SVG rendering.
- `src/player/`: melody compiler, MIDI writer, and synth-facing logic.
- `src/backend/`: Node export adapters.
- `src/cli/`: CLI command handling.
- `src/web/`: React frontend and browser adapters.
- `tests/`: Node built-in tests and snapshots.
- `examples/`: `.jpu` score fixtures.
- `public/`: frontend static files, including grammar reference.
- `docs/`: architecture, renderer, player, export, release, and grammar source
  documentation.

Important docs:

- `README.md`: user-facing overview and commands.
- `public/grammar.html`: detailed user-facing grammar reference.
- `docs/grammar.ebnf`: grammar source used for railroad generation.
- `docs/RENDERER.md`: renderer behavior.
- `docs/PLAYER.md`: player behavior.
- `docs/EXPORTS.md`: export behavior.
- `docs/ARCHITECTURE.md`: module boundaries.
- `docs/RELEASE.md`: build and distribution shape.

When grammar behavior changes, update both `public/grammar.html` and
`docs/grammar.ebnf`, then run:

```sh
pnpm run grammar:railroad
```

The grammar page should stay user-facing. Avoid parser-internal wording such as
return shapes, raw AST field names, or implementation diagnostics unless they
are genuinely useful to score authors.

## Testing Policy

Current test layers:

- parser unit tests
- renderer SVG tests and golden snapshots
- player melody/MIDI tests
- backend PNG/WAV/MP3 tests
- CLI integration tests
- examples tests
- package metadata tests
- frontend production-build smoke test

Guidelines:

- Add focused regression tests for fixed bugs.
- Keep parser tests close to grammar behavior and diagnostics.
- Add renderer snapshots only for meaningful visual behavior or uncovered edge
  cases.
- Keep examples warning-free.
- Prefer source-level or build-level frontend checks unless browser automation
  policy changes.
- Do not introduce Playwright or another browser automation dependency for now.

Known test gaps:

- No automated real-browser UI tests.
- No automated audio perceptual comparison.
- No PNG golden image comparison.
- No real-browser assertion that WAV/MP3 downloads complete successfully.

Real-browser checks remain manual in the current phase.

## Frontend Policy

The frontend should behave as a usable application, not a marketing page.

Practical rules:

- Keep controls discoverable and compact.
- Keep page width management from allowing normal scores to visually spill out
  of the preview/page.
- Stop playback when source changes.
- Keep export options grouped under the export menu.
- Keep Page Settings and Sound Settings distinct.
- Avoid UI copy that talks about implementation history.
- Keep grammar help in `grammar.html`, not on the main page.
- Do not import backend modules from `src/web/`.

PNG, WAV, and MP3 are supported in the browser through browser-specific
adapters. Do not remove those features because the backend also supports them.

## Release And Packaging Notes

Package name:

```text
modern-jianpu-markup
```

CLI binary:

```text
jianpu
```

Build outputs:

- `dist/`: backend CLI and shared library modules.
- `dist-web/`: static frontend app.

`tsconfig.build.json` intentionally excludes `src/web/`; browser source is
bundled through Vite.

The package is currently private. Before publication, confirm package version,
package privacy, release notes, and the `npm pack --dry-run --json` file list.

Expected release file allow-list:

- `dist/`
- `dist-web/`
- `docs/`
- `examples/`
- `README.md`
- `AGENTS.md`
- `package.json`

## Known Risks And Future Work

Higher priority:

- Improve parser diagnostics and recovery for additional invalid score-token
  sequences and header edge cases discovered during testing. Treat spaced and
  unspaced score input uniformly; whitespace must not create a separate syntax
  mode.
- Validate TinySynth WAV/MP3 quality and performance on longer scores in both
  backend and browser exporters.
- Review frontend responsive layout manually in real browsers when UI structure
  changes.
- Keep `public/grammar.html` and `docs/grammar.ebnf` aligned whenever grammar
  behavior changes.

Renderer risks:

- Dense chords can still create difficult spacing cases.
- Long ties can stress wrapping and collision avoidance.
- Long labels can consume horizontal space.
- Very narrow page widths can still produce visually poor output.
- Pagination and multi-page output are not implemented.
- More sophisticated note-level horizontal re-spacing remains future work.

Optional future features:

- Velocity syntax.
- Per-track program, volume, pan, or tempo controls.
- Richer drum controls.
- Optional npm publication after package policy is decided.
- Optional favicon/static asset polish.
- Optional browser-level automation after dependency policy changes.

## Change Guidelines For Agents

- Prefer the existing module boundaries and local helper APIs.
- Keep behavior changes documented and tested.
- Use `.jpu` for score files.
- Keep docs written as normal project documentation, focused on current behavior.
- Avoid unrelated refactors.
- If files contain user changes, preserve them and work with them.
- After each conversation turn, if you made any repository changes, commit
  them inside this repository before finishing the turn.
