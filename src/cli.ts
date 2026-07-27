import { spawn } from "node:child_process"

import { buildReceipt, writeReceipt } from "./receipt.ts"
import { CaptureSession, type Result, type Stored } from "./server.ts"
import { validateDest } from "./stores.ts"
import pkg from "../package.json" with { type: "json" }

const CURRENT_VERSION = pkg.version
const PKG = pkg.name

// The only network call keyhole makes, and it fires while someone is typing a secret, so
// it has to be refusable. The plugin updates via `claude plugin update` instead.
export function updateCheckDisabled(): boolean {
  return Boolean(process.env.CLAUDE_PLUGIN_ROOT || process.env.KEYHOLE_NO_UPDATE_CHECK)
}

function checkUpdate(): void {
  if (updateCheckDisabled()) return
  fetch(`https://registry.npmjs.org/${PKG}/latest`, {
    signal: AbortSignal.timeout(3000),
  })
    .then((r) => r.json() as Promise<{ version?: string }>)
    .then((data) => {
      if (data.version && data.version !== CURRENT_VERSION) {
        process.stderr.write(
          `keyhole: update available ${data.version} (current: ${CURRENT_VERSION}) — npm update -g ${PKG}\n`,
        )
      }
    })
    .catch(() => {})
}

export interface Args {
  names: string[]
  dest: string
  context: string
  port: number
  timeout: number
  receipt: string
}

const HELP = `usage: keyhole <name>... [--dest DEST] [--context TEXT] [--port N] [--timeout S]
                         [--receipt PATH]

Capture one or more secrets via a localhost form. The values reach the store by
reference and never touch stdout. Pass several names for a multi-field form.

DEST (default: keychain):
  keychain[:service]   macOS Keychain generic password (account = $USER)
  file:/path           write the raw secret to /path with 0600 perms (single secret)
  env:/path            append/replace NAME=value lines in an env file (0600)

stdout on success (one JSON line):
  {"stored":true,"secrets":[{"name","dest","retrieve"}, ...]}

--receipt PATH writes a reference receipt for review: what was granted, where, and
under which keyhole version. It never contains a secret value, and is written only
after a successful store. stdout is unchanged either way.

exit: 0 stored · 2 timed out or bad usage · 3 store failure
env:  BROWSER=true               print the URL without opening a browser
      KEYHOLE_NO_UPDATE_CHECK=1  skip the npm version check, keyhole's only egress`

function value(argv: string[], i: number, flag: string): string {
  const v = argv[i]
  if (v === undefined) throw new Error(`${flag} needs a value`)
  return v
}

function intArg(raw: string, flag: string, min: number): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min)
    throw new Error(`${flag} needs an integer >= ${min}, got '${raw}'`)
  return n
}

export function parseArgs(argv: string[]): Args {
  const names: string[] = []
  const args: Args = { names, dest: "keychain", context: "", port: 0, timeout: 300, receipt: "" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dest") args.dest = value(argv, ++i, a)
    else if (a === "--context") args.context = value(argv, ++i, a)
    else if (a === "--receipt") args.receipt = value(argv, ++i, a)
    else if (a === "--port") args.port = intArg(value(argv, ++i, a), a, 0)
    else if (a === "--timeout") args.timeout = intArg(value(argv, ++i, a), a, 1)
    else if (a === "-h" || a === "--help") {
      process.stdout.write(HELP + "\n")
      process.exit(0)
    } else if (a.startsWith("-")) throw new Error(`unknown option: ${a}`)
    else names.push(a)
  }
  if (names.length === 0) throw new Error("need at least one secret name")
  validateDest(args.dest, names)
  return args
}

function log(msg: string): void {
  process.stderr.write(msg + "\n")
}

function openBrowser(url: string): void {
  if (process.env.BROWSER === "true") return
  const cmd = process.platform === "darwin" ? "open" : "xdg-open"
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref()
  } catch {
    // headless / no browser — the URL is already on stderr
  }
}

// The secret is already stored by this point, so a receipt that cannot be written must
// not change the exit code. It has to be loud instead of silent.
function writeReceiptOrWarn(path: string, secrets: Stored[], context: string): void {
  try {
    writeReceipt(path, buildReceipt(secrets, context))
  } catch (e) {
    log(`keyhole: warning: no receipt written to ${path}: ${(e as Error).message}`)
  }
}

const EXIT: Record<Result["status"], number> = { stored: 0, timeout: 2, failed: 3 }

export function exitCode(result: Result): number {
  return EXIT[result.status]
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  let args: Args
  try {
    args = parseArgs(argv)
  } catch (e) {
    log(`keyhole: ${(e as Error).message}`)
    return 2
  }

  let session: CaptureSession
  try {
    session = await new CaptureSession(args).listen()
  } catch (e) {
    log(`keyhole: cannot bind port ${args.port || "<random>"}: ${(e as Error).message}`)
    return 3
  }

  log(`keyhole: open ${session.url}`)
  log(`  ${args.names.join(", ")}  dest=${args.dest}  (waiting up to ${args.timeout}s)`)
  openBrowser(session.url)
  checkUpdate()

  const result = await session.wait(args.timeout * 1000)
  session.close()

  // The wire format is the documented contract, kept independent of the internal union.
  if (result.status === "stored") {
    if (args.receipt) writeReceiptOrWarn(args.receipt, result.secrets, args.context)
    process.stdout.write(JSON.stringify({ stored: true, secrets: result.secrets }) + "\n")
  } else if (result.status === "failed") log(`keyhole: store failed: ${result.error}`)
  else log("keyhole: timed out, nothing stored")
  return exitCode(result)
}
