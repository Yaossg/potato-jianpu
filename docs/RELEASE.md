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

The documentation site can also be built standalone:

```sh
pnpm run docs:build
```

This builds the Starlight site to `dist-web/docs/`. Use `pnpm run docs:dev`
for the docs-site development server, and `pnpm run docs:verify` for the full
verification suite including the production build. See
`docs-site/docs/COMMANDS.md` for the complete command list.

The main automated test command is:

```sh
pnpm run test
```

`pnpm run test` builds the backend TypeScript output, runs all Node tests, and
includes a frontend production-build smoke test. Type checking and the full
docs-site checks remain separate commands; use the pre-release checklist below
for the complete release verification set. Coverage reporting is diagnostic
rather than a release gate; see `docs/QUALITY.md`.

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
- `assets/soundfonts/`
- `scripts/audio-licenses.mjs`
- `docs/`
- `docs-site/AGENTS.md`
- `docs-site/astro.config.mjs`
- `docs-site/docs/`
- `docs-site/package.json`
- `docs-site/public/`
- `docs-site/src/`
- `examples/`
- `README.md`
- `AGENTS.md`
- `package.json`

## Frontend Deployment

The frontend edition is a static Vite build. Deploy the contents of
`dist-web/` to any static hosting target. The documentation subsite is served
from `/docs/` within the same static output.

The frontend exposes SVG, split-page SVG, PNG, split-page PNG, PDF, MIDI, WAV,
MP3, and playback video download. Frontend visual exports can use shared paper presets and
orientation values. Frontend PNG export is a browser canvas adapter over the
rendered SVG. Frontend PDF export uses browser-bundled PDF generation over
rendered SVG pages. Frontend WAV and MP3 export render locally with SpessaSynth and the bundled
GeneralUser GS bank; MP3 encoding is bundled into the frontend.

The SoundFont is an approximately 32 MB asset loaded on demand. Keep
`assets/soundfonts/` with the backend distribution; Vite emits its own hashed
copy for the frontend and docs site. Preserve the SoundFont license and source
notice in distributions.

## Pre-Release Checklist

Before cutting a release:

- Use the package manager recorded in `package.json` (`pnpm@8.10.3`).
- Run `git submodule update --init` so the pinned railroad renderer is present.
- Run `pnpm install`.
- Run `pnpm run check`.
- Run `pnpm run test`.
- Run `pnpm run docs:verify`. The production docs build is also exercised by
  `pnpm run test`, but this command adds the structural, translation, link,
  table, CLI-example, and source-example checks.
- Run `npm pack --dry-run --json` and inspect the file list. The package should
  include `dist/` backend/library output, `dist-web/` static frontend and docs
  output, and docs-site documentation source, but not `dist/web/`
  browser-source compiler output, docs-site dependency folders, or docs-site
  build caches.
- Check `git status --short`.
- Confirm `package.json` versioning and release notes.
- Confirm `pnpm run cli -- --version` prints the intended package version.
- Smoke test the CLI with at least one example input.
- Smoke test the static frontend build in a browser.

The final browser smoke test is currently manual.
