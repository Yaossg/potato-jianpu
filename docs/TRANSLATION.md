# Translation And Localization

This document defines translation rules for bilingual project documentation.
Use it when editing paired English and Simplified Chinese user-facing content,
especially the docs-site grammar reference.

## Paired Docs-Site Pages

English and Simplified Chinese docs-site pages should stay structurally aligned.
When grammar behavior changes, update both locale pages in the same change
unless the change is only correcting language in one locale.

Keep section order, examples, and coverage parallel between paired pages. The
Chinese page does not need to translate every English sentence literally, but it
should document the same user-visible behavior.

## Docs Site Translations

Docs-site-specific translation rules live in `docs-site/docs/TRANSLATION.md`.

## Web App Translations

The browser app keeps user-visible UI labels in `src/web/i18n.ts`.

When adding, removing, or renaming a `TranslationKey`, update both the English
and Simplified Chinese `translations` entries in the same change. Do not rely on
the English fallback for new UI text. The `zh` translation table is intentionally
typed as a complete `Record<TranslationKey, string>` so `pnpm run check` catches
missing Chinese copy.

When adding frontend controls, settings, export options, dialog text, status
messages, or toolbar/menu labels, include the corresponding Chinese text before
finishing the change. If a new recurring UI term is introduced, choose the
Chinese wording here or near the related docs and reuse it consistently.

## Tone And Audience

Write grammar documentation for score authors, not parser implementers.

Avoid parser-internal wording such as return shapes, raw AST field names, or
implementation diagnostics unless those details are genuinely useful to people
writing `.jpu` scores.

Prefer clear, direct explanations over implementation history. Use examples
when they clarify notation.

## Terminology

Use consistent Simplified Chinese terminology across docs:

- Translate the grammar concept "header" as "文件头", not "标题区".
- Keep syntax tokens, labels, and literal score text unchanged inside code
  spans.
- Keep file extensions such as `.jpu` unchanged.

When adding a new recurring term, choose one Chinese translation and reuse it
throughout the related page.
