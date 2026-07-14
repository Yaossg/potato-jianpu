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
pnpm run web:app
```

`pnpm run build` emits backend CLI and shared library modules in `dist/`.
`pnpm run web:build` emits the browser application and builds the documentation
site under `dist-web/docs/`. `pnpm run web:app` builds only the browser
application without the documentation subsite.

## Verification

```sh
pnpm run check
pnpm run test
pnpm run test:coverage
pnpm run web:build
```

`pnpm run test` builds the backend TypeScript output, runs Node tests, and
includes the frontend production-build smoke test.

`pnpm run check` type-checks the TypeScript source without emitting build
output. `pnpm run web:build` is the focused production build command for the
browser app and documentation site; it is also exercised by the frontend smoke
test in `pnpm run test`.

`pnpm run test:coverage` generates a local HTML report at
`coverage/index.html`. It runs the parser, renderer, player, backend, examples,
and package tests and remaps coverage to shared source files. It intentionally
omits the CLI integration and frontend smoke tests, so run `pnpm run test` for
the complete suite. Coverage excludes `dist/`, `dist-web/`, the bundled
TinySynth adapter, and test files; it does not upload reports or enforce
thresholds. See `docs/QUALITY.md` for the coverage policy.

Docs-site-specific commands live in `docs-site/docs/COMMANDS.md`.

## CLI Smoke Tests

```sh
pnpm run cli -- --version
pnpm run cli -- validate examples/twinkle.jpu
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --paper a4 --paginate
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --paper a4 --paginate --split-pages
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png --paper a4 --paginate
pnpm run cli -- export-pdf examples/twinkle.jpu -o twinkle.pdf --paper a4 --paginate
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3
```

## Grammar Reference Generation

```sh
pnpm run grammar:railroad
```

Run this after updating `docs/grammar.ebnf` or grammar behavior documented in
the generated railroad references. If the behavior is user-facing, also update
the relevant docs-site MDX pages; see `docs-site/docs/COMMANDS.md` for
docs-site verification.

## Release-Oriented Checks

```sh
npm pack --dry-run --json
```

Inspect the package file list manually after this command.
