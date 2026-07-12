# Workflow

This document defines how coding agents should work in this repository. It is
about process and repository hygiene, not a command reference. Use
`docs/COMMANDS.md` for commands and verification details.

- Prefer the existing module boundaries and local helper APIs.
- Avoid unrelated refactors.
- If files contain user changes, preserve them and work with them.
- Use `.jpu` for score files.

- Keep behavior changes documented and tested.
- Keep docs focused on current behavior, not implementation history.
- Keep user-facing docs useful to score authors and CLI/browser users.
- Keep implementation docs within their module's domain.
- Avoid duplicating behavior descriptions across docs; link to the focused
  reference instead.
- If grammar documentation changed, follow `docs/TRANSLATION.md`.

- Before editing, read the focused reference document for the area being
  changed.
- Before editing, check the working tree so unrelated user changes are visible.
- Keep edits scoped to the requested behavior and the ownership boundaries in
  `docs/ARCHITECTURE.md`.

- Before finishing, run verification appropriate to the change. Use
  `docs/COMMANDS.md` for the command list and `docs/QUALITY.md` for test
  expectations.
- Before finishing, summarize what changed, what was verified, and any
  remaining risk.
- After each conversation turn, if you made any repository changes, commit them
  inside this repository before finishing the turn.
- Commit messages must contain exactly one simple English summary sentence and
  must not end with a period.
