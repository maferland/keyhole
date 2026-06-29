# get-secret — project context

Single-file, dependency-free Python CLI that captures a secret via a localhost
browser form and writes it to a store, returning only a reference. Also ships
as a Claude Code plugin (skill + command wrapper).

## Layout

- `get_secret.py` — all logic (stdlib only; importable + testable). Source of truth.
- `bin/get-secret` — thin entry-point shim that imports and runs `get_secret.main`.
- `skills/get-secret/SKILL.md` — how the agent should use it
- `commands/get-secret.md` — `/get-secret` slash-command wrapper
- `tests/` — pytest suite (`test_stores.py` unit, `test_server.py` integration)

Testable seams in `get_secret.py`: `store_*` / `dispatch_store` are pure I/O;
`CaptureSession` owns the server + result; `make_handler` builds the handler
against a session; `exit_code` maps result → exit status; `main` only wires
argv → session → browser. Tests never spawn a process — they call functions
and drive `CaptureSession` in-process on port 0.

## Run

```bash
./bin/get-secret MY_KEY --dest file:/tmp/x --context 'demo'
```

## Test

```bash
python -m venv .venv && .venv/bin/pip install pytest   # one-time
.venv/bin/python -m pytest
```

pytest is a dev-only dependency; the CLI itself has zero runtime deps. Unit
tests cover the store layer (0600 perms, symlink refusal, env exact-key dedup,
newline/name validation, keychain argv). Integration tests drive the handler
over a raw socket for deterministic Host/Origin/Content-Length control and
assert every HTTP guard, single-use, and the no-leak contract.

## Constraints

- **No third-party deps.** Standard library only. If a feature needs a
  package, reconsider the feature.
- **Never print, log, or read back the secret value.** stdout carries only the
  reference. This is the entire point of the tool — guard it in every change.
- Keep `bin/get-secret` runnable both standalone and via the plugin
  (`${CLAUDE_PLUGIN_ROOT}/bin/get-secret`).
