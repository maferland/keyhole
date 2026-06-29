---
name: get-secret
description: Use when you need one or more secrets (API key, token, password, credential) from the user and they should NOT paste them into the chat. Triggers on "I'll give you the key in a form", "don't want to paste the secret here", "capture this credential securely", or any time a command you're about to run needs a secret value. Opens a localhost form; values flow to a store by reference and never enter your context.
allowed-tools: Bash, Bash(security:*)
---

# get-secret — capture secrets without them touching the chat

The user types secrets into a localhost browser form. Each value is written
straight to a destination (Keychain / file / env file). You get back **only
references** — never the values. You then build commands that expand a secret
at runtime, so it never lands in your context.

## When to use

- A command you're about to run needs an API key / token / password and the
  user would otherwise paste it into the chat.
- The user says they'll hand you a credential "securely" or "in a form".
- You're scaffolding `.env` / Keychain entries for a project.

## How it works

The CLI is blocking:

- prints the URL on **stderr** and opens the browser
- **blocks** until the user clicks **Store**
- prints a single JSON line on **stdout** — the references, no secret values

## Workflow

### 1. Invoke via Bash — never just emit the slash command as text

```
Bash(command="\"${CLAUDE_PLUGIN_ROOT}/bin/get-secret\" OPENAI_API_KEY --context 'OpenAI key for the ingest script'")
```

(If you've run `bun link`, plain `get-secret …` also works.)

Capture several at once by passing multiple names — one form, a field each:

```
Bash(command="get-secret OPENAI_API_KEY ANTHROPIC_API_KEY --dest env:./.env.local")
```

Pick the destination with `--dest`:

| `--dest`              | where the value lives                   | retrieve at runtime                                       |
| --------------------- | --------------------------------------- | --------------------------------------------------------- |
| `keychain` (default)  | macOS Keychain, service = `<name>`      | `$(security find-generic-password -s <name> -a $USER -w)` |
| `keychain:my-service` | Keychain under a custom service name    | same, with that service                                   |
| `file:/path`          | raw value in a `0600` file (single)     | reference the path; have scripts read it                  |
| `env:/path`           | `NAME=value` lines in a `0600` env file | `set -a; source /path; set +a`                            |

**Never detach the call.** No trailing `&`, no `nohup`. Use the Bash tool's
`run_in_background: true` if you must work while the user types, then read
stdout via `BashOutput`.

### 2. Read the JSON — that's all you get

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

Each entry in `secrets[]` has `name`, `dest`, and `retrieve`. Use the
`retrieve` reference; treat the value as opaque.

### 3. Use a secret by reference only — never print or read its value

```bash
curl -H "Authorization: Bearer $(security find-generic-password -s OPENAI_API_KEY -a $USER -w)" ...
```

```bash
# env-file dest:
set -a; source ./.env.local; set +a
node ingest.js            # reads $OPENAI_API_KEY from the environment
```

## Hard rules

- **Never `cat`, `echo`, `read`, or otherwise surface a stored value.** If you
  print it, it's back in your context and the whole exercise was pointless.
- Only the `retrieve` references are yours to handle.
- Exit codes: `0` stored, `2` timed out (re-invoke), `3` store failure (read stderr).
- Keychain passes the value on argv (brief `ps` exposure on multi-user
  machines). On a shared box prefer `file:`/`env:` with `0600`.
