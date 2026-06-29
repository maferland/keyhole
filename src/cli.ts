import { spawn } from "node:child_process"

import { CaptureSession, type Result } from "./server.ts"

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
  {"stored":true,"secrets":[{"name","dest","retrieve"}, ...]}`

export function parseArgs(argv: string[]): Args {
  const names: string[] = []
  const args: Args = { names, dest: "keychain", context: "", port: 0, timeout: 300 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dest") args.dest = argv[++i]
    else if (a === "--context") args.context = argv[++i]
    else if (a === "--port") args.port = Number(argv[++i])
    else if (a === "--timeout") args.timeout = Number(argv[++i])
    else if (a === "-h" || a === "--help") {
      process.stdout.write(HELP + "\n")
      process.exit(0)
    } else if (a.startsWith("-")) throw new Error(`unknown option: ${a}`)
    else names.push(a)
  }
  if (names.length === 0) throw new Error("need at least one secret name")
  if (args.dest.startsWith("file:") && names.length > 1) {
    throw new Error("file: stores a single secret — use keychain (default) or env: for multiple")
  }
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

export function exitCode(result: Result): number {
  if (result.stored) return 0
  if (result.error) return 3
  return 2
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

  const result = await session.wait(args.timeout * 1000)
  session.close()

  const code = exitCode(result)
  if (code === 0) process.stdout.write(JSON.stringify(result) + "\n")
  else if (code === 3) log(`keyhole: store failed: ${result.error}`)
  else log("keyhole: timed out, nothing stored")
  return code
}
