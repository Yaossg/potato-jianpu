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

Design work should define:

- The initial ornament set, with examples of the source notation and expected
  Jianpu rendering for each mark.
- Whether each ornament is attached to a note, a chord, a measure position, or a
  phrase-like span.
- Playback rules for timing, pitch resolution, duration stealing from the main
  note, velocity, articulation, and ties.
- MIDI and audio-export behavior, including whether ornaments expand into real
  note events or remain visual-only in any export path.
- Diagnostics for unsupported ornament combinations, missing anchor notes, or
  ornaments attached to rests.

Implementation should update the grammar reference only after the ornament
model is agreed across parse, render, browser playback, MIDI, WAV, and MP3
export. Focused parser tests, renderer snapshots, and player/MIDI tests should
land with the syntax.

### Advanced Repeat And Navigation Marks

Support score-navigation marks beyond the repeated endings that already exist
(`[1]`, `[2]`, `[1,2]`, etc.). Candidate marks include D.C., D.S., Fine, Segno,
Coda, To Coda, and related jump instructions.

Design work should define:

- The supported navigation vocabulary and source syntax, including how marks
  attach to measures and whether labels can be customized.
- Arrangement semantics for browser playback, note highlighting, MIDI export,
  WAV export, and MP3 export.
- How navigation marks interact with existing repeat barlines, repeated endings,
  ties, pickup measures, multi-track material, and percussion tracks.
- Renderer placement rules for symbols and text instructions on wrapped and
  paginated output.
- Diagnostics for ambiguous jumps, missing targets, duplicate targets,
  unreachable sections, and navigation cycles that would create unbounded
  playback.

Implementation should start from a shared arrangement model so playback and all
exports follow the same measure order. Tests should cover plain D.C./D.S. flows,
Fine termination, Coda jumps, interaction with repeated endings, and invalid
navigation graphs.
