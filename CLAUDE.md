# keyhole — project context

TypeScript CLI (runs under Bun, no build step) that captures one or more
secrets via a localhost browser form and writes them to a store, returning
only references. Ships as a Claude Code plugin (skill + command wrapper).

## Layout

- `src/stores.ts` — store layer: keychain/file/env + `dispatchStore` (pure I/O)
- `src/page.ts` — `buildPage` renders the form (single or multi-field)
- `src/server.ts` — `CaptureSession`: node:http server, request guards, single-use
- `src/cli.ts` — `parseArgs`, `exitCode`, `main` (argv → session → browser)
- `src/cli-entry.ts` — runs `main()` then exits; the bundle entry point
- `bin/keyhole` — Bun source entry for the Claude plugin + local dev
- `dist/cli.js` — built node bundle (`bun run build`); the npm `bin` (runs on plain node)
- `skills/` + `commands/` — Claude Code plugin surface
- `tests/` — vitest: `stores.test.ts` (unit), `server.test.ts` (in-process integration)

Two runtimes by channel: the Claude plugin runs `bin/keyhole` under Bun (source
`.ts`); the npm package ships `dist/cli.js` built for node so `npx keyhole`
needs no Bun. Published from CI on a `v*` tag with npm provenance.

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
