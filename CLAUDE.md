# keyhole — project context

TypeScript CLI (runs under Bun, no build step) that captures one or more
secrets via a localhost browser form and writes them to a store, returning
only references. Ships as a Claude Code plugin (skill + command wrapper).

## Layout

- `src/stores.ts` — store layer: keychain/file/env + `dispatchStore` (pure I/O)
- `src/page.ts` — `buildPage` renders the form (single or multi-field)
- `src/server.ts` — `CaptureSession`: node:http server, request guards, single-use
- `src/cli.ts` — `parseArgs`, `exitCode`, `main` (argv → session → browser)
- `src/cli-entry.ts` — runs `main()` then exits; the build entry point
- `src/receipt.ts` — `buildReceipt`/`writeReceipt` for `--receipt` (never sees a value)
- `bin/keyhole` — committed node bundle built from `src/` (`bun run build`). The
  npm `bin`, the plugin entry, and the local CLI all use it. Runs on plain node.
- `skills/` + `commands/` — Claude Code plugin surface
- `tests/` — vitest. `stores`/`page`/`receipt`/`cli` are unit; `server` drives
  `CaptureSession` over a raw socket; `main` drives the whole CLI in-process

Consumers only need **node** — `bin/keyhole` is a built bundle, so the npm CLI,
the Claude/Codex plugin, and `npx keyhole` all run without Bun. Bun is only for
dev/build/test. **Rebuild `bin/keyhole` after editing `src/`** (`bun run build`);
CI rebuilds it and fails if the committed bundle differs. Published from CI on a
`v*` tag with npm provenance.

## Run

```bash
./bin/keyhole MY_KEY --dest file:/tmp/x --context 'demo'
```

## Test

```bash
bun install
bun run test
bunx tsc --noEmit
bunx prettier --check .
bun run build     # bundle dist/cli.js for node
```

Tests run under node (vitest) using only node-compatible APIs. Integration
tests drive `CaptureSession` in-process over a raw `node:net` socket for
deterministic Host/Origin/Content-Length control.

## Constraints

- **No runtime deps.** node/bun stdlib only. Dev deps (vitest, prettier, types) are fine.
- **Never print, log, or read back a secret value.** stdout carries only the
  references. This is the entire point — guard it in every change.
- Keep node-compatible APIs (no `Bun.serve`/`Bun.argv`) so vitest can run the code.
