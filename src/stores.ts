import { spawnSync } from "node:child_process"
import {
  closeSync,
  constants as FS,
  existsSync,
  fchmodSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
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
  // `security` has no stdin input mode, so the value rides in argv and is visible to
  // same-user processes for the duration of this call. No lower-exposure path exists.
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

function ensureParent(path: string): void {
  mkdirSync(dirname(path) || ".", { recursive: true, mode: 0o700 })
}

// No-follow open + fchmod: refuse symlinks, force 0600 even on an existing file.
function open0600(path: string): number {
  const fd = openSync(path, FS.O_WRONLY | FS.O_CREAT | FS.O_TRUNC | FS.O_NOFOLLOW, 0o600)
  fchmodSync(fd, 0o600)
  return fd
}

function readNoFollow(path: string): string {
  const fd = openSync(path, FS.O_RDONLY | FS.O_NOFOLLOW)
  try {
    return readFileSync(fd, "utf8")
  } finally {
    closeSync(fd)
  }
}

function writeFd(fd: number, data: string): void {
  try {
    writeSync(fd, data)
  } finally {
    closeSync(fd)
  }
}

// Temp + rename so an interrupted rewrite cannot leave the file truncated. Replaces a
// symlink at `path` instead of refusing it, which is safe: nothing is written through it.
function writeAtomic0600(path: string, data: string): void {
  const tmp = `${path}.keyhole-${process.pid}`
  writeFd(open0600(tmp), data)
  renameSync(tmp, path)
}

export function storeFile(path: string, value: string): string {
  path = expandHome(path)
  ensureParent(path)
  // Direct no-follow write: refusing a symlinked destination matters more than
  // atomicity here, since the whole file content is this one value.
  writeFd(open0600(path), value)
  return path
}

export function storeEnv(name: string, path: string, value: string): string {
  if (!ENV_NAME.test(name)) throw new ValidationError(`env: invalid variable name '${name}'`)
  if (/[\n\r]/.test(value))
    throw new ValidationError("env: cannot store a value containing newlines")
  path = expandHome(path)
  ensureParent(path)
  const kept = existsSync(path)
    ? readNoFollow(path)
        .split("\n")
        .filter(Boolean)
        .filter((line) => line.split("=", 1)[0] !== name) // exact-key dedup, not prefix
        .map((line) => line + "\n")
        .join("")
    : ""
  writeAtomic0600(path, kept + `${name}=${value}\n`)
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

// Everything knowable about a --dest before the browser opens, so a doomed run never
// gets as far as a human typing a secret into it.
export function validateDest(dest: string, names: string[]): void {
  if (dest === "keychain") return
  if (dest.startsWith("keychain:")) {
    if (!keychainService(names[0], dest)) throw new Error("keychain: empty service name")
    return
  }
  if (dest.startsWith("file:")) {
    if (!dest.slice(5)) throw new Error("file: needs a path")
    if (names.length > 1)
      throw new Error("file: stores a single secret — use keychain (default) or env: for multiple")
    return
  }
  if (dest.startsWith("env:")) {
    if (!dest.slice(4)) throw new Error("env: needs a path")
    const bad = names.find((name) => !ENV_NAME.test(name))
    if (bad) throw new Error(`env: invalid variable name '${bad}'`)
    return
  }
  throw new Error(`unknown --dest: '${dest}'`)
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
