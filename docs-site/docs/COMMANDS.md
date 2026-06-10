# Docs Site Commands

Run these from the repository root unless noted otherwise.

## Development

```sh
pnpm run docs:dev
```

This starts the Astro Starlight development server for `docs-site/`.

## Verification

```sh
pnpm run docs:i18n
pnpm run docs:examples
pnpm run docs:links
pnpm run docs:check
pnpm run docs:build
```

- `docs:i18n`: checks English and Simplified Chinese MDX paths and `docId`
  values.
- `docs:examples`: builds the parser and validates `jpu valid`, `jpu warning`,
  and `jpu invalid` fenced examples.
- `docs:links`: checks internal docs links used in MDX `href` entries.
- `docs:check`: runs Astro diagnostics.
- `docs:build`: builds the Starlight site to `dist-web/docs/`.

For frontend integration changes involving the Help button or production
output, also run:

```sh
pnpm run web:build
pnpm run test
```

`pnpm run docs:check` currently may surface the known unrelated TypeScript hint
for `src/renderer/score.ts` `allNotes`.
