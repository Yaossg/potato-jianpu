# AGENTS.md

This file is the handoff entry point for agents working in this repository.
Treat this directory as the project root.

## Read First

- `docs/AGENT_WORKFLOW.md`: agent workflow and change rules.
- `docs/COMMANDS.md`: development, verification, CLI, grammar, and release
  commands.
- `docs/DOCUMENTATION.md`: documentation maintenance rules, including grammar
  reference updates.
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
- `public/grammar.html` and `public/grammar.zh.html`: user-facing grammar
  references.
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
- When grammar behavior changes, update `public/grammar.html`,
  `public/grammar.zh.html`, and `docs/grammar.ebnf`; follow
  `docs/DOCUMENTATION.md` and `docs/TRANSLATION.md`, then run
  `pnpm run grammar:railroad`.
- After each conversation turn, if you made any repository changes, commit them
  inside this repository before finishing the turn.
