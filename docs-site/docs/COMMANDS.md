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
pnpm run docs:tables
pnpm run docs:cli
pnpm run docs:check
pnpm run docs:verify
pnpm run docs:build
```

- `docs:i18n`: checks English and Simplified Chinese MDX paths, required and
  unique `docId` values, paired `docId` equality, heading structure parity,
  `sectionIds` parity, `sectionIds` validity and uniqueness, MDX component
  sequence parity, `jpu` fenced-example status sequence parity, and
  source-backed Jianpu component status/source parity. It also checks
  `RelatedLinks` href sequence parity,
  `RailroadDiagram` rule sequence parity, `RailroadDiagram` rule existence in
  generated diagram data, `SyntaxTokenGrid` token sequence parity, and
  `SupportMatrix` feature/support parity. Simplified Chinese pages are also
  checked for redundant localized component-default props and untranslated
  English component-default labels.
- `docs:examples`: builds the parser and validates source-backed
  `JianpuExample`, `JianpuSource`, and `ScorePreview` MDX components. It also
  validates any remaining `jpu valid`, `jpu warning`, or `jpu invalid` fenced
  examples; unmarked `jpu` fenced blocks fail this check.
- `docs:links`: checks internal docs links used in MDX `href` entries.
- `docs:tables`: checks Markdown tables for literal Jianpu pipe tokens that
  need escaping.
- `docs:cli`: checks documented `pnpm run cli -- ...` examples for known CLI
  commands and options.
- `docs:check`: runs structural i18n checks, internal docs-link checks,
  Markdown table pipe checks, documented CLI command checks, and Astro
  diagnostics.
- `docs:verify`: runs `docs:check`, source-backed example validation, and the
  docs-site production build.
- `docs:build`: builds the Starlight site to `dist-web/docs/`.

## Grammar And Diagrams

```sh
pnpm run grammar:railroad
```

Run this after editing `../docs/grammar.ebnf`. It refreshes the legacy railroad
HTML pages and the docs-site generated diagram data consumed by
`RailroadDiagram.astro`.

For frontend integration changes involving the Help button or production
output, also run:

```sh
pnpm run web:build
pnpm run test
```
