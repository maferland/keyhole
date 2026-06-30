# keyhole

**Stop pasting secrets into your agent.**

Hand your AI coding agent a _reference_ — never the value.

![keyhole localhost form](https://raw.githubusercontent.com/maferland/keyhole/main/assets/screenshot.png)

---

Your agent needs an API key to run a command. Normally you'd paste it into the
chat — where it lands in the model's context, the transcript, and any logs.

`keyhole` opens a one-field form on `localhost`. You type the secret there, and
the value goes straight to a store (macOS Keychain, a file, or an env file). The
agent gets back **only a reference** — never the value, never in its context,
never in the logs.

## Prerequisites

- Node 18+ — the CLI and the Claude/Codex plugin all run on node. [Bun](https://bun.sh) is only needed to develop or build from source.
- macOS for the `keychain` destination; `file:`/`env:` work anywhere.

## Install

As a Claude Code plugin (no clone):

```bash
claude plugin add github:maferland/keyhole
```

As a CLI via npm:

```bash
npx @maferland/keyhole OPENAI_API_KEY --context '...'   # run without installing
npm install -g @maferland/keyhole                        # or install once, then: keyhole ...
```

From source (contributors):

```bash
git clone https://github.com/maferland/keyhole && cd keyhole && bun link
```

### Other agents (Codex, etc.)

keyhole is just a CLI, so any agent that can run shell commands can use it.

1. Install the CLI so the agent's shell can reach it:

   ```bash
   npm install -g @maferland/keyhole
   ```

2. Teach the agent to prefer it. Codex mirrors Claude — drop a skill into
   `~/.codex/skills/keyhole/SKILL.md` (see [skills/keyhole](skills/keyhole/SKILL.md),
   invoking the `keyhole` command directly). For any other agent, add a line to
   its instructions (`AGENTS.md`, system prompt):

   > To collect a secret, run `keyhole <NAME> --context '<what it is for>'` (pass
   > several names for several secrets). Use the returned `retrieve` reference and
   > never ask the user to paste a secret into the chat.

3. Optional — if the agent supports Stop hooks (Codex: `~/.codex/hooks.json`),
   wire up the nudge hook from [hooks/README.md](hooks/README.md) to catch slips
   automatically.

## Usage

```bash
keyhole OPENAI_API_KEY --context 'OpenAI key for the ingest script'
```

Pass several names for one form with a field per secret:

```bash
keyhole OPENAI_API_KEY ANTHROPIC_API_KEY --dest env:./.env.local
```

The command opens the form, **blocks** until you click **Store**, then prints
one JSON line on **stdout** — the references, with no secret values:

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

Use each secret by expanding its `retrieve` reference at runtime, so the value
is never captured:

```bash
curl -H "Authorization: Bearer $(security find-generic-password -s OPENAI_API_KEY -a $USER -w)" ...
```

### Destinations

Where the value lives is independent of how it gets there. Pick with `--dest`:

| `--dest`              | Stored as                               | Multiple secrets |
| --------------------- | --------------------------------------- | ---------------- |
| `keychain`            | macOS Keychain, service = `<name>`      | ✓ (default)      |
| `keychain:my-service` | Keychain under a custom service name    | ✓                |
| `file:/path`          | raw value in a `0600` file              | single only      |
| `env:/path`           | `NAME=value` lines in a `0600` env file | ✓                |

### Options

| Flag        | Default | Meaning                          |
| ----------- | ------- | -------------------------------- |
| `--context` | —       | hint shown in the browser form   |
| `--port`    | `0`     | `0` picks a random free port     |
| `--timeout` | `300`   | seconds to wait before giving up |

## How it works

**The agent asks.** It runs `keyhole NAME` instead of asking you to paste a key
into the chat.

**You type it.** A localhost-only HTTP server serves the form on a random,
unguessable URL path. On submit, each value is written directly to the chosen
destination.

**The agent gets a reference.** The references are printed to stdout — a
one-line `retrieve` command per secret, expanded only at runtime. Raw values
never touch stdout, are never logged, and are never read back by the agent.

Guards:

- binds `127.0.0.1` only; `Host` must be loopback on the chosen port (defeats DNS-rebinding)
- random URL token per run; any other path 404s
- rejects cross-origin POSTs
- single-use: stores once, then 409s further submits
- distinct exit codes: `0` stored, `2` timed out, `3` store failure

## Optional hook

Want the agent to reach for keyhole on its own? An opt-in `Stop` hook nudges it
to use keyhole whenever it tries to ask the user to paste a secret into the
chat. See [hooks/README.md](hooks/README.md).

## Security notes

- `keyhole` keeps the value out of the **agent's context** — that is its job.
  It is not at-rest encryption. `file:`/`env:` destinations are plaintext on disk
  (mode `0600`); `keychain` is encrypted at rest.
- The `keychain` destination passes the value on `argv`, briefly visible to
  `ps` on a multi-user machine. On a shared box prefer `file:` or `env:`.

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
