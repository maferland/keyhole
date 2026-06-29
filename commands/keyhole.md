---
description: Capture a secret from the user via a localhost form — never pasted in chat
allowed-tools: Bash
---

## Capture a secret securely

!`"${CLAUDE_PLUGIN_ROOT}/bin/keyhole" $ARGUMENTS`

## Your task

The command above opened a localhost form, waited for the user to submit, and
printed a JSON object on stdout — `{"stored":true,"secrets":[{name,dest,retrieve}]}`.
The secret values are NOT in the output and must never be.

For each entry in `secrets[]`, use it only by expanding its `retrieve` reference
inside commands at runtime (e.g. `$(security find-generic-password -s NAME -a $USER -w)`).
Never `cat`, `echo`, or otherwise surface a stored value.

Pass multiple names for a multi-field form. If no name was given, ask the user
what to name the secret, then re-invoke with `<name> --context '<what it's for>'`.
