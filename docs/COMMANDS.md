# Command Reference

This document lists common repository commands. It is a command reference, not
a workflow checklist.

Use pnpm. The package manager version is pinned in `package.json`.

## Setup

```sh
pnpm install
```

## Development

```sh
pnpm run dev
pnpm run build
pnpm run web:build
```

`pnpm run build` emits backend CLI and shared library modules in `dist/`.
`pnpm run web:build` emits the browser application in `dist-web/`.

## Verification

```sh
pnpm run check
pnpm run test
pnpm run web:build
```

`pnpm run test` builds the backend TypeScript output, runs Node tests, and
includes the frontend production-build smoke test.

## CLI Smoke Tests

```sh
pnpm run cli -- --version
pnpm run cli -- validate examples/twinkle.jpu
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3
```

## Grammar Reference Generation

```sh
pnpm run grammar:railroad
```

Run this after updating `docs/grammar.ebnf` or grammar behavior documented in
the generated railroad references.

## Release-Oriented Checks

```sh
npm pack --dry-run --json
```

Inspect the package file list manually after this command.
