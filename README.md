# Modern Jianpu Reloaded

This is the rewrite workspace for Modern Jianpu Markup.

Current status:

- hand-written tokenizer/parser
- shared core document model
- CLI with `parse`, `validate`, `export-svg`, `export-png`, `export-midi`, and `export-wav`
- backend WAV export
- frontend web preview with SVG, PNG, and MIDI export
- browser playback with current-note highlighting and click-to-play preview notes
- example scores in `examples/`
- Node built-in test runner for parser, renderer, player, backend, CLI, and examples

## Commands

```sh
pnpm install
pnpm run build
pnpm run check
pnpm run test
pnpm run cli -- --version
pnpm run cli -- validate path/to/score.jp
pnpm run cli -- validate path/to/score.jp --json
pnpm run cli -- parse path/to/score.jp --json
pnpm run cli -- export-svg examples/twinkle.jp -o twinkle.svg --page-width 1000 --color "#111827" --background "#ffffff"
pnpm run cli -- export-png examples/twinkle.jp -o twinkle.png --page-width 1000 --color "#111827" --background "#ffffff"
pnpm run cli -- export-midi examples/twinkle.jp -o twinkle.mid --program 0
pnpm run cli -- export-wav examples/twinkle.jp -o twinkle.wav --program 0 --sample-rate 44100 --amplitude 1
pnpm run dev
pnpm run web:build
```

This repository records `pnpm@8.10.3` in `package.json` as the expected package
manager.

## Built Outputs

`pnpm run build` emits the backend CLI and shared library modules in `dist/`.
The package metadata exposes `jianpu` as the CLI binary and exports the shared
core, parser, renderer, player, and backend modules.

`pnpm run web:build` emits the browser application in `dist-web/`.

Implementation is intentionally incremental. See `PLAN.md` for the full rewrite
plan. Syntax is documented in `docs/GRAMMAR.md`, renderer behavior in
`docs/RENDERER.md`, player behavior in `docs/PLAYER.md`, and export behavior in
`docs/EXPORTS.md`. Module boundaries are documented in `docs/ARCHITECTURE.md`,
compatibility notes are in `docs/COMPATIBILITY.md`, and release shape is
documented in `docs/RELEASE.md`.
