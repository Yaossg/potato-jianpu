# Documentation Maintenance

This document describes how to keep project documentation current and focused.

## General Rules

- Document current behavior rather than implementation history.
- Keep user-facing docs useful to score authors and CLI/browser users.
- Keep implementation references focused on their own domains.
- Avoid duplicating long behavior descriptions across multiple docs; link to
  the focused reference instead.

## Grammar Documentation

Grammar behavior is documented across these surfaces:

- parser behavior and tests: behavior source of truth.
- `docs/grammar.ebnf`: compact grammar source used for railroad generation.
- `docs-site/src/content/docs/`: primary user-facing explanation layer.

When grammar behavior changes, update all affected grammar docs in the same
change, then run:

```sh
pnpm run grammar:railroad
```

The grammar pages should stay user-facing. Avoid parser-internal wording such
as return shapes, raw AST field names, or implementation diagnostics unless
those details are genuinely useful to score authors.

Follow `docs/TRANSLATION.md` and `docs-site/docs/DOCUMENTATION.md` when updating
bilingual docs-site grammar references.

## Docs Site

The Astro Starlight site under `docs-site/` is the primary user-facing
documentation site. Keep project-level docs here limited to this relationship.
Docs-site authoring details live in `docs-site/docs/`, with the local handoff
entry point at `docs-site/AGENTS.md`.

When renderer, playback, export, browser app, or CLI behavior changes, keep the
root focused reference for the implementation behavior and the matching
docs-site MDX page for user-facing workflow guidance. The detailed mapping lives
in `docs-site/docs/DOCUMENTATION.md`.

## Focused References

Use the existing focused references instead of creating catch-all notes:

- `docs/AGENT_WORKFLOW.md`: agent workflow and change rules.
- `docs/COMMANDS.md`: development, verification, CLI, grammar, and release
  commands.
- `docs/ARCHITECTURE.md`: product targets, module boundaries, source map, and
  dependency direction.
- `docs/RENDERER.md`: SVG renderer behavior and options.
- `docs/PLAYER.md`: playback, arrangement, MIDI, and synth-facing behavior.
- `docs/EXPORTS.md`: backend and frontend export behavior.
- `docs/QUALITY.md`: testing policy, frontend quality policy, and known test
  gaps.
- `docs/TRANSLATION.md`: bilingual documentation and terminology rules.
- `docs-site/docs/`: docs-site authoring, command, and translation details.
- `docs/ROADMAP.md`: known risks and future work.
- `docs/RELEASE.md`: build outputs, packaging, and release checklist.
