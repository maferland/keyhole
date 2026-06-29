---
description: Capture a secret from the user via a localhost form — never pasted in chat
allowed-tools: Bash
---

## Capture a secret securely

!`"${CLAUDE_PLUGIN_ROOT}/bin/get-secret" $ARGUMENTS`

## Your task

The command above opened a localhost form, waited for the user to submit, and
printed a JSON **reference** on stdout — the secret value is NOT in the output
and must never be.

Read the `retrieve` field. Use the secret only by expanding that reference
inside commands at runtime (e.g. `$(security find-generic-password -s NAME -a $USER -w)`).
Never `cat`, `echo`, or otherwise surface the stored value.

If no name was given, ask the user what to name the secret, then re-invoke with
`<name> --context '<what it's for>'`.
