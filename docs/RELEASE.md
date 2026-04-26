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

The frontend intentionally excludes backend-only PNG, WAV, and MP3 export
surfaces. It exposes SVG and MIDI download only.

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
