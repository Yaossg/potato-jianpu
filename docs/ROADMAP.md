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
