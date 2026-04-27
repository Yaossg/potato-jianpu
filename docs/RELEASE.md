# Release And Distribution

This document describes the current release shape for the reloaded
implementation.

## Build Outputs

The project produces two independent build outputs:

- `dist/`: Node-compatible backend CLI and shared library modules.
- `dist-web/`: static frontend web application.

The backend build is created with:

```sh
pnpm run build
```

The frontend build is created with:

```sh
pnpm run web:build
```

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

- `modern-jianpu-reloaded`
- `modern-jianpu-reloaded/core`
- `modern-jianpu-reloaded/parser`
- `modern-jianpu-reloaded/renderer`
- `modern-jianpu-reloaded/player`
- `modern-jianpu-reloaded/backend`

The release file allow-list currently includes:

- `dist/`
- `dist-web/`
- `docs/`
- `examples/`
- `README.md`
- `PLAN.md`
- `package.json`

## Frontend Deployment

The frontend edition is a static Vite build. Deploy the contents of
`dist-web/` to any static hosting target.

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
- Check `git status --short` in `reloaded/`.
- Confirm `package.json` versioning and release notes.
- Confirm `pnpm run cli -- --version` prints the intended package version.
- Smoke test the CLI with at least one example input.
- Smoke test the static frontend build in a browser.

Browser-level frontend automation is still a remaining task. Until that exists,
the final browser smoke test is manual.
