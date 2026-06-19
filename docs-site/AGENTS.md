# docs-site/AGENTS.md

This file gives local instructions for agents working inside `docs-site/`.
The repository root is still the project root, and the root `AGENTS.md`
continues to apply.

Use this file together with:

- `docs/DOCUMENTATION.md` for docs-site authoring policy.
- `docs/COMMANDS.md` for docs-site command references.
- `docs/TRANSLATION.md` for docs-site bilingual terminology and alignment
  rules.

If a docs-site convention changes, update the relevant file under
`docs-site/docs/`. Root `docs/` should usually keep only a mention or pointer.

## Scope

`docs-site/` is the Astro Starlight documentation site for Modern Jianpu
Markup. It builds the primary user-facing documentation from MDX content and is
served as the frontend subsite at `/docs/`.

Important local paths:

- `astro.config.mjs`: Starlight configuration, locales, sidebar, base path, and
  output directory.
- `src/content/docs/`: English MDX docs at the collection root.
- `src/content/docs/zh/`: Simplified Chinese MDX docs.
- `src/content.config.ts`: Starlight content schema, including required
  `docId`.
- `src/components/`: MDX/Astro components for examples, tokens, support
  matrices, and related links.

## Content Rules

- Follow `docs/DOCUMENTATION.md` for local content rules.
- Follow `docs/TRANSLATION.md` for bilingual terminology and alignment.

## MDX Examples And Components

Use `docs/DOCUMENTATION.md` for MDX example conventions and component usage.

## Navigation And Links

- Update `astro.config.mjs` whenever adding or removing top-level docs pages.
- Starlight sidebar translation keys must use the configured language tag,
  such as `zh-CN`, not the locale directory name `zh`.
- For links in MDX component props, use relative docs links that resolve from
  the current page URL.
- Run the checks in `docs/COMMANDS.md` after navigation changes.

## Verification

Use `docs/COMMANDS.md` for local docs-site verification commands.

For frontend integration changes involving the Help button or production output,
also run:

```sh
pnpm run web:build
pnpm run test
```

## Boundaries

- Do not edit generated output under `../dist-web/`.
- Do not add browser automation dependencies for docs checks.
- Keep root `docs/` focused on project-level documentation. Put docs-site
  details under `docs-site/docs/`.
