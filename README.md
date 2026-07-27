<img src="https://raw.githubusercontent.com/maferland/keyhole/main/assets/logo-cutout-1024.png" alt="keyhole logo" width="96" height="96">

# keyhole

Stop pasting secrets into your agent.

![keyhole localhost form](https://raw.githubusercontent.com/maferland/keyhole/main/assets/form.png)

---

Your agent needs an API key. Normally you'd paste it into the chat, where it lands in the model's context, the transcript, and every log. `keyhole` opens a form on `localhost` instead. You type the secret there; keyhole writes it to a store (macOS Keychain, a file, or an env file) and hands the agent back a retrieve reference. The value never touches the chat.

## Prerequisites

- Node 18+. The CLI and the Claude/Codex plugin both run on Node. [Bun](https://bun.sh) is only needed to build from source.
- macOS for the `keychain` destination; `file:`/`env:` work anywhere.

## Install

As a Claude Code plugin:

```bash
claude plugin add github:maferland/keyhole
```

As a CLI via npm:

```bash
npx @maferland/keyhole OPENAI_API_KEY --context '...'   # run without installing
npm install -g @maferland/keyhole                        # install once, then: keyhole ...
```

From source:

```bash
git clone https://github.com/maferland/keyhole && cd keyhole && bun link
```

### Keeping it updated

The plugin and the npm CLI update on separate tracks:

```bash
claude plugin update keyhole            # Claude Code plugin
npm install -g @maferland/keyhole       # global npm install (npx is always latest)
```

The CLI prints a one-line notice on stderr when a newer npm version exists. Plugin
installs update only via `claude plugin update`.

That check is the only network request keyhole makes anywhere. The capture form
requests nothing at all: no webfont, no analytics, and a CSP of `default-src 'none'`
that would block one anyway. The check fires while you are typing a secret, so it is
refusable:

```bash
KEYHOLE_NO_UPDATE_CHECK=1 keyhole OPENAI_API_KEY
```

It is skipped automatically under the Claude Code plugin.

### Other agents (Codex, etc.)

keyhole is a CLI, so any agent that can run shell commands can use it.

1. Install it so the agent's shell can reach it:

   ```bash
   npm install -g @maferland/keyhole
   ```

2. For Codex, drop a skill into `~/.codex/skills/keyhole/SKILL.md` (see
   [skills/keyhole](skills/keyhole/SKILL.md)). For any other agent, add a line to
   its instructions (`AGENTS.md`, system prompt):

   > To collect a secret, run `keyhole <NAME> --context '<what it is for>'`. Pass
   > several names for several secrets. Use the returned `retrieve` reference and
   > never ask the user to paste a secret into the chat.

3. If the agent supports Stop hooks (Codex: `~/.codex/hooks.json`), the nudge hook
   in [hooks/README.md](hooks/README.md) will catch slips automatically.

## Usage

```bash
keyhole OPENAI_API_KEY --context 'OpenAI key for the ingest script'
```

Pass several names for one form with a field per secret:

```bash
keyhole OPENAI_API_KEY ANTHROPIC_API_KEY --dest env:./.env.local
```

The command opens the form, blocks until you click Store, then prints one JSON line on stdout:

```json
{
  "stored": true,
  "secrets": [
    {
      "name": "OPENAI_API_KEY",
      "dest": "keychain:OPENAI_API_KEY",
      "retrieve": "security find-generic-password -s OPENAI_API_KEY -a $USER -w"
    }
  ]
}
```

Expand the `retrieve` reference at runtime so the value is never captured:

```bash
curl -H "Authorization: Bearer $(security find-generic-password -s OPENAI_API_KEY -a $USER -w)" ...
```

### Destinations

| `--dest`              | Stored as                               | Multiple secrets |
| --------------------- | --------------------------------------- | ---------------- |
| `keychain`            | macOS Keychain, service = `<name>`      | ✓ (default)      |
| `keychain:my-service` | Keychain under a custom service name    | ✓                |
| `file:/path`          | raw value in a `0600` file              | single only      |
| `env:/path`           | `NAME=value` lines in a `0600` env file | ✓                |

### Options

| Flag        | Default | Meaning                             |
| ----------- | ------- | ----------------------------------- |
| `--context` | —       | hint shown in the browser form      |
| `--port`    | `0`     | `0` picks a random free port        |
| `--timeout` | `300`   | seconds to wait before giving up    |
| `--receipt` | —       | write a reference receipt to a path |

### Receipts

stdout is what the agent consumes to keep working. A receipt is what a human keeps to
answer "which reference was handed over, for what task?" long after the transcript is
gone. `--receipt` writes one:

```bash
keyhole OPENAI_API_KEY --context 'ingest script' --receipt .keyhole/receipt.json
```

```json
{
  "schema": "keyhole.secret_reference_receipt.v1",
  "keyhole": "0.6.0",
  "request_id": "9f3c1e7a52b04d18",
  "created_at": "2026-07-27T18:04:11.402Z",
  "context": "ingest script",
  "secrets": [
    {
      "name": "OPENAI_API_KEY",
      "dest": "keychain:OPENAI_API_KEY",
      "retrieve": "security find-generic-password -s OPENAI_API_KEY -a $USER -w"
    }
  ]
}
```

It never contains a secret value, not even a hash of one, since a digest of a
low-entropy secret is an offline oracle. Written at `0600` and only after a store
succeeds, so a timeout or a failure leaves no receipt. stdout is unchanged either way.

`keyhole` records the version that produced the receipt rather than a block of
self-reported guard booleans. Those booleans would be compile-time constants, identical
in a tampered build, whereas the version is checkable against the npm tarball, which is
published from CI with provenance.

A receipt goes stale without saying so. Treat it as a record of what was granted at that
moment, not proof of what is still valid: the destination can be overwritten, the secret
rotated or revoked, or the `retrieve` command copied into an unrelated repo.

## How it works

keyhole starts a localhost HTTP server and opens the form at a random unguessable
URL. On submit, it writes each value to the chosen destination and prints the
retrieve references to stdout. The values never touch stdout, never appear in
logs, and are never read back by the agent.

Guards:

- binds `127.0.0.1` only; `Host` must be loopback (defeats DNS-rebinding)
- random URL token per run; any other path 404s
- rejects cross-origin POSTs
- single-use: stores once, then 409s further submits
- distinct exit codes: `0` stored, `2` timed out or bad usage, `3` store failure
- bad `--dest`, `--port`, or `--timeout` values fail before the form opens, so no
  one types a secret into a run that cannot succeed
- `default-src 'none'` CSP with a per-session nonce on the inline style and script;
  the form loads nothing from anywhere

## Optional hook

The Stop hook in [hooks/README.md](hooks/README.md) makes the agent reach for
keyhole automatically whenever it would otherwise ask you to paste a secret.

## Security notes

- keyhole keeps the value out of the agent's context. It is not at-rest
  encryption. `file:`/`env:` destinations are plaintext on disk (mode `0600`);
  `keychain` is encrypted at rest.
- No destination puts the value on a command line. `keychain` feeds it to
  `security` over stdin, so `ps` never shows it.
- `keychain` therefore cannot store a multi-line value, since `security` reads it
  from a line-based prompt. Use `file:` for a PEM key or anything else with
  newlines in it.

## Develop

```bash
bun install
bun run test      # vitest: unit + in-process integration
bunx tsc --noEmit
bun run build     # rebuild the node bundle at bin/keyhole
```

## Support

If keyhole saves you from pasting one more secret into a chat box,
[buy me a coffee](https://www.buymeacoffee.com/maferland).

## License

[MIT](LICENSE)
