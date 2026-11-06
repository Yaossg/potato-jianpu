# Quality Policy

This document describes the repository's testing and frontend quality
expectations. Product behavior and implementation details live in the focused
references such as `docs/ARCHITECTURE.md`, `docs/RENDERER.md`,
`docs/PLAYER.md`, and `docs/EXPORTS.md`.

## Test Suite

The complete test suite run by `pnpm run test` includes:

- parser unit tests
- renderer SVG tests and golden snapshots
- player melody/MIDI tests
- backend PNG/PDF/WAV/MP3 tests
- CLI integration tests
- examples tests
- package metadata tests
- frontend production-build smoke test
- frontend application wiring tests for persisted defaults, header/UI option
  combinations, clean visual exports, audio gain, and font-download retries
- module import boundary checks

The frontend smoke test builds both the browser app and the documentation site,
then checks selected generated files and bundled behavior. It is not a
real-browser interaction test.

Application wiring tests execute the actual App handlers with deterministic
React hooks and the real parser/renderer. They check all 216 combinations of
omitted/false/true page headers and the three UI checkboxes. Browser adapters
are substituted at the I/O boundary. These tests do not cover DOM layout,
React effect scheduling, or browser download permissions.

## Testing Guidelines

- Add focused regression tests for fixed bugs.
- Keep parser tests close to grammar behavior and diagnostics.
- Add renderer snapshots only for meaningful visual behavior or uncovered edge
  cases.
- Keep examples warning-free.
- Prefer source-level or build-level frontend checks unless browser automation
  policy changes.
- Do not introduce Playwright or another browser automation dependency for now.

## Coverage Reporting

Run the focused instrumented test suite with:

```sh
pnpm run test:coverage
```

This command writes a local HTML report to `coverage/index.html`. It exercises
the parser, renderer, player, backend, examples, and package tests, and remaps
the results to shared source files, including core modules. It intentionally
does not run the CLI integration tests or frontend production-build smoke test,
so it complements rather than replaces `pnpm run test`.

Coverage is a diagnostic aid, not a release gate. The repository does not
upload reports or enforce a numeric threshold. Use uncovered statements and
branches to find missing behavior tests, but prefer meaningful regression and
edge-case assertions over increasing a percentage by itself. Generated
coverage output is local-only and ignored by Git.

## Known Test Gaps

- No automated real-browser UI tests.
- No automated audio perceptual comparison.
- No automated browser PNG pixel comparison with the backend PNG golden.
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
- Keep grammar help pointed at the localized docs-site home under `/docs/`,
  not as an in-app grammar panel.
- Keep detailed docs-site quality and authoring rules in `docs-site/docs/`.
- Do not import backend modules from `src/web/`.

PNG, WAV, and MP3 are supported in the browser through browser-specific
adapters. Do not remove those features because the backend also supports them.
