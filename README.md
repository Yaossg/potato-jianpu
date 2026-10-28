# Modern Jianpu Markup

Modern Jianpu Markup is a TypeScript toolkit and browser app for parsing,
rendering, playing, and exporting Jianpu scores.

Current status:

- hand-written tokenizer/parser
- shared core document model
- CLI with `parse`, `validate`, `export-svg`, `export-png`, `export-pdf`, `export-midi`, `export-wav`, and `export-mp3`
- backend WAV and MP3 export
- frontend web preview with SVG, PNG, PDF, MIDI, WAV, and MP3 export
- frontend `.jpu` open/save
- browser playback with current-note highlighting and click-to-play preview notes
- Astro Starlight documentation site built from MDX
- example scores in `examples/`
- Node built-in test runner for parser, renderer, player, backend, CLI, and examples

Playback and WAV/MP3 export use SpessaSynth with the bundled GeneralUser GS
2.0.3 sampled sound bank. The browser loads the approximately 32 MB bank on
first use; CLI exports use the local copy.

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
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff"
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --paper a4 --paginate --split-pages
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff" --png-scale 2
pnpm run cli -- export-pdf examples/twinkle.jpu -o twinkle.pdf --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff"
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid --program 0
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav --program 0 --sample-rate 44100 --amplitude 1
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3 --program 0 --sample-rate 44100 --amplitude 1 --bit-rate 128
pnpm run dev
pnpm run docs:dev
pnpm run web:build
pnpm run docs:build
pnpm run docs:i18n
pnpm run docs:examples
```

This repository records `pnpm@8.10.3` in `package.json` as the expected package
manager.

## Score Header

Header fields are typed and closed. Text fields stay quoted, while musical
defaults use their own value syntax:

```jpu
title: "Twinkle"
key: C
time: 4/4
tempo: 96
hidden: false
measureNumbers: true
program: 24
volume: 85%
T1.program: "Violin"
T1.volume: 0.8
P1.program: 128
===
T1: 1 1 5 5 | 6 6 5 - |
P1: X 0 X 0 | X 0 X 0 |
```

Use `program` and `volume` for score-level playback/export defaults,
`Tn.program` and `Tn.volume` for melodic track overrides, and `Pn.program` or
`Pn.volume` for P-labeled percussion tracks. The CLI and browser Program
controls remain the default for tracks without a score-level Program.

## Built Outputs

`pnpm run build` emits the backend CLI and shared library modules in `dist/`.
The package metadata exposes `jianpu` as the CLI binary and exports the shared
core, parser, renderer, player, and backend modules.

`pnpm run web:build` emits the browser application in `dist-web/` and builds
the documentation site under `dist-web/docs/`. `pnpm run docs:build` builds the
documentation site by itself at the same subpath.

See `AGENTS.md` for repository handoff notes and `docs/COMMANDS.md` for the
full command reference. User-facing syntax documentation lives in
`docs-site/src/content/docs/`; grammar railroad diagrams are generated from
`docs/grammar.ebnf`. Module boundaries are documented in
`docs/ARCHITECTURE.md`, renderer behavior in `docs/RENDERER.md`, player
behavior in `docs/PLAYER.md`, export behavior in `docs/EXPORTS.md`, quality
policy in `docs/QUALITY.md`, translation rules in `docs/TRANSLATION.md`, future
work in `docs/ROADMAP.md`, and release shape in `docs/RELEASE.md`.
