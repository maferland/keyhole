# get-secret — project context

Single-file, dependency-free Python CLI that captures a secret via a localhost
browser form and writes it to a store, returning only a reference. Also ships
as a Claude Code plugin (skill + command wrapper).

## Layout

- `bin/get-secret` — the CLI (Python stdlib only; the source of truth)
- `skills/get-secret/SKILL.md` — how the agent should use it
- `commands/get-secret.md` — `/get-secret` slash-command wrapper
- `tests/selftest.sh` — headless end-to-end contract test

## Run

```bash
./bin/get-secret MY_KEY --dest file:/tmp/x --context 'demo'
```

## Test

```bash
./tests/selftest.sh
```

The self-test drives the server headlessly (no browser) on a fixed port,
posts a known value, and asserts: the secret never appears on stdout/stderr,
the destination file is mode `0600` and holds the value, and a cross-origin
POST is rejected with 403. The keychain leg runs only on macOS.

## Constraints

- **No third-party deps.** Standard library only. If a feature needs a
  package, reconsider the feature.
- **Never print, log, or read back the secret value.** stdout carries only the
  reference. This is the entire point of the tool — guard it in every change.
- Keep `bin/get-secret` runnable both standalone and via the plugin
  (`${CLAUDE_PLUGIN_ROOT}/bin/get-secret`).
