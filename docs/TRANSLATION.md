# Translation And Localization

This document defines translation rules for bilingual project documentation.
Use it when editing paired English and Simplified Chinese user-facing content,
especially the grammar references.

## Paired Grammar References

The English and Simplified Chinese grammar references should stay structurally
aligned:

- `public/grammar.html`
- `public/grammar.zh.html`

When grammar behavior changes, update both pages in the same change unless the
change is only correcting language in one locale.

Keep section order, examples, and coverage parallel between the two pages. The
Chinese page does not need to translate every English sentence literally, but it
should document the same user-visible behavior.

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
