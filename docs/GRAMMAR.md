# Grammar Reference

This document describes the syntax currently implemented by the reloaded
hand-written tokenizer and parser.

## File Structure

A file has an optional header followed by score text.

Header form:

```jianpu
title: "Twinkle"
key: "C"
time: "4/4"
tempo: "120"
=
1 1 5 5 | 6 6 5 - |
```

Score-only form:

```jianpu
1 2 3 4 | 5 6 7 1' |
```

The parser treats a document as a header document if any `=` token appears
ahead in the file. Header fields must appear before the `=` separator.

Empty files are currently valid. They parse as a document with default header
values and no score lines.

## Whitespace And Comments

Spaces and tabs may appear between tokens and are ignored.

Line breaks separate score lines and header properties.

Comments begin with `;` and continue until the next line break:

```jianpu
1 2 3 4 ; this comment is ignored
5 6 7 1'
```

Comments do not create notes or measures. The newline after a comment is still
parsed normally.

## Header

Header fields use this form:

```jianpu
name: "value"
```

The property name must contain ASCII letters or underscores. The value must be a
double-quoted string on one line.

Supported semantic fields:

| Field | Default | Meaning |
| --- | --- | --- |
| `title` | empty | Rendered title |
| `subtitle` | empty | Rendered subtitle |
| `composer` | empty | Rendered composer |
| `key` | `C` | Key used for playback and displayed metadata |
| `time` | `4/4` | Time signature |
| `tempo` | `120` | Beats per minute |
| `hidden` | empty | Any non-empty value hides rendered header metadata |

Unknown header fields are preserved in `header.raw` but have no built-in
semantic effect.

Multiple `=` characters are accepted as the header separator:

```jianpu
title: "Example"
===
1 2 3 4
```

### Strings

Strings are delimited by `"`. A backslash skips the following character during
tokenization, but the current parser stores the raw inner text and does not
unescape sequences.

Invalid:

```jianpu
title: "unterminated
=
1 2 3 4
```

## Key

Supported keys:

```text
C C# Db D D# Eb E F F# Gb G G# Ab A A# Bb B
```

One space inside the key value is ignored. Accidentals may also be written
before the letter because the parser checks the reversed normalized string:

```jianpu
key: "#C"
key: "bB"
```

Invalid keys produce an error and parsing returns `ok: false`.

## Time

Time signatures use `beatsPerMeasure/beatsPerWholeNote`.

Allowed numerators:

```text
2 3 4 6 9 12
```

Allowed denominators:

```text
2 4 8 16
```

Examples:

```jianpu
time: "4/4"
time: "6/8"
time: "2/16"
```

Invalid time signatures produce an error and parsing returns `ok: false`.

## Tempo

Tempo must be a positive number:

```jianpu
tempo: "96"
tempo: "120"
tempo: "132.5"
```

Invalid tempo values produce an error and parsing returns `ok: false`.

## Score Lines

A score line may optionally begin with a label:

```jianpu
verse: 1 2 3 4 | 5 6 7 1'
```

Labels use the same token form as header names: ASCII letters or underscores.
The label is preserved on the parsed score line and rendered at the left edge of
that score line.

A leading bar is accepted:

```jianpu
| 1 2 3 4 | 5 6 7 1' |
```

Measures are separated by `|`. A trailing `|` is accepted.

Each parsed measure must contain at least one note-like item. Empty measures are
errors:

```jianpu
1 2 || 3 4
```

## Notes

Pitch notes are digits `1` through `7`:

```jianpu
1 2 3 4 5 6 7
```

Rest:

```jianpu
0
```

Drum note:

```jianpu
X
```

The parser uses uppercase `X` only. Lowercase `x` is an identifier token, not a
drum note.

## Accidentals

Accidentals may appear before pitch notes:

| Syntax | Meaning |
| --- | --- |
| `#` | sharp |
| `##` | double sharp |
| `b` | flat |
| `bb` | double flat |
| `%` | natural |

Examples:

```jianpu
#4 b7 %4 ##1 bb6
```

Accidentals apply only to pitch notes. Accidentals persist within a measure for
playback and tie validation. They reset at each measure boundary.

## Octaves

Octave suffixes appear after a pitch note:

```jianpu
1' 2'' 6, 5,,
```

Each `'` raises the note by one octave. Each `,` lowers the note by one octave.

A measure may begin with a measure-level octave prefix:

```jianpu
'' 1 2 3 4
,, 5 6 7 1
```

The prefix applies to all pitch notes in that measure. Per-note suffixes add to
the measure prefix.

The prefix must appear at the start of the measure before any notes. Mixed
prefix characters are not accepted as one prefix; the parser consumes only the
first repeated prefix character type.

## Durations

The default note duration is a quarter note:

```jianpu
1
```

Dashes extend duration. Each dash adds one quarter note to the base duration:

| Syntax | Duration |
| --- | --- |
| `1` | `1/4` whole note |
| `1-` | `1/2` whole note |
| `1--` | `3/4` whole note |
| `1---` | `1` whole note |

Slashes halve duration:

| Syntax | Duration |
| --- | --- |
| `1/` | `1/8` whole note |
| `1//` | `1/16` whole note |
| `1///` | `1/32` whole note |

Dots extend duration by half of the current unit, then half of the previous dot
value:

| Syntax | Duration |
| --- | --- |
| `1.` | `3/8` whole note |
| `1..` | `7/16` whole note |
| `1/.` | `3/16` whole note |

Dashes and slash/dot suffixes are mutually exclusive in the current parser.
Inputs such as `1-/` or `1/-` are rejected with a specific duration diagnostic
rather than being treated as separate note syntax.

Examples:

```jianpu
1 2/ 3// 4. 5/. 6- 7--
```

## Chords

Chords are enclosed in braces:

```jianpu
{1 3 5}
{#1 3 b5}/
{1' 3' 5'}
```

Only pitch notes are valid inside a chord. Rests and drum notes are not valid
chord members. Empty chords are invalid.

The duration suffix belongs after the closing brace and applies to the whole
chord:

```jianpu
{1 3 5}/
{1 3 5}-
```

## Ties

A tie marker `~` appears before the tied note:

```jianpu
1 ~1
3 - ~3/
```

The first note in a document cannot be tied.

A tied note must follow a sounding note. A tie after a rest is invalid:

```jianpu
1 0 ~1
```

A tied pitch note must match the previous sounding pitch or chord after
measure-local accidental persistence is applied. A tied drum note may tie to a
previous drum note.

Valid:

```jianpu
#4 ~4
{1 3 5} ~{1 3 5}
X ~X
```

Invalid:

```jianpu
1 ~2
#4 | ~%4
X ~1
```

The player merges tied notes into the previous melody event.

## Compact Notation

Whitespace between notes is optional when tokens remain unambiguous:

```jianpu
1155|665-|
1/2/3/4/
```

Header syntax still requires line-oriented `name: "value"` fields before the
separator.

Only digits `1` through `7` are pitch notes. Compact text such as `18` is not
parsed as a valid compact note sequence; `8` is reported as an unexpected
character at its source position.

## Measure Duration Warnings

The parser computes each measure duration and compares it with the active time
signature:

```text
expected = beatsPerMeasure / beatsPerWholeNote
```

For example:

- `4/4` expects `1`
- `3/4` expects `0.75`
- `6/8` expects `0.75`

Mismatches produce warnings, not errors. The parse result remains `ok: true` if
there are no errors.

Example warning case:

```jianpu
time: "4/4"
=
1 2
```

## Error Summary

The parser currently reports errors for:

- unexpected characters
- unterminated strings
- malformed header fields
- missing header separator when header mode is detected
- invalid key, time, or tempo
- empty measures
- invalid note/chord/tie syntax
- mixed dash and slash/dot duration suffixes
- first note tied
- tied note after rest
- tied note target mismatch

Warnings are currently used for measure duration mismatches.
