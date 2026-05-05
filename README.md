# Modern Jianpu Markup

Modern Jianpu Markup is a TypeScript toolkit and browser app for parsing,
rendering, playing, and exporting Jianpu scores.

Current status:

- hand-written tokenizer/parser
- shared core document model
- CLI with `parse`, `validate`, `export-svg`, `export-png`, `export-midi`, `export-wav`, and `export-mp3`
- backend WAV and MP3 export
- frontend web preview with SVG, PNG, MIDI, WAV, and MP3 export
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
pnpm run cli -- validate path/to/score.jpu
pnpm run cli -- validate path/to/score.jpu --json
pnpm run cli -- parse path/to/score.jpu --json
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --page-width 1000 --color "#111827" --background "#ffffff"
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png --page-width 1000 --color "#111827" --background "#ffffff"
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid --program 0
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav --program 0 --sample-rate 44100 --amplitude 1
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3 --program 0 --sample-rate 44100 --amplitude 1 --bit-rate 128
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

See `AGENTS.md` for repository handoff notes. Syntax is documented in
`public/grammar.html`, renderer behavior in
`docs/RENDERER.md`, player behavior in `docs/PLAYER.md`, and export behavior in
`docs/EXPORTS.md`. Module boundaries are documented in `docs/ARCHITECTURE.md`,
and release shape is documented in `docs/RELEASE.md`. The frontend build also includes
`grammar.html`, a detailed grammar reference with railroad diagrams generated
from `docs/grammar.ebnf`.
