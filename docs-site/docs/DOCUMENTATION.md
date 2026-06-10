# Docs Site Documentation

This document describes how to maintain the Astro Starlight documentation site
under `docs-site/`. Project-level documentation policy stays in
`../../docs/DOCUMENTATION.md`.

## Content Locations

- `src/content/docs/`: English MDX documents.
- `src/content/docs/zh/`: Simplified Chinese MDX documents.
- `src/components/`: reusable Astro components for MDX pages.
- `astro.config.mjs`: Starlight locales, sidebar, base path, and output
  settings.
- `src/content.config.ts`: Starlight content schema, including required
  `docId`.

## Content Rules

- Keep docs user-facing. Explain how to write, preview, play, validate, and
  export `.jpu` scores.
- Document current behavior rather than implementation history.
- Avoid parser-internal wording unless it helps score authors understand a
  diagnostic or rule.
- Use `.jpu` for score examples and filenames.
- Do not imply that `||` is a standalone final-barline or score-ending syntax.
  It may appear only when documenting consecutive bar tokens that create an
  empty-measure warning.

## MDX Examples

Use fenced code blocks with explicit expected parser behavior:

~~~md
```jpu valid
1 2 3 4
```

```jpu warning
1 2
```

```jpu invalid
1 2 ? 3
```
~~~

Rules:

- `jpu valid` examples must parse without warnings.
- `jpu warning` examples must parse and produce at least one warning.
- `jpu invalid` examples must fail to parse.
- Prefer `JianpuExample.astro` for warning and invalid examples that need a
  title or explanation.

## Components

Prefer local components instead of ad hoc repeated markup:

- `JianpuExample.astro` for labeled valid/warning/invalid score examples.
- `SyntaxToken.astro` for inline syntax markers when visual consistency helps.
- `SupportMatrix.astro` for feature support tables.
- `RelatedLinks.astro` for curated page-to-page navigation.

Keep component props simple and serializable in MDX. Do not add client-side
interactivity unless the user explicitly asks for it.

## Navigation

- Update `astro.config.mjs` whenever adding or removing top-level docs pages.
- Keep sidebar labels and translations user-facing and current.
- For links in MDX component props, use relative docs links that resolve from
  the current page URL.
- Run `pnpm run docs:links` after changing `href` values.

## Boundaries

- Do not remove `../../public/grammar.html` or `../../public/grammar.zh.html` unless
  the user explicitly asks.
- Do not edit generated output under `../../dist-web/`.
- Do not add browser automation dependencies for docs checks.
