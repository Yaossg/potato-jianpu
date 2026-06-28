# Renderer Reference

This document describes the SVG renderer implemented in `src/renderer`.

Current renderer modules:

- `svg.ts`: top-level SVG document serialization.
- `header.ts`: title, subtitle, key, time, tempo, and composer drawing.
- `score.ts`: score, note, rest, drum, duration, bar, and tie drawing.
- `layout.ts`: measure and line layout, including page-width wrapping.
- `metrics.ts`: note width, chord height, accidental offset, and tie lookahead.
- `dimensions.ts`: shared renderer layout constants.
- `styles.ts`: inline SVG stylesheet.
- `options.ts`: public render options and defaults.
- `paper.ts`: shared paper preset dimensions and orientation-based page-size
  resolution.
- `xml.ts`: XML escaping helper.

## Public API

The renderer exports:

```ts
renderSvg(document: Document, options?: RenderOptions): string
renderSvgPages(document: Document, options?: RenderOptions): RenderedSvgPage[]
```

`document` must already be parsed. The renderer does not parse source text.

Options:

```ts
interface RenderOptions {
  pageWidth?: number;
  paginate?: boolean;
  pageHeight?: number;
  pageMargin?: number;
  pageFooter?: string;
  pageNumbers?: boolean;
  justifyMode?: "none" | "except-last" | "all";
  activeNoteIndex?: number;
  activeNoteIndices?: number[];
  color?: string;
  background?: string;
}
```

- `pageWidth` controls the SVG `width`, `viewBox` width, header layout, measure
  wrapping, and maximum visual line width. Default: `1000`.
- `paginate` switches from one adaptive-height SVG page to a fixed-height
  multi-page SVG. Default: the parsed `paginate` header value, or `false` when
  omitted.
- `pageHeight` controls each page box height when `paginate` is `true`.
  Default: `1400`.
- `pageMargin` adds an equal margin on all four page sides. The SVG viewport
  and PDF page size stay unchanged, while header layout, measure wrapping, score
  justification, and pagination use the reduced content box. Default: `0`.
- `pageFooter` sets optional page-level footer text. Default: the parsed
  `footer` header value, or empty when omitted.
- `pageNumbers` renders centered page numbers as `current / total`. Default:
  the parsed `numbering` header value, or `false` when omitted.
- `justifyMode` controls horizontal score justification. `"none"` keeps natural
  spacing, `"except-last"` justifies every visual line except the final score
  line, and `"all"` justifies every visual line. Default: `"none"`.
- `activeNoteIndex` marks one parsed note as active for frontend playback
  highlighting. Default: no active note.
- `activeNoteIndices` marks multiple parsed notes as active for simultaneous
  playback highlighting. When non-empty, it takes precedence over
  `activeNoteIndex`. Default: no active notes.
- `color` sets the root SVG `color` style used by `currentColor` notation
  elements. Default: `currentColor`.
- `background` draws page background rectangles when non-empty. In unpaginated
  output there is one adaptive-height rectangle; in paginated output there is
  one fixed-height rectangle per page. Default: no SVG background rectangle.

`renderSvg()` returns a complete SVG string with XML declaration, `<svg>`,
inline `<style>`, header graphics, and score graphics. `renderSvgPages()`
returns complete per-page SVG documents for target-specific PDF adapters.

The renderer also exports paper helpers used by the CLI and browser app:

```ts
PAPER_PRESET_LIST
PAGE_ORIENTATIONS
resolvePageSize(options)
```

Supported presets are A4 (`1190 x 1684`), B5 (`998 x 1418`), and Letter
(`1224 x 1584`) in renderer units. These dimensions intentionally use twice the
72-DPI/PDF-point page dimensions so notation keeps the default layout scale.
Future paper presets should follow the same doubled-point rule.
`resolvePageSize()` applies portrait or landscape orientation to the selected
preset, then applies explicit `pageWidth` or `pageHeight` overrides. Without a
preset it resolves the renderer default page size, `1000 x 1400`.

## Backend And Frontend Use

The same SVG renderer is used by:

- backend `export-svg`
- backend `export-png`
- backend `export-pdf`
- frontend preview
- frontend SVG download
- frontend PDF download

PNG and PDF export are not part of the renderer itself. PNG export calls
`renderSvg()` and passes the string to the backend PNG adapter in
`src/backend/png.ts`. PDF export calls `renderSvgPages()` and passes the pages
to target-specific vector PDF adapters. PDF adapters embed Noto Sans SC for
Unicode text, but the SVG renderer's normal font stacks remain unchanged.

## Layout Pipeline

The renderer follows a measurement-first pipeline:

1. Flatten all notes in document order.
2. Measure each note.
3. Build measure layouts.
4. Resolve the content box from `pageWidth`, `pageHeight`, and `pageMargin`.
5. Wrap measure layouts into visual lines based on the content width.
6. Horizontally scale any single visual line that still exceeds the content
   width.
7. Optionally justify line coordinates when `justifyMode` enables it.
8. Reserve page-adornment space for optional page footers and page numbers.
9. Optionally paginate completed visual lines into fixed-height page boxes,
   honoring manual page breaks from the parsed score.
10. Draw bars, ties, notes, duration marks, and attached lyric lines or
    syllables.
11. Compute final SVG height from either the adaptive content height or the fixed
   page height multiplied by page count.

The main internal layout records are:

```ts
interface MeasureLayout {
  measure: Measure;
  width: number;
  notePositions: number[];
  paddingUp: number;
  paddingDown: number;
}

interface LineLayout {
  line: ScoreLine;
  measures: MeasureLayout[];
  width: number;
  height: number;
  maxPaddingUp: number;
}
```

`notePositions` are x offsets within a measure before the measure-level left
padding is applied.

In labeled multi-voice groups, simultaneous tracks share measure-local rhythmic
anchors. After each track has been wrapped into visual lines, the renderer
aligns lines that cover the same measure span. When every track in a measure
has the same rhythmic anchor set, notes with the same start position are placed
at the same x coordinate. The shared coordinate uses enough horizontal advance
for the widest note or duration mark at that rhythmic position, so accidentals
and dotted notes can reserve the required space without shifting another track
off the beat. Dash extension marks are treated as their own rhythmic anchors,
so a held note's extension aligns with later notes in simultaneous tracks
instead of moving as one block with the held note head. When the tracks in a
measure do not have matching rhythmic anchors, the renderer falls back to
measure-level alignment: measure barlines align across tracks, and each track's
own measure contents are stretched to fit between those aligned barlines.

Lyric lines render below the preceding score group. A lyric string with
multiple whitespace-separated syllables is rendered as centered syllables under
the main voice note anchors when the syllable count matches the main voice note
count and the main voice occupies one rendered visual line. Otherwise it remains
a normal left-aligned lyric line. In multi-voice groups, the renderer uses `T1`
as the main voice; unlabeled lines in labeled scores also count as `T1`.

Track and lyric labels reserve horizontal space based on the rendered label
text length plus padding. Visible labels come from typed header label fields,
such as `T1.name: "Melody"`, `T1: "Melody"`, `L1.name: "Verse"`, or
`L1: "Verse"`. A group uses the widest visible label in that group, so short
labels do not consume the same left margin as long labels.

For a score with a single unlabeled music line, `T1.name` still supplies the
visible track label for that line, and `T1.program` still supplies the per-track
Program used by playback and export.

## Dimensions

Renderer dimensions are centralized in the `DIMENSIONS` object:

| Name | Value | Meaning |
| --- | ---: | --- |
| `baseNoteWidth` | `24` | Base advance per note |
| `baseNoteHeight` | `24` | Base rendered note height |
| `leftPadding` | `18` | Measure left padding before first note |
| `measureSpacing` | `0` | Extra spacing between measures |
| `lyricTopPadding` | `12` | Vertical gap before lyrics below a score group |
| `lyricLineHeight` | `20` | Vertical advance for stacked lyric lines |
| `accidentalOffset` | `10` | Horizontal space reserved for accidentals |
| `tieHeight` | `16` | Tie arc height |
| `tieCurveHeight` | `13` | Inner tie curve height |
| `tiePadding` | `24` | Tie vertical offset above notes |
| `octaveSpacing` | `5` | Distance between octave dots |
| `noteBottomPadding` | `10` | Baseline padding below notes |
| `underlineSpacing` | `5` | Vertical distance between duration underlines |
| `dotSpacing` | `12` | Horizontal spacing for duration dots |
| `dashSpacing` | `24` | Horizontal spacing for extension dashes |
| `lineSpacing` | `10` | Vertical spacing after each visual line |

These constants are not yet exposed as a public theme API.

## Page Width And Wrapping

The renderer wraps between measures. A visual line accumulates measures until
adding the next measure would exceed the content width, which is `pageWidth`
minus the left and right page margins.

Important details:

- wrapping never splits a measure internally
- source line breaks are preserved as natural line boundaries
- a single measure wider than the content width remains on its own line and is
  horizontally scaled to fit the content box
- `pageWidth` also sets the SVG viewport width
- `pageMargin` shifts rendered header and score content inward without changing
  the SVG viewport width

The CLI exposes direct dimensions and paper presets through:

```sh
pnpm run cli -- export-svg input.jpu -o output.svg --page-width 800 --page-margin 40
pnpm run cli -- export-svg input.jpu -o output.svg --paper a4 --orientation landscape --paginate
pnpm run cli -- export-png input.jpu -o output.png --page-width 800 --page-margin 40
pnpm run cli -- export-pdf input.jpu -o output.pdf --page-width 800 --page-margin 40
```

The frontend exposes this through the Settings panel. Panel width mode measures
the preview panel with `ResizeObserver` and uses the available panel width as
the render `pageWidth`. Content width mode uses `inferContentPageWidth()` to
estimate the unwrapped natural score width from the current document. Manual
mode keeps an explicit numeric width for preview and export. Selecting A4, B5,
or Letter resolves both width and height from the shared preset table and
orientation, while Custom keeps the panel, content, and manual width modes
available. The preview panel also uses responsive CSS so a wide exported page
scales down visually instead of forcing horizontal page overflow.

When score justification is enabled, selected visual lines are stretched to the
available content width by remapping horizontal coordinates. The `"except-last"`
mode skips the final score line; `"all"` includes it. The remapping uses beat
groups: notes inside one beat group, such as a continuous underlined run, keep
their natural internal spacing and move as one unit. This affects notes, bars,
ties, dashes, underlines, and duration dots together. It is independent of
whether the line was created by source line breaks or automatic wrapping.
Overwide lines still use line-level scaling instead of additional position
stretching.

## Pagination

By default the renderer keeps the original adaptive-height SVG behavior. When
`paginate` is `true`, output becomes one SVG containing vertically stacked page
groups:

```svg
<g class="page" data-page="1" transform="translate(0, 0)">...</g>
<g class="page" data-page="2" transform="translate(0, 1400)">...</g>
```

Each page uses the fixed `pageWidth x pageHeight` page box, and the root SVG
height is `pageHeight * pageCount`. When `pageMargin` is non-zero, content is
drawn inside a translated `.page-content` group and pagination uses
`pageHeight - pageMargin * 2` as the usable page height. Pagination only occurs
between completed visual lines; it does not split measures, wrapped visual
lines, lyrics attached to a score group, or simultaneous voice groups within
one visual line. The header renders only on the first page and consumes
first-page vertical space. If a visual line is taller than the available page
height, it is placed at the top content inset of a new page without vertical
compression.

A score line containing only `---` marks a manual page break. When `paginate`
is `true`, the next score line starts on a new page. Manual breaks do not
render visible marks, and they do not affect unpaginated adaptive-height SVG
layout. In labeled multi-voice scores, a manual break must appear before `T1`
so the voice group stays together.

Paginated output draws one `.page-boundary` rectangle per page so the exported
SVG and PNG visibly show page edges. When a background color is provided, it
also draws one `.page-background` rectangle per page at the page's root SVG y
coordinate.

Page-level rendering defaults can come from parsed header fields or render
options. `paginate` enables fixed-height pages, `pageFooter` draws footer text
at the bottom-left page margin, and `pageNumbers` draws centered
`current / total` numbering. Render options override header values for one
render. When page adornments are enabled, the renderer reserves vertical
content space so notation does not overlap them; their text still uses
`currentColor`.

The CLI exposes pagination through:

```sh
pnpm run cli -- export-svg input.jpu -o output.svg --paginate --page-height 1400
pnpm run cli -- export-png input.jpu -o output.png --paginate --page-height 1400
pnpm run cli -- export-pdf input.jpu -o output.pdf --paginate --page-height 1400
pnpm run cli -- export-pdf input.jpu -o output.pdf --paginate --page-footer "modern-jianpu" --page-numbers
```

## Header Rendering

The header is omitted when `header.hidden` is `true`.

When visible, the header may render:

- centered title
- centered subtitle
- key metadata as `1=<key>`
- time signature as stacked digits with a square-ended fraction line
- tempo mark and tempo number
- right-aligned composer

Header text is XML-escaped.

Key display replaces `#` and `b` with sharp and flat symbols.

Tempo denominator marks use character glyphs rather than hand-drawn paths:

| Denominator | Mark |
| ---: | --- |
| `2` | half note |
| `4` | quarter note |
| `8` | eighth note |
| `16` | single sixteenth note |

The tempo mark style uses this font stack:

```css
"Segoe UI Symbol", "Noto Music", "Noto Sans Symbols 2", Arial, Helvetica, sans-serif
```

The tempo mark symbol renders at `22px`; the equals sign and tempo number are
wrapped in a `20px` nested text span.

## Score Rendering

### Notes

Pitch notes render as bold text digits `1` through `7`.

Rests render as `0`.

Drum notes render as `X`.

The note font stack is:

```css
Arial, Helvetica, sans-serif
```

### Chords

Chord notes are stacked vertically. They are not rendered as slash-joined text.

The current stacking rule treats the last pitch in the chord as the visual base
note. Earlier chord pitches are placed above it.

### Accidentals

Accidentals render as text symbols:

| Model value | Symbol |
| ---: | --- |
| `2` | double sharp |
| `1` | sharp |
| `0` | natural |
| `-1` | flat |
| `-2` | double flat |

Accidentals reserve horizontal space before the note. For chords, the maximum
accidental offset of the chord is used so chord digits remain aligned.

### Octave Dots

Positive octave values render dots above the note.

Negative octave values render dots below the note. For the visual base note,
lower octave dots are offset below duration underlines so they do not sit on top
of the underline marks.

### Duration Marks

Slashes render as underlines below the note.

Dots render as dots to the right of the note.

Dashes render as horizontal extension lines to the right of the note.

Underline length is shortened at beat boundaries. The renderer uses
`actualNotePerBeat(timeSignature)` from the core model to decide whether a note
ends on a beat boundary.

### Bars

Bars are SVG line primitives, not music-font glyphs.

- regular bars use one vertical line
- the final bar uses one thin line plus one thicker line

The final bar is determined by object identity against the final measure in the
document.

### Ties

Ties render as filled SVG paths above notes.

Local ties are drawn between adjacent rendered note entries in the same visual
line.

If a tied note starts a visual line, the renderer draws an incoming partial tie.
If a note at the end of a visual line ties into the next note, the renderer
draws an outgoing partial tie.

This is a pragmatic cross-line rendering strategy, not full engraving-quality
tie layout.

## Interactivity Metadata

Each rendered note is wrapped in:

```svg
<g class="note-item" data-note-index="...">...</g>
```

If `activeNoteIndex` matches the parsed note index, or `activeNoteIndices`
contains it, the wrapper becomes:

```svg
<g class="note-item active" data-note-index="...">...</g>
```

The frontend uses `data-note-index` for click-to-play-from-note and active note
highlighting.

Active highlighting changes fill/stroke to red for note digits, accidentals,
dots, underlines, and dashes.

## Styling

The SVG includes inline CSS. The renderer intentionally keeps the output
self-contained so SVG export and PNG export see the same style rules.

Most elements use `currentColor`, allowing the embedding page or PNG renderer to
control color at the SVG root level.

Export callers can pass `color` and `background` render options. The CLI exposes
these as `--color` and `--background` for SVG and PNG export.

The frontend also has a Theme toggle. It changes the application colors and
sets the SVG preview/export `color` and `background` values to matching light or
dark presets. The individual color controls remain editable after selecting a
theme. The selected theme is saved in `localStorage`; if no saved choice exists,
the frontend uses the browser `prefers-color-scheme` setting as its initial
theme.

## Current Limitations

The renderer is deterministic but still intentionally simple:

- layout constants are internal, not configurable
- measure wrapping only occurs between measures
- overwide lines use line-level scaling instead of note re-spacing
- no full collision avoidance for dense chords and ties
- no zip packaging for split per-page browser downloads
- no staff or engraving model beyond the current Jianpu notation

These limits keep the renderer focused on its current notation targets.
