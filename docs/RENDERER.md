# Renderer Reference

This document describes the SVG renderer implemented in `src/renderer`.

Current renderer modules:

- `svg.ts`: top-level SVG document serialization.
- `header.ts`: title, subtitle, key, time, tempo, and composer drawing.
- `score.ts`: score, note, rest, drum, duration, bar, tie, and slur drawing.
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
  elements. An explicit value must use six-digit hexadecimal syntax
  (`#RRGGBB`). Default: `currentColor`.
- `background` draws page background rectangles when non-empty. An explicit
  value must use six-digit hexadecimal syntax (`#RRGGBB`). In unpaginated output
  there is one adaptive-height rectangle; in paginated output there is one
  fixed-height rectangle per page. Default: `#ffffff`.

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
9. Project slur spans into visual-line segments and reserve their vertical lanes.
10. Optionally paginate completed visual lines into fixed-height page boxes,
   honoring manual page breaks from the parsed score.
11. Draw bars, ties, slurs, notes, duration marks, and attached lyric lines or
    syllables.
12. Compute final SVG height from either the adaptive content height or the fixed
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

Lyric lines render below the preceding score group. A normal lyric string uses
whitespace-separated alignment units. An automatic lyric string written as
`@"..."` splits Han characters one-by-one and splits hyphenated ASCII words
into syllables, keeping the hyphen on non-final syllables. Lyrics with multiple
alignment units are rendered under leading main voice note anchors when the
aligned slot count is less than or equal to the main voice note count and the
main voice occupies one rendered visual line. Normal tokens render as centered
syllables, `_` reserves an empty aligned slot, and `~` reserves one additional
slot for the previous visible syllable. A syllable followed by one or more `~`
placeholders renders at the center of the covered anchor span instead of
staying on its first note; the covered `~` slots do not add extra spacing
pressure of their own. Long aligned lyric syllables participate in score layout
by increasing the horizontal advance between neighboring main-voice note
anchors, so English words do not overlap adjacent syllables. The first and last
aligned syllables also reserve enough line-edge padding for their visible text
halves, so centered syllables stay inside the content box instead of spilling
past the left or right edge. If the lyric has more aligned slots than main
voice notes, or if the expanded main voice wraps or must be horizontally scaled
to fit the page, the lyric remains a normal left-aligned lyric line. In
multi-voice groups, the renderer uses `T1` as the main voice; unlabeled lines
in labeled scores also count as `T1`.

Track and lyric labels reserve horizontal space based on the rendered label
text length plus padding. Visible labels come from typed header label fields,
such as `T1.name: "Melody"`, `T1: "Melody"`, `L1.name: "Verse"`, or
`L1: "Verse"`. A group uses the widest visible label in that group, so short
labels do not consume the same left margin as long labels.

Multi-voice groups render hexagonal side brackets with 3-unit vertical stems
and slightly finer 2-unit beveled ends.

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
| `slurMinHeight` | `12` | Minimum slur curve height |
| `slurMaxHeight` | `24` | Maximum slur curve height and base reserved lane height |
| `slurLaneGap` | `10` | Vertical separation between nested slur lanes |
| `slurEndpointGap` | `4` | Clearance between slur endpoints and the notation below |
| `slurEndpointOutset` | `4` | Horizontal outward offset from an anchored note center |
| `slurCountFontSize` | `12` | Font size for a counted-slur label |
| `slurCountGap` | `4` | Clearance on each side of a counted-slur label |
| `octaveSpacing` | `5` | Distance between octave dots |
| `noteBottomPadding` | `10` | Baseline padding below notes |
| `underlineSpacing` | `5` | Vertical distance between duration underlines |
| `dotSpacing` | `12` | Horizontal spacing for duration dots |
| `dashSpacing` | `24` | Horizontal spacing for extension dashes |
| `lineSpacing` | `10` | Vertical spacing after each visual line |
| `velocityFontSize` | `14` | Per-note dynamic marker font size |
| `velocityTextGap` | `2` | Gap between dynamic text and the note or chord |
| `hairpinHeight` | `12` | Vertical opening of gradual dynamic hairpins |
| `hairpinTopGap` | `16` | Gap between hairpins and the note row |
| `hairpinTransitionGap` | `6` | Horizontal gap between opposite hairpins that meet on one note |
| `hairpinVelocityClearance` | `8` | Extra upward offset when hairpins share a note with dynamic text |
| `navigationHeight` | `20` | Vertical space reserved for the navigation mark lane |
| `navigationTopOffset` | `10` | Vertical offset for navigation mark text |
| `ornamentTopGap` | `3` | Gap between SMuFL ornaments and the note row |
| `ornamentHeight` | `3` | Vertical space reserved above the note row for SMuFL ornaments |
| `trillExtensionStartOffset` | `9` | Long-trill path offset right of the note center |
| `trillExtensionEndGap` | `8` | Gap before the next onset or measure barline |
| `trillExtensionWavelength` | `8` | Target long-trill wave cycle width |
| `trillExtensionAmplitude` | `2` | Long-trill wave amplitude |
| `trillExtensionYOffset` | `4` | Long-trill path offset above the trill glyph baseline |
| `slideRadius` | `6` | Fixed radius of a slide arc |
| `slideArrowLength` | `3` | Slide arrowhead length along the end tangent |
| `slideArrowHalfWidth` | `2` | Half-width of the slide arrowhead base |
| `slideXOffset` | `8` | Horizontal offset from the source note center to the slide arc |
| `slideLowYOffset` | `15` | Vertical offset from the source note baseline to the low end of a slide arc |
| `slideRightWidth` | `4` | Extra spacing that keeps duration dashes clear of a slide mark |
| `graceLowOctaveArcOffset` | `1.4` | Horizontal arc-end clearance from a lower-octave grace dot |

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

Underline length is shortened at beat boundaries, before a following note that
has no underline, and at the end of every measure. Otherwise adjacent
underlined notes inside the same beat use touching line endpoints so their
underlines appear continuous. The renderer uses
`actualNotePerBeat(timeSignature)` from the core model to decide whether a note
ends on a beat boundary.

### Bars

Bars are SVG line primitives, not music-font glyphs.

- regular bars use one vertical line
- the final bar uses one thin line plus one thicker line

The final bar is determined by object identity against the final measure in the
document.

### Navigation Marks

Navigation target marks `[Segno]` and `[Coda]` render as the standard music
symbols above the start of their measure. After-measure marks `[Fine]`,
`[D.C.]`, `[D.S.]`, and `[To Coda]` render as italic text above the owning
measure's end barline.
The renderer shows the written score only; it does not visually expand the
playback/export navigation order.

Navigation marks render in a fixed lane at the top of the reserved vertical
space so they do not collide with note rows, repeat brackets, dynamics, or
hairpins.

### Ties

Ties render as filled SVG paths above notes.

Local ties are drawn between adjacent rendered note entries in the same visual
line.

If a tied note starts a visual line, the renderer draws an incoming partial tie.
If a note at the end of a visual line ties into the next note, the renderer
draws an outgoing partial tie.

This is a pragmatic cross-line rendering strategy, not full engraving-quality
tie layout.

### Slurs

Slurs render as thin, flat-topped stroked paths above the notation: a curved
rise, a horizontal middle section, and a curved descent keep them visually
distinct from the filled, continuously curved tie paths. The renderer resolves
each document-level slur against the ordered notes of its own track, so
interleaved multi-voice note indexes do not join unrelated voices. A slur on
one visual line places its endpoints just outside its source and destination
note centers; a slur that
crosses source wrapping or automatic wrapping is split into outgoing, middle,
and incoming segments at the content edges. A split edge meets the horizontal
section directly. Pagination reuses those visual-line segments, including
across explicit page breaks.

A slur opened with `$$(` has one numeric label centered on its horizontal
section. The renderer splits the stroke around the label and places it only on
the visual segment containing the span midpoint, including when the slur wraps
across lines or pages. The label is the number of pitch notes or chords stored
in `Slur.noteCount`, including both endpoints; rests are not counted. Half of
the label font height is added to that visual line's reserved space so the
centered text is not clipped or overlapped.

Nested spans use separate vertical lanes for their horizontal sections. Inner
slur platforms stay closer to the notation and outer platforms move upward,
while every anchored curved end still reaches its note. Ties remain closer to
their notes than slur platforms. Slur lane height is added before pagination,
so page placement, lyrics, and multi-voice brackets include the reserved space.
Justification and overwide-line scaling apply to slur coordinates together with
their score line.

Slurs are engraving-only. They do not change browser playback or MIDI, WAV,
and MP3 export timing.

### Dynamics And Hairpins

Per-note dynamic markers render as italic text above their attached note.

Gradual dynamic hairpins render above the note row. Paired `<` markers draw a
crescendo, and paired `>` markers draw a diminuendo. Opposite markers may meet
on the same note, so `<>` closes a crescendo and starts a diminuendo at that
note, while `><` does the reverse. The renderer leaves a small horizontal gap
between opposite hairpins at that shared note. Hairpins move slightly upward
when they share a note with dynamic text such as `p` or `f`, so the markings do
not overlap. Hairpins may cross measure and visual line boundaries. When
source line breaks or wrapping split a hairpin, the renderer draws a separate
complete hairpin on each visual line.

### Ornaments

Fermatas written as `(.)` render above their attached note, chord, rest, or
drum note with the SMuFL fermata-above glyph. They are visual-only and do not
change playback or export timing.

Mordent, turn, and trill ornaments render with SMuFL Private Use Area glyphs.
Upper mordents use the plain mordent glyph, while lower mordents use the glyph
with a vertical stroke.
When the anchor is a chord, the glyph is centered above the whole chord.
A `(tr~)` long trill keeps the trill glyph and, when the note has at least
one duration dash, adds a wavy SVG path from 9px right of the note center to
8px before the next onset or current measure barline. The path fills the
available width with the nearest whole number of 8px target wavelength cycles
at 2px amplitude, with its baseline 4px above the trill glyph baseline.
Duration dashes, alignment, and justification therefore
extend the path through the same final layout coordinates. Without a duration
dash, only the trill glyph renders and the parser reports a warning. The
extension remains within the current visual line and the anchor note's written
duration.

Slides render in the source note's upper-right area as source-attached
quarter-circle SVG arcs with an arrowhead at the arc end. Every rising or
falling slide uses the same 6px radius regardless
of the target note's position, duration spacing, justification, or visual-line
wrapping. The target pitch determines only whether the fixed-size mark bends
upward or downward. A slide between notes at the same sounding pitch produces
a parser warning and is omitted.

Browser preview, browser PDF export, backend PNG export, and backend PDF export
load the bundled Bravura font for these glyphs. Other notation symbols
continue to use Unicode text or SVG primitives.

Grace-note ornaments render as small Jianpu number figures beside their anchor
note or chord. Each grace figure includes the small pitch number, octave dots or
accidentals when present, one or more short underlines based on the count of
grace pitches, and a quarter-circle arc from the lower edge of the underline
group to the anchor note. Adjacent grace figures use continuous underlines,
while the final grace figure uses shortened underline endings. When the grace
pitch connected to the arc has a lower-octave dot, the renderer shifts the arc
endpoint 1.4 renderer units away from that dot.

Raw renderer SVG output references the Bravura font family but does not inline
font data, so browser preview can stay lightweight. SVG file export embeds the
bundled Bravura `woff2` as an SVG-local `@font-face` when SMuFL ornaments are
present, making downloaded SVG files self-contained for SMuFL ornaments in
modern SVG viewers.

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

SMuFL ornament glyphs do not participate in pointer hit testing. Their font
boxes can extend well beyond the visible mark, so ignoring those boxes keeps a
later score line's ornament from intercepting clicks on the line above.

Active highlighting changes fill/stroke to red for note digits, accidentals,
dots, underlines, and dashes.

## Styling

The SVG includes inline CSS. SVG and PNG export begin with the same renderer
style rules. PNG adapters add an export-only font override so browser and CLI
raster output use bundled Noto Sans SC and Bravura fonts instead of platform
font fallback.

Most elements use `currentColor`, allowing the embedding page or PNG renderer to
control color at the SVG root level.

Export callers can pass six-digit hexadecimal `color` and `background` render
options. The CLI exposes these as `--color` and `--background` for SVG, PNG,
and PDF export. Other CSS syntax is rejected before SVG serialization.

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
- no full collision avoidance for dense chords, ties, and slurs
- no zip packaging for split per-page browser downloads
- no staff or engraving model beyond the current Jianpu notation

These limits keep the renderer focused on its current notation targets.
