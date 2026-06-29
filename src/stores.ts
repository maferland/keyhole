import { spawnSync } from "node:child_process"
import {
  closeSync,
  constants as FS,
  existsSync,
  fchmodSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
} from "node:fs"
import { homedir, userInfo } from "node:os"
import { dirname } from "node:path"

// Bad input the form can correct (400 + retry), distinct from a hard failure (500).
export class ValidationError extends Error {}

export const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

export type Runner = (cmd: string, args: string[]) => { status: number | null; stderr: string }

const defaultRunner: Runner = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" })
  return { status: r.status, stderr: r.stderr ?? "" }
}

export function storeKeychain(
  name: string,
  service: string,
  value: string,
  run: Runner = defaultRunner,
): string {
  const account = userInfo().username
  const r = run("security", [
    "add-generic-password",
    "-U",
    "-a",
    account,
    "-s",
    service,
    "-w",
    value,
  ])
  if (r.status !== 0) throw new Error(`keychain store failed (security exit ${r.status})`)
  return `security find-generic-password -s ${service} -a ${account} -w`
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? homedir() + path.slice(1) : path
}

// No-follow open + fchmod: refuse symlinks, force 0600 even on an existing file.
function open0600(path: string): number {
  const fd = openSync(path, FS.O_WRONLY | FS.O_CREAT | FS.O_TRUNC | FS.O_NOFOLLOW, 0o600)
  fchmodSync(fd, 0o600)
  return fd
}

export function storeFile(path: string, value: string): string {
  path = expandHome(path)
  mkdirSync(dirname(path) || ".", { recursive: true })
  const fd = open0600(path)
  writeSync(fd, value)
  closeSync(fd)
  return path
}

export function storeEnv(name: string, path: string, value: string): string {
  if (!ENV_NAME.test(name)) throw new ValidationError(`env: invalid variable name '${name}'`)
  if (/[\n\r]/.test(value))
    throw new ValidationError("env: cannot store a value containing newlines")
  path = expandHome(path)
  mkdirSync(dirname(path) || ".", { recursive: true })
  let existing = ""
  if (existsSync(path)) {
    existing = readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .filter((line) => line.split("=", 1)[0] !== name) // exact-key dedup, not prefix
      .map((line) => line + "\n")
      .join("")
  }
  const fd = open0600(path)
  writeSync(fd, existing + `${name}=${value}\n`)
  closeSync(fd)
  return `set -a; source ${path}; set +a   # then \${${name}}`
}

export function keychainService(name: string, dest: string): string {
  const idx = dest.indexOf(":")
  return idx === -1 ? name : dest.slice(idx + 1)
}

export interface StoreResult {
  label: string
  retrieve: string
}

export function dispatchStore(name: string, dest: string, value: string): StoreResult {
  if (dest === "keychain" || dest.startsWith("keychain:")) {
    const service = keychainService(name, dest)
    return { label: `keychain:${service}`, retrieve: storeKeychain(name, service, value) }
  }
  if (dest.startsWith("file:")) return { label: dest, retrieve: storeFile(dest.slice(5), value) }
  if (dest.startsWith("env:"))
    return { label: dest, retrieve: storeEnv(name, dest.slice(4), value) }
  throw new ValidationError(`unknown --dest: '${dest}'`)
}
