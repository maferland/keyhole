---
name: get-secret
description: Use when you need a secret (API key, token, password, credential) from the user and they should NOT paste it into the chat. Triggers on "I'll give you the key in a form", "don't want to paste the secret here", "capture this credential securely", or any time a command you're about to run needs a secret value. Opens a localhost form; the value flows to a store by reference and never enters your context.
allowed-tools: Bash, Bash(security:*)
---

# get-secret — capture a secret without it touching the chat

The user types a secret into a localhost browser form. The value is written
straight to a destination (Keychain / file / env file). You get back **only a
reference** — never the value. You then build commands that expand the secret
at runtime, so it never lands in your context.

## When to use

- A command you're about to run needs an API key / token / password and the
  user would otherwise paste it into the chat.
- The user says they'll hand you a credential "securely" or "in a form".
- You're scaffolding `.env` / Keychain entries for a project.

## How it works

The CLI is blocking:
- prints the URL on **stderr** and opens the browser
- **blocks** until the user clicks **Store secret**
- prints a single JSON line on **stdout** — the reference, no secret value

## Workflow

### 1. Invoke via Bash — never just emit the slash command as text

```
Bash(command="\"${CLAUDE_PLUGIN_ROOT}/bin/get-secret\" OPENAI_API_KEY --context 'OpenAI key for the ingest script'")
```

(If you've symlinked the CLI onto `PATH`, plain `get-secret …` also works.)

Pick the destination with `--dest` (storage is independent of how the value
reaches the store):

| `--dest`              | where the value lives                    | how you use it later                          |
|-----------------------|------------------------------------------|-----------------------------------------------|
| `keychain` (default)  | macOS Keychain, service = `<name>`       | `$(security find-generic-password -s <name> -a $USER -w)` |
| `keychain:my-service` | Keychain under a custom service name     | same, with that service                       |
| `file:/path`          | raw value in a `0600` file               | reference the path; have scripts read it      |
| `env:/path`           | `NAME=value` line in a `0600` env file   | `set -a; source /path; set +a`                |

**Never detach the call.** No trailing `&`, no `nohup`. Use the Bash tool's
`run_in_background: true` if you must do other work while the user types, then
read stdout via `BashOutput`.

### 2. Read the JSON reference — that's all you get

```json
{"name":"OPENAI_API_KEY","dest":"keychain:OPENAI_API_KEY","stored":true,
 "retrieve":"security find-generic-password -s OPENAI_API_KEY -a marc-antoine.ferland -w"}
```

### 3. Use the secret by reference only — never print or read its value

```bash
curl -H "Authorization: Bearer $(security find-generic-password -s OPENAI_API_KEY -a $USER -w)" ...
```

```bash
# env-file dest:
set -a; source ~/.config/myapp.env; set +a
python ingest.py            # reads $OPENAI_API_KEY from the environment
```

## Hard rules

- **Never `cat`, `echo`, `read`, or otherwise surface the stored value.** If you
  print it, it's back in your context and the whole exercise was pointless.
- Only the `retrieve` reference is yours to handle. Treat the value as opaque.
- If the CLI times out (exit 2), nothing was stored — re-invoke, don't guess.
- Keychain dest passes the value on argv (brief `ps` exposure on multi-user
  machines). On a shared box prefer `file:`/`env:` with `0600`.
