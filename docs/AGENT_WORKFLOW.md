# Agent Workflow

This document defines how coding agents should work in this repository. It is
about process and repository hygiene, not a command reference. Use
`docs/COMMANDS.md` for commands and verification details.

## Change Rules

- Prefer the existing module boundaries and local helper APIs.
- Keep behavior changes documented and tested.
- Keep docs written as normal project documentation, focused on current
  behavior.
- Avoid unrelated refactors.
- If files contain user changes, preserve them and work with them.
- Use `.jpu` for score files.
- After each conversation turn, if you made any repository changes, commit them
  inside this repository before finishing the turn.

## Before Editing

- Read the focused reference document for the area being changed.
- Check the working tree before editing so unrelated user changes are visible.
- Keep edits scoped to the requested behavior and the ownership boundaries in
  `docs/ARCHITECTURE.md`.

## Before Finishing

- Run verification appropriate to the change. Use `docs/COMMANDS.md` for the
  command list and `docs/QUALITY.md` for test expectations.
- If grammar documentation changed, follow `docs/DOCUMENTATION.md` and
  `docs/TRANSLATION.md`.
- Summarize what changed, what was verified, and any remaining risk.
