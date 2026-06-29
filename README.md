<div align="center">
<h1>🔑 get-secret</h1>

<p>Hand a secret to your AI coding agent without pasting it in the chat</p>
</div>

---

Your agent needs an API key to run a command. Normally you'd paste it into the
chat — where it lands in the model's context, the transcript, and any logs.
`get-secret` opens a one-field form on `localhost`, you type the secret there,
and the value goes straight to a store (macOS Keychain, a file, or an env file).
The agent gets back **only a reference** — never the value.

## Install

As a Claude Code plugin:

```bash
claude plugin add github:maferland/get-secret
```

Or use the CLI directly — it's a single dependency-free Python file:

```bash
git clone https://github.com/maferland/get-secret
ln -s "$PWD/get-secret/bin/get-secret" ~/.local/bin/get-secret
```

## Usage

```bash
get-secret OPENAI_API_KEY --context 'OpenAI key for the ingest script'
```

The command:
- opens a localhost form in your browser and prints the URL on stderr
- **blocks** until you click **Store secret**
- prints one JSON line on **stdout** — the reference, with no secret value:

```json
{"name":"OPENAI_API_KEY","dest":"keychain:OPENAI_API_KEY","stored":true,
 "retrieve":"security find-generic-password -s OPENAI_API_KEY -a $USER -w"}
```

Then use the secret by expanding the reference at runtime, so the value is
never captured:

```bash
curl -H "Authorization: Bearer $(security find-generic-password -s OPENAI_API_KEY -a $USER -w)" ...
```

### Destinations

Where the value lives is independent of how it gets there. Pick with `--dest`:

| `--dest`              | Stored as                              | Default |
|-----------------------|----------------------------------------|---------|
| `keychain`            | macOS Keychain, service = `<name>`     | ✓       |
| `keychain:my-service` | Keychain under a custom service name   |         |
| `file:/path`          | raw value in a `0600` file             |         |
| `env:/path`           | `NAME=value` line in a `0600` env file |         |

### Options

| Flag         | Default | Meaning                              |
|--------------|---------|--------------------------------------|
| `--context`  | —       | hint shown in the browser form       |
| `--port`     | `0`     | `0` picks a random free port         |
| `--timeout`  | `300`   | seconds to wait before giving up     |

## How it works

A localhost-only HTTP server serves the form on a random, unguessable URL path.
On submit, the value is written directly to the chosen destination by the
server process and the reference is printed to stdout. The raw value never
touches stdout, is never logged, and is never read back by the agent.

Guards:
- binds `127.0.0.1` only
- random URL token per run; requests to any other path 404
- rejects cross-origin POSTs (other browser tabs can't post to it)
- request bodies are never logged
- single-use: stores once, then shuts down (or times out with nothing stored)

## Security notes

- `get-secret` keeps the value out of the **agent's context** — that is its
  job. It is not an at-rest encryption tool. `file:`/`env:` destinations are
  plaintext on disk (mode `0600`); `keychain` is encrypted at rest.
- The `keychain` destination passes the value on `argv`, so it's briefly
  visible to `ps` on a multi-user machine. On a shared box prefer `file:` or
  `env:`.

## Requirements

- Python 3.9+ (standard library only — no pip installs)
- macOS for the `keychain` destination; `file:`/`env:` work anywhere

## License

[MIT](LICENSE)
