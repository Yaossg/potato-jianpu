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
  - Simple orphan-line avoidance:
    - Add an orphan-line rule that moves a final short line to the next page
      when doing so improves page balance.
    - Verify automatic breaks and orphan avoidance with focused renderer
      snapshots.
  - Stronger keep-together behavior for multi-voice groups and attached lyrics:
    - Identify the score units that must remain together during pagination.
    - Extend layout measurement so a keep-together group can be measured before
      deciding whether to place it on the current page.
    - Keep lyrics attached to their notation when deciding page breaks.
    - Define fallback behavior for groups taller than a single page.
    - Verify multi-voice and lyric-heavy examples do not split attached content
      across page boundaries unless unavoidable.
  - Print-friendly HTML output or browser print view:
    - Decide whether this is a generated export target or a frontend-only print
      mode.
    - Map rendered pages to CSS page boxes with predictable page breaks.
    - Ensure print styling uses the same color, background, page size, margin,
      and pagination options as visual export.
    - Add a frontend command that opens print view without disrupting the editor
      state.
    - Verify print preview manually until real-browser print automation exists.
