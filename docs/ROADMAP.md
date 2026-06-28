# Risks And Future Work

This document tracks known risks and possible future work. It is not a release
commitment.

## Risks

- No current risks are listed yet.

## Future Features

- Dynamic hairpins and gradual volume changes, such as crescendo and
  diminuendo notation, with shared behavior across playback, MIDI, WAV, and
  MP3 export.
- Ornament notation for common Jianpu embellishments. Any design should define
  parse, render, playback, MIDI, and audio-export behavior before syntax is
  added.
- Advanced repeat/navigation marks such as D.C., D.S., Fine, Segno, and Coda.
  Existing repeated endings (`[1]`, `[2]`, `[1,2]`, etc.) are already supported;
  this item is about score-navigation marks beyond repeated endings.
