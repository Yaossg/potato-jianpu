# Modern Jianpu Reloaded

This is the rewrite workspace for Modern Jianpu Markup.

Current status:

- hand-written tokenizer/parser
- shared core document model
- CLI with `parse` and `validate`
- Node built-in test runner for parser compatibility checks

## Commands

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run cli -- validate path/to/score.jp
pnpm run cli -- parse path/to/score.jp --json
```

Implementation is intentionally incremental. See `PLAN.md` for the full rewrite
plan.

