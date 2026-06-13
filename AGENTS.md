# AGENTS.md

This file is the handoff entry point for agents working in this repository.
Treat this directory as the project root.

## Read First

- `docs/AGENT_WORKFLOW.md`: agent workflow and change rules.
- `docs/COMMANDS.md`: development, verification, CLI, grammar, docs-site, and
  release commands.
- `docs/DOCUMENTATION.md`: documentation maintenance rules, including grammar
  reference and docs-site updates.
- `docs-site/AGENTS.md`: local rules for Astro Starlight docs-site work.
- `docs-site/docs/`: local docs-site maintenance, command, and translation
  references.
- `README.md`: user-facing overview and common usage.
- `docs/ARCHITECTURE.md`: product targets, module boundaries, source map, and
  dependency direction.
- `docs/RENDERER.md`: SVG renderer behavior and options.
- `docs/PLAYER.md`: playback, arrangement, MIDI, and synth-facing behavior.
- `docs/EXPORTS.md`: backend and frontend export behavior.
- `docs/QUALITY.md`: testing policy, frontend quality policy, and known test
  gaps.
- `docs/TRANSLATION.md`: bilingual documentation and terminology rules.
- `docs/ROADMAP.md`: known risks and future work.
- `docs/RELEASE.md`: build outputs, packaging, and release checklist.
- `docs-site/src/content/docs/`: Starlight MDX documentation source.
- `docs/grammar.ebnf`: grammar source used for railroad generation.

## Quick Rules

- Use pnpm. The package manager version is pinned in `package.json`.
- Prefer the existing module boundaries and local helper APIs.
- Core stays platform-neutral; web code must not import backend modules.
- The parser is hand-written. Nearley/Moo parser generation is not part of this
  architecture.
- Serverless/API deployment is not a project target.
- Use `.jpu` for score files.
- Keep behavior changes documented and tested.
- Keep docs-site MDX content bilingual by matching English and `zh/` paths and
  keeping `docId` values aligned.
- When working in `docs-site/`, read `docs-site/AGENTS.md` as the local
  handoff guide. Docs-site-specific details live under `docs-site/docs/`.
- When grammar behavior changes, update `docs/grammar.ebnf` and relevant
  docs-site MDX; when adding, removing, or renaming grammar tokens or railroad
  rules, keep the docs-site grammar reference token list and
  `<RailroadDiagram />` entries in
  `docs-site/src/content/docs/reference/grammar.mdx` and
  `docs-site/src/content/docs/zh/reference/grammar.mdx` complete and aligned
  with `docs/grammar.ebnf`. Follow `docs/DOCUMENTATION.md` and
  `docs/TRANSLATION.md`, then run `pnpm run grammar:railroad`.
- After each conversation turn, if you made any repository changes, commit them
  inside this repository before finishing the turn.
