# Risks And Future Work

This document tracks known risks and possible future work. It is not a release
commitment.

## Risks

- No current risks are listed yet.

## Future Features

### Ornament Notation

Support notation for common Jianpu embellishments, such as grace notes,
appoggiaturas, mordents, turns, trills, and slides where they fit the project's
Jianpu scope. This feature needs a narrow first version because ornaments vary
by style and often require both engraving and playback choices.

The first version should be intentionally small and deterministic:

- Add note-attached ornaments only. Do not support measure-position ornaments,
  chord-wide ornaments, or phrase-like spans until the note model, renderer, and
  melody compiler have one shared attachment shape.
- Start with visual ornaments whose playback expansion is unambiguous:
  acciaccatura-style grace notes, short appoggiaturas, upper/lower mordents,
  turns, and trills. Treat slides as a later phase unless their rendering and
  pitch interpolation rules are specified first.
- Require every ornament to resolve to a single anchor note. Reject ornaments on
  rests in the first version, and warn or error on combinations that would need
  ordering rules, such as multiple ornaments on the same note.
- Keep the parsed model platform-neutral in core so parser, renderer, player,
  CLI, backend exports, and web exports all consume the same ornament data.

Syntax design should decide:

- How ornaments are written next to the note without conflicting with current
  pitch, octave, accidental, duration, lyric, tie, repeat, and chord syntax.
- Whether grace/appoggiatura pitches use normal Jianpu note syntax in a compact
  wrapper or a dedicated ornament prefix.
- How to distinguish upper and lower variants for mordents and turns.
- How trills specify the auxiliary pitch when the key signature alone is not
  enough.
- Whether ornament spelling can appear inside chords in the first syntax, even
  if chord-wide behavior is deferred.

Rendering design should define:

- The exact mark or miniature-note engraving for each initial ornament.
- Horizontal and vertical placement relative to noteheads, stems, dots, ties,
  beams, lyrics, and measure barlines.
- Collision behavior when an ornament appears near accidentals, octave dots,
  tuplets, or wrapped line starts.
- Snapshot fixtures for at least one compact measure, one wrapped measure, and
  one collision-sensitive case.

Playback and export design should define:

- Whether each ornament expands into real melody events or remains visual-only.
  The preferred first-version target is real melody expansion for browser
  playback, MIDI, WAV, and MP3 wherever the ornament has deterministic timing.
- Duration stealing rules for before-the-beat grace notes and on-the-beat
  appoggiaturas, including minimum main-note duration after stealing.
- Auxiliary pitch resolution for key signatures, accidentals, octave marks,
  ties, and transposed tracks.
- Velocity and articulation defaults, including whether ornaments inherit the
  anchor note velocity or use a scaled value.
- Tie semantics: ornaments should not split or extend existing ties unless the
  behavior is deliberately specified and tested.

Diagnostics should cover:

- Unknown ornament names or markers.
- Ornament syntax without a valid following or preceding anchor note.
- Ornaments attached to rests.
- Unsupported attachment inside chords or across ties.
- Unsupported combinations when more than one ornament is attached to the same
  note.
- Ornaments whose playback expansion would require negative or zero-duration
  main notes.

Suggested implementation phases:

1. Define core ornament types, source ranges, and diagnostics without changing
   accepted syntax.
2. Add parser syntax for one or two simple note-attached ornaments and document
   the grammar once the syntax is stable.
3. Add deterministic renderer output and SVG snapshots.
4. Add melody expansion for shared browser playback, MIDI, WAV, and MP3 export.
5. Expand the ornament set only after the first syntax, rendering, diagnostics,
   and playback rules are covered by focused tests.

Implementation should update `docs/grammar.ebnf`, generated railroad diagrams,
and matching English and Chinese docs-site grammar references only after the
ornament model is agreed across parse, render, browser playback, MIDI, WAV, and
MP3 export. Focused parser tests, renderer snapshots, and player/MIDI tests
should land with any accepted syntax.
