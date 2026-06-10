# Release And Distribution

This document describes the current release shape.

## Build Outputs

The project produces two build outputs:

- `dist/`: Node-compatible backend CLI and shared library modules.
- `dist-web/`: static frontend web application, including the Astro Starlight
  documentation site under `dist-web/docs/`.

The backend build is created with:

```sh
pnpm run build
```

The backend build uses `tsconfig.build.json` and intentionally excludes
`src/web/`. Browser source is bundled only through the frontend build.

The frontend build is created with:

```sh
pnpm run web:build
```

`pnpm run web:build` runs the Vite app build and then builds the documentation
site into the `docs/` subdirectory of the frontend output. Use
`pnpm run web:app` only when intentionally building the browser app without the
documentation subsite.

The full verification command is:

```sh
pnpm run test
```

`pnpm run test` builds the backend TypeScript output, runs all Node tests, and
includes a frontend production-build smoke test.

## Backend CLI Package

The package is currently marked `"private": true`. The current release shape is
therefore repository-local distribution: build the backend and frontend outputs
from this repository and use the generated `dist/` and `dist-web/` artifacts.

Publishing to npm is intentionally deferred. Before enabling npm publication,
remove `"private": true`, confirm package naming/versioning, and add an explicit
publish workflow.

`package.json` exposes the backend CLI binary:

```json
{
  "bin": {
    "jianpu": "./dist/cli/main.js"
  }
}
```

The package also exports shared library entry points:

- `modern-jianpu-markup`
- `modern-jianpu-markup/core`
- `modern-jianpu-markup/parser`
- `modern-jianpu-markup/renderer`
- `modern-jianpu-markup/player`
- `modern-jianpu-markup/backend`

The release file allow-list currently includes:

- `dist/`
- `dist-web/`
- `docs/`
- `docs-site/`
- `examples/`
- `README.md`
- `AGENTS.md`
- `package.json`

## Frontend Deployment

The frontend edition is a static Vite build. Deploy the contents of
`dist-web/` to any static hosting target. The documentation subsite is served
from `/docs/` within the same static output.

The frontend exposes SVG, PNG, MIDI, WAV, and MP3 download. Frontend PNG export
is a browser canvas adapter over the rendered SVG. Frontend WAV and MP3 export
render audio with browser `OfflineAudioContext`; MP3 encoding is bundled into
the frontend.

## Pre-Release Checklist

Before cutting a release:

- Use the package manager recorded in `package.json` (`pnpm@8.10.3`).
- Run `pnpm install`.
- Run `pnpm run test`.
- Run `pnpm run web:build` if not already covered by the test output being
  inspected.
- When docs-site content changed, run the checks listed in
  `docs-site/docs/COMMANDS.md`.
- Run `npm pack --dry-run --json` and inspect the file list. The package should
  include `dist/` backend/library output, `dist-web/` static frontend and docs
  output, and `docs-site/` documentation source, but not `dist/web/`
  browser-source compiler output.
- Check `git status --short`.
- Confirm `package.json` versioning and release notes.
- Confirm `pnpm run cli -- --version` prints the intended package version.
- Smoke test the CLI with at least one example input.
- Smoke test the static frontend build in a browser.

Browser-level frontend automation is still a remaining task. Until that exists,
the final browser smoke test is manual.
