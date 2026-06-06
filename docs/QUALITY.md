# Quality Policy

This document describes the repository's testing and frontend quality
expectations. Product behavior and implementation details live in the focused
references such as `docs/ARCHITECTURE.md`, `docs/RENDERER.md`,
`docs/PLAYER.md`, and `docs/EXPORTS.md`.

## Testing Layers

Current test coverage includes:

- parser unit tests
- renderer SVG tests and golden snapshots
- player melody/MIDI tests
- backend PNG/WAV/MP3 tests
- CLI integration tests
- examples tests
- package metadata tests
- frontend production-build smoke test

## Testing Guidelines

- Add focused regression tests for fixed bugs.
- Keep parser tests close to grammar behavior and diagnostics.
- Add renderer snapshots only for meaningful visual behavior or uncovered edge
  cases.
- Keep examples warning-free.
- Prefer source-level or build-level frontend checks unless browser automation
  policy changes.
- Do not introduce Playwright or another browser automation dependency for now.

## Known Test Gaps

- No automated real-browser UI tests.
- No automated audio perceptual comparison.
- No PNG golden image comparison.
- No real-browser assertion that WAV/MP3 downloads complete successfully.

Real-browser checks remain manual in the current phase.

## Frontend Quality Policy

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
