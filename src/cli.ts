import { spawn } from "node:child_process"

import { CaptureSession, type Result } from "./server.ts"
import { validateDest } from "./stores.ts"
import pkg from "../package.json" with { type: "json" }

const CURRENT_VERSION = pkg.version
const PKG = pkg.name

function checkUpdate(): void {
  // Plugin path has `claude plugin update` — no need to nudge
  if (process.env.CLAUDE_PLUGIN_ROOT) return
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
}

const HELP = `usage: keyhole <name>... [--dest DEST] [--context TEXT] [--port N] [--timeout S]

Capture one or more secrets via a localhost form. The values reach the store by
reference and never touch stdout. Pass several names for a multi-field form.

DEST (default: keychain):
  keychain[:service]   macOS Keychain generic password (account = $USER)
  file:/path           write the raw secret to /path with 0600 perms (single secret)
  env:/path            append/replace NAME=value lines in an env file (0600)

stdout on success (one JSON line):
  {"stored":true,"secrets":[{"name","dest","retrieve"}, ...]}

exit: 0 stored · 2 timed out or bad usage · 3 store failure
env:  BROWSER=true prints the URL without opening a browser`

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
  const args: Args = { names, dest: "keychain", context: "", port: 0, timeout: 300 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dest") args.dest = value(argv, ++i, a)
    else if (a === "--context") args.context = value(argv, ++i, a)
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
  if (result.status === "stored")
    process.stdout.write(JSON.stringify({ stored: true, secrets: result.secrets }) + "\n")
  else if (result.status === "failed") log(`keyhole: store failed: ${result.error}`)
  else log("keyhole: timed out, nothing stored")
  return exitCode(result)
}
