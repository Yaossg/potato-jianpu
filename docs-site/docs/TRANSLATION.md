# Docs Site Translation

This document defines translation rules for the Starlight MDX documentation
site. Project-level translation rules stay in `../../docs/TRANSLATION.md`.

## Paired MDX Pages

- English pages live under `src/content/docs/`.
- Simplified Chinese pages live under `src/content/docs/zh/`.

For docs-site pages:

- Match English and Simplified Chinese paths.
- Keep frontmatter `docId` values identical across translations.
- Keep each `docId` unique within each locale. Use a stable semantic id that
  follows the page purpose rather than the translated title.
- For pages with second-level or deeper headings, keep frontmatter
  `sectionIds` values identical across translations. These stable section keys
  describe the semantic heading sequence, while visible heading text remains
  translated. Use lowercase kebab-case section keys and keep them unique within
  each page; `docs:i18n` enforces this shape.
- Keep headings and examples structurally aligned unless a locale-specific
  wording change genuinely improves clarity. `docs:i18n` checks heading level
  parity, `sectionIds` parity, and `sectionIds` validity, so translating
  heading text is fine but adding, removing, or reordering sections on only one
  side is not.
- Keep MDX component usage structurally aligned. `docs:i18n` checks component
  sequence, any remaining `jpu` fenced-example status sequence, and
  source-backed Jianpu component status/source parity, so adding previews,
  related links, diagrams, matrices, or examples usually requires the paired
  page to receive the same structural change.
- Keep `.jpu` source strings inside `JianpuSource`, `JianpuExample`, and
  `ScorePreview` aligned across English and Simplified Chinese pages. Translate
  surrounding labels and descriptions, but keep the score source itself the
  same unless a locale-specific example is intentionally needed.
- Translate user-visible component props such as `title`, `ariaLabel`,
  `description`, visible link labels, and matrix feature text on Simplified
  Chinese pages. `JianpuExample.astro`, `JianpuSource.astro`, and
  `ScorePreview.astro`, and `SupportMatrix.astro` provide locale-aware
  defaults for status, copy, fallback preview, feature-column, and boolean
  labels; override `statusLabel`, `copyLabel`, `copiedLabel`, `ariaLabel`,
  `featureLabel`, `yesLabel`, or `noLabel` only when a page needs a more
  specific label. Keep structural props such as
  `.jpu` `source` strings, railroad rule names, support-matrix feature `id`
  values, and `href` targets aligned with the English page.
  `docs:i18n` fails on Simplified Chinese pages that repeat those localized
  defaults or accidentally use the English default labels.
- Keep token strings inside `SyntaxTokenGrid` aligned across translations.
  Translate the labels and descriptions, but do not change the token list on
  only one side.
- Keep `RelatedLinks` targets aligned across translations. Translate link
  labels and descriptions, but do not point the English and Simplified Chinese
  pages at different destinations unless the content itself is intentionally
  locale-specific.
- Keep `RailroadDiagram` rule coverage aligned across translations. Translate
  captions, but use the same generated grammar rule names on paired pages.
  `docs:i18n` also checks that referenced rules exist in the generated railroad
  data.
- Keep `SupportMatrix` rows aligned across translations. Translate visible
  feature labels and column labels, but keep each feature row's stable `id`,
  column key sequence, and support values aligned.
- Run `pnpm run docs:i18n` after adding, moving, or renaming pages.

## Manual Review Checklist

`docs:i18n` catches structural drift, but it cannot prove that the translated
prose carries the same meaning. When changing either language, manually check
the paired page for:

- The same user task, syntax rule, warning, or error is explained in the same
  section.
- Defaults, accepted values, invalid cases, and diagnostic severity are not
  weakened, broadened, or contradicted in translation.
- Examples are introduced with matching intent, even when visible labels are
  localized.
- Cross-links point to the same next step and use localized labels that match
  the destination page.
- Product names, syntax tokens, grammar rule names, command names, and `.jpu`
  source text stay literal where the English page uses them as literals.
- New terminology follows the glossary below and is reused consistently on
  related pages.

## Terminology

- Translate the grammar concept "header" as "文件头", not "标题区".
- Keep syntax tokens, labels, literal score text, and `.jpu` file extensions
  unchanged inside code spans and examples.
- In `astro.config.mjs`, Starlight sidebar `translations` keys must use
  language tags such as `zh-CN`, not locale directory names such as `zh`.

When adding a recurring term, choose one Simplified Chinese translation and
reuse it throughout the related pages.
