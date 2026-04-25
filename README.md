# Modern Jianpu Reloaded

This is the rewrite workspace for Modern Jianpu Markup.

Current status:

- hand-written tokenizer/parser
- shared core document model
- CLI with `parse`, `validate`, `export-svg`, `export-png`, and `export-midi`
- frontend web preview with SVG and MIDI export
- example scores in `examples/`
- Node built-in test runner for parser compatibility checks

## Commands

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run cli -- validate path/to/score.jp
pnpm run cli -- parse path/to/score.jp --json
pnpm run cli -- export-svg examples/twinkle.jp -o twinkle.svg
pnpm run cli -- export-png examples/twinkle.jp -o twinkle.png
pnpm run cli -- export-midi examples/twinkle.jp -o twinkle.mid
pnpm run dev
pnpm run web:build
```

Implementation is intentionally incremental. See `PLAN.md` for the full rewrite
plan.
