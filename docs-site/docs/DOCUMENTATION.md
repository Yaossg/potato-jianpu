# Docs Site Documentation

This document describes how to maintain the Astro Starlight documentation site
under `docs-site/`. Project-level documentation policy is covered by root
`AGENTS.md`, `docs/WORKFLOW.md`, and `docs/TRANSLATION.md`.

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
- Keep `docId` stable and unique. It should identify the page's documentation
  purpose and stay aligned between English and Simplified Chinese versions.
- Keep `sectionIds` stable on pages with headings. These frontmatter keys
  describe the semantic section order across translations; update the English
  and Simplified Chinese values together whenever sections are added, removed,
  or reordered. Use lowercase kebab-case values and keep them unique within the
  page so the keys stay reviewable and tool-friendly.
- Keep longer syntax pages sectioned by user task or syntax concept. Prefer
  stable second-level headings over a long unbroken page, and keep the
  corresponding `sectionIds` aligned across English and Simplified Chinese.

## Source Of Truth

Grammar information appears in several places, but they do not all have the
same job:

- Parser tests are the behavior source of truth. If a syntax rule, diagnostic,
  or edge case is user-visible, it should be proven by parser or renderer tests
  before docs describe it as supported behavior.
- `../../docs/grammar.ebnf` is the compact grammar-structure source used to
  generate railroad references. Keep it aligned with parser behavior, but do
  not treat it as a replacement for parser tests.
- `src/content/docs/` and `src/content/docs/zh/` are the primary user-facing
  explanation layer. They should explain how authors use the syntax, what
  warnings or errors mean, and where to go next.

When these sources disagree, inspect parser behavior and tests first, then
update the grammar source and user-facing docs in the same change.

## Grammar Change Checklist

When adding or changing user-visible syntax, diagnostics, rendering semantics,
playback behavior, or export behavior:

1. Update or add focused tests for the behavior.
2. Update `../../docs/grammar.ebnf` when the formal grammar shape changes.
3. Run `pnpm run grammar:railroad` when `grammar.ebnf` changes so generated
   railroad data stays current.
4. Update the relevant English and Simplified Chinese MDX pages.
5. Keep diagnostics close to the syntax topic that causes them.
6. Run `pnpm run docs:verify` for complete docs-site verification, or the
   focused checks listed in `docs-site/docs/COMMANDS.md` while iterating.

## Change-To-Docs Map

Use this map when a code change is user-visible but is not a pure grammar
change:

- Parser or diagnostic changes: update the relevant syntax page and the grammar
  reference when quick lookup changes.
- Renderer changes: update the syntax page that explains the affected notation,
  `guide/browser-app.mdx` when the browser preview workflow changes, and
  `../../docs/RENDERER.md` for implementation-facing renderer behavior.
- Playback or arrangement changes: update `guide/playback.mdx`, any affected
  syntax topic such as repeats or lyrics/tracks, and `../../docs/PLAYER.md` for
  implementation-facing playback behavior.
- Export changes: update `guide/export.mdx`, support matrices where capability
  status changes, and `../../docs/EXPORTS.md` for backend/frontend export
  behavior.
- Browser app workflow changes: update `guide/browser-app.mdx`. If the Help
  button or production output changes, run the extra frontend checks in
  `docs-site/docs/COMMANDS.md`.
- CLI workflow changes: update `guide/cli.mdx` and root
  `../../docs/COMMANDS.md` when the command reference changes.

Root `../../docs/` should hold project-facing architecture, quality, command,
release, and implementation behavior. User-facing tutorials, syntax
explanations, guide pages, and reference lookup belong in MDX under
`src/content/docs/` and `src/content/docs/zh/`.

## MDX Examples

Prefer source-backed components for user-facing `.jpu` examples:

Rules:

- Use `JianpuSource.astro` when readers should copy a valid `.jpu` source.
- Pair `JianpuSource.astro` with `ScorePreview.astro` when the rendered result
  clarifies the syntax or workflow.
- Use `JianpuExample.astro` for valid, warning, or invalid examples that need a
  title, status, or explanation.
- Component examples must use inline `source={`...`}` strings so
  `pnpm run docs:examples` can validate them.
- Fenced `jpu` code blocks are still supported by the checker for compact or
  legacy examples, but they must be marked `jpu valid`, `jpu warning`, or
  `jpu invalid`. Plain unmarked `jpu` fenced blocks are not allowed.

## Components

Prefer local components instead of ad hoc repeated markup:

- `JianpuExample.astro` for labeled valid/warning/invalid score examples.
- `JianpuSource.astro` for copy-friendly `.jpu` source examples that should be
  validated during docs builds.
- `SyntaxToken.astro` for inline syntax markers when visual consistency helps.
- `SyntaxTokenGrid.astro` for compact syntax-token overview callouts.
- `SupportMatrix.astro` for feature support tables. It provides locale-aware
  defaults for the feature column and boolean labels; pass labels only when a
  matrix needs a more specific term. Give every feature row a stable `id` so
  paired translations can be checked structurally.
- `RelatedLinks.astro` for curated page-to-page navigation.
- `RailroadDiagram.astro` for generated diagrams backed by
  `../../docs/grammar.ebnf`.
- `ScorePreview.astro` for deterministic build-time SVG previews of valid
  `.jpu` examples with client-side playback controls. It exposes an accessible
  image label from `title`, or from `ariaLabel` when a preview needs a more
  specific label without a visible caption. When neither prop is present, it
  uses an English or Simplified Chinese default based on the current page
  locale.

Keep component props simple and serializable in MDX. Do not add client-side
interactivity unless the user explicitly asks for it.

For paired English and Simplified Chinese pages, keep structural component
props aligned. `docs:i18n` checks source-backed `.jpu` examples, related-link
targets, railroad diagram rule names and generated-rule existence, syntax-token
lists, support-matrix feature ids/support values, and frontmatter `sectionIds`
so translated text can differ while navigation, examples, section structure,
feature matrices, and generated reference coverage stay in sync.

On Simplified Chinese pages, translate user-visible component text such as
`title`, `ariaLabel`, `description`, link labels, and support-matrix feature
labels. `JianpuExample.astro`, `JianpuSource.astro`, `ScorePreview.astro`, and
`SupportMatrix.astro` provide locale-aware defaults for status, copy, fallback
preview, feature-column, and boolean labels; pass `statusLabel`, `copyLabel`,
`copiedLabel`, `ariaLabel`, `featureLabel`, `yesLabel`, or `noLabel` only when
a specific label is clearer than the default. Keep structural props such as
`.jpu` `source` strings, railroad rule names, stable feature `id` values, and
`href` targets aligned with the English page.

## Navigation

- Update `astro.config.mjs` whenever adding or removing top-level docs pages.
- Keep sidebar labels and translations user-facing and current.
- For links in MDX component props, use relative docs links that resolve from
  the current page URL.
- Run `pnpm run docs:links` after changing `href` values.
- Run `pnpm run docs:i18n` after changing `RelatedLinks` so paired translations
  keep the same destination sequence.

## Boundaries

- Do not edit generated output under `../../dist-web/`.
- Do not add browser automation dependencies for docs checks.
