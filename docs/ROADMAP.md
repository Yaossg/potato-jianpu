# Risks And Future Work

This document tracks known risks and possible future work. It is not a release
commitment.

## Higher Priority

- Improve parser diagnostics and recovery for additional invalid score-token
  sequences and header edge cases discovered during testing. Treat spaced and
  unspaced score input uniformly; whitespace must not create a separate syntax
  mode.
- Validate TinySynth WAV/MP3 quality and performance on longer scores in both
  backend and browser exporters.
- Review frontend responsive layout manually in real browsers when UI structure
  changes.
- Keep `docs/grammar.ebnf` and the docs-site grammar reference aligned whenever
  grammar behavior changes.

## Renderer Risks

- Dense chords can still create difficult spacing cases.
- Long ties can stress wrapping and collision avoidance.
- Long labels can consume horizontal space.
- Very narrow page widths can still produce visually poor output.
- Pagination and multi-page output are not implemented.
- More sophisticated note-level horizontal re-spacing remains future work.

## Optional Future Features

- Velocity syntax.
- Per-track program, volume, pan, or tempo controls.
- Richer drum controls.
- Optional npm publication after package policy is decided.
- Optional favicon/static asset polish.
- Optional browser-level automation after dependency policy changes.
