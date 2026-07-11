# Risks And Future Work

This document tracks known risks and possible future work. It is not a release
commitment.

## Risks

- No current risks are listed yet.

## Future Features

### Ornament Notation

Current note-attached ornament support includes upper and lower mordents, normal
and inverted turns, trills, and before/after grace notes. These ornaments share
one platform-neutral model across parsing, SVG engraving, browser playback,
MIDI, WAV, and MP3 export.

A trill can be written as `(tr)` or as `(tr~)` with a wavy visual extension.
The extension is limited to the anchor note's written duration and does not
create a cross-note span. It renders only when the note has at least one
duration dash; shorter uses produce a warning and keep only the trill glyph.
Both spellings use the same playback events.

Future ornament work remains intentionally scoped:

- Add appoggiaturas and slides only after their engraving and playback timing
  are specified.
- Consider an explicit trill auxiliary pitch when the key signature and active
  accidental are not sufficient.
- Define collision behavior for denser combinations near ties, hairpins,
  navigation marks, and wrapped line boundaries.
- Keep chord-wide ornaments, measure-position ornaments, phrase-like spans, and
  ornaments on tied notes unsupported until they have unambiguous ownership and
  playback semantics.
- Add new ornament syntax only with matching parser diagnostics, renderer and
  player tests, EBNF and railroad updates, and aligned English and Chinese
  documentation.
