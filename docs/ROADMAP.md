# Risks And Future Work

This document tracks known risks and possible future work. It is not a release
commitment.

## Risks

- No risks have been identified yet.

## Future Features

- Pagination export refinements:
  - Paper presets such as A4, Letter, and A5, with orientation:
    - Define a shared preset table with width and height values in renderer
      units.
    - Model portrait and landscape as page-size resolution, not as a separate
      layout feature.
    - Add CLI options for selecting a preset and orientation while preserving
      explicit `--page-width` and `--page-height` overrides.
    - Add frontend controls that reuse the same preset labels, dimensions, and
      orientation values.
    - Document how presets and orientation interact with custom page size
      values.
    - Keep exported SVG page boundaries and PDF page dimensions aligned.
    - Verify SVG, PNG, and PDF output dimensions for each supported preset and
      orientation.
  - Optional page headers, footers, and page numbers:
    - Define page metadata fields separately from the score header so page
      furniture can be enabled without changing score content.
    - Add renderer support for first-page-only, every-page, and disabled header
      behavior.
    - Add footer and page-number placement that respects margins.
    - Add CLI and frontend options for page numbers and simple header/footer
      text.
    - Verify multi-page PDF output and exported SVG page groups include the
      expected text on the intended pages.
  - Manual page breaks and simple orphan-line avoidance:
    - Choose source syntax or renderer-only control for manual page breaks.
    - If source syntax is added, update grammar docs, parser tests, and
      docs-site references in both languages.
    - Teach pagination to start a new page at explicit break markers.
    - Add an orphan-line rule that moves a final short line to the next page
      when doing so improves page balance.
    - Verify explicit breaks, automatic breaks, and orphan avoidance with
      focused renderer snapshots.
  - Stronger keep-together behavior for multi-voice groups and attached lyrics:
    - Identify the score units that must remain together during pagination.
    - Extend layout measurement so a keep-together group can be measured before
      deciding whether to place it on the current page.
    - Keep lyrics attached to their notation when deciding page breaks.
    - Define fallback behavior for groups taller than a single page.
    - Verify multi-voice and lyric-heavy examples do not split attached content
      across page boundaries unless unavoidable.
  - Optional split per-page SVG or PNG export:
    - Add backend export helpers that can emit one file per rendered page.
    - Define output naming for page files, including zero-padding and collision
      behavior.
    - Add CLI options for split output and document how `-o` is interpreted.
    - Consider frontend download behavior, such as a zip file or sequential
      downloads, before exposing the browser UI.
    - Verify page count, filenames, and per-page dimensions for SVG and PNG
      outputs.
  - Print-friendly HTML output or browser print view:
    - Decide whether this is a generated export target or a frontend-only print
      mode.
    - Map rendered pages to CSS page boxes with predictable page breaks.
    - Ensure print styling uses the same color, background, page size, margin,
      and pagination options as visual export.
    - Add a frontend command that opens print view without disrupting the editor
      state.
    - Verify print preview manually until real-browser print automation exists.

- Frontend warnings:
  - Frontend warnings for overwide measures or visual lines:
    - Detect when a single-track or labeled-track measure or visual line has a
      natural width that exceeds the current page width.
    - Treat single-track overwidth as a lower-severity readability warning
      because automatic wrapping or scaling can still make the phrase harder to
      follow.
    - Treat multi-track overwidth as a stronger warning because one track may
      wrap or scale differently from neighboring tracks, making simultaneous
      voices harder to compare.
    - Suggest widening the page, reducing dense notation in that measure, or
      inserting source line breaks at matching measure boundaries across tracks.
    - Surface the warning near preview/export settings without blocking valid
      rendering.
    - Verify the warning appears for dense single-track and multi-track examples
      and stays hidden for ordinary scores that fit the current page width.
  - Frontend warnings for page heights that force excessive pagination:
    - Define warning thresholds based on page count, content overflow, or very
      small usable page height after margins.
    - Surface warnings near export settings without blocking valid exports.
    - Keep warnings synchronized with renderer diagnostics when possible.
    - Add source-level checks for warning calculation and frontend production
      build coverage.
    - Verify warnings appear for pathological page settings and stay hidden for
      normal scores.
