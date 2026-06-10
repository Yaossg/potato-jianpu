# Docs Site Translation

This document defines translation rules for the Starlight MDX documentation
site. Project-level translation rules stay in `../../docs/TRANSLATION.md`.

## Paired MDX Pages

- English pages live under `src/content/docs/`.
- Simplified Chinese pages live under `src/content/docs/zh/`.

For docs-site pages:

- Match English and Simplified Chinese paths.
- Keep frontmatter `docId` values identical across translations.
- Keep headings and examples structurally aligned unless a locale-specific
  wording change genuinely improves clarity.
- Run `pnpm run docs:i18n` after adding, moving, or renaming pages.

## Terminology

- Translate the grammar concept "header" as "文件头", not "标题区".
- Keep syntax tokens, labels, literal score text, and `.jpu` file extensions
  unchanged inside code spans and examples.
- In `astro.config.mjs`, Starlight sidebar `translations` keys must use
  language tags such as `zh-CN`, not locale directory names such as `zh`.

When adding a recurring term, choose one Simplified Chinese translation and
reuse it throughout the related pages.
