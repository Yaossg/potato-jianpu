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
- `xml.ts`: XML escaping helper.

## Public API

The renderer exports:

```ts
renderSvg(document: Document, options?: RenderOptions): string
```

`document` must already be parsed. The renderer does not parse source text.

Options:

```ts
interface RenderOptions {
  pageWidth?: number;
  activeNoteIndex?: number;
  color?: string;
  background?: string;
}
```

- `pageWidth` controls the SVG `width`, `viewBox` width, header layout, and
  measure wrapping. Default: `1000`.
- `activeNoteIndex` marks one parsed note as active for frontend playback
  highlighting. Default: no active note.
- `color` sets the root SVG `color` style used by `currentColor` notation
  elements. Default: `currentColor`.
- `background` draws a full-page background rectangle when non-empty. Default:
  no SVG background rectangle.

The return value is a complete SVG string with XML declaration, `<svg>`, inline
`<style>`, header graphics, and score graphics.

## Backend And Frontend Use

The same SVG renderer is used by:

- backend `export-svg`
- backend `export-png`
- frontend preview
- frontend SVG download

PNG export is not part of the renderer itself. PNG export calls `renderSvg()`
and passes the string to the backend PNG adapter in `src/backend/png.ts`.

## Layout Pipeline

The renderer follows a measurement-first pipeline:

1. Flatten all notes in document order.
2. Measure each note.
3. Build measure layouts.
4. Wrap measure layouts into visual lines based on `pageWidth`.
5. Draw bars, ties, notes, and duration marks.
6. Compute final SVG height from header height and rendered score lines.

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

## Dimensions

Renderer dimensions are centralized in the `DIMENSIONS` object:

| Name | Value | Meaning |
| --- | ---: | --- |
| `baseNoteWidth` | `24` | Base advance per note |
| `baseNoteHeight` | `24` | Base rendered note height |
| `leftPadding` | `18` | Measure left padding before first note |
| `measureSpacing` | `0` | Extra spacing between measures |
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
adding the next measure would exceed `pageWidth`.

Important details:

- wrapping never splits a measure internally
- source line breaks are preserved as natural line boundaries
- a single measure wider than `pageWidth` remains on its own line
- `pageWidth` also sets the SVG viewport width

The CLI exposes this through:

```sh
pnpm run cli -- export-svg input.jp -o output.svg --page-width 800
pnpm run cli -- export-png input.jp -o output.png --page-width 800
```

The frontend exposes it through the Width numeric control.

## Header Rendering

The header is omitted when `header.hidden` is non-empty.

When visible, the header may render:

- centered title
- centered subtitle
- key metadata as `1=<key>`
- time signature as text, for example `4/4`
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

If `activeNoteIndex` matches the parsed note index, the wrapper becomes:

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

## Current Limitations

The renderer is deterministic but still intentionally simple:

- layout constants are internal, not configurable
- source line labels are parsed but not rendered
- measure wrapping only occurs between measures
- no automatic horizontal scaling
- no full collision avoidance for dense chords and ties
- no pagination
- no staff or engraving model beyond the current Jianpu notation

These limits are acceptable for the current rewrite milestone and should be
revisited only after parser/player/export parity is stable.
