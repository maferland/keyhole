import { mkdtempSync, statSync, symlinkSync, writeFileSync, chmodSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  dispatchStore,
  keychainService,
  storeEnv,
  storeFile,
  storeKeychain,
  ValidationError,
} from "../src/stores.ts"

const SECRET = "sk-unit-do-not-leak-001"
const tmp = () => mkdtempSync(join(tmpdir(), "getsecret-"))
const mode = (p: string) => statSync(p).mode & 0o777

describe("storeFile", () => {
  it("writes the value at 0600", () => {
    const p = join(tmp(), "k.secret")
    expect(storeFile(p, SECRET)).toBe(p)
    expect(readFileSync(p, "utf8")).toBe(SECRET)
    expect(mode(p)).toBe(0o600)
  })

  it("forces 0600 on a pre-existing loose file", () => {
    const p = join(tmp(), "loose.secret")
    writeFileSync(p, "old")
    chmodSync(p, 0o644)
    storeFile(p, SECRET)
    expect(mode(p)).toBe(0o600)
  })

  it("refuses to follow a symlink", () => {
    const dir = tmp()
    const link = join(dir, "link")
    symlinkSync(join(dir, "target"), link)
    expect(() => storeFile(link, SECRET)).toThrow()
    expect(() => statSync(join(dir, "target"))).toThrow()
  })
})

describe("storeEnv", () => {
  // The atomic rewrite would happily replace a symlink, so the O_NOFOLLOW read in front
  // of it is what actually refuses a redirected destination. Pinned because a comment
  // used to claim the opposite.
  it("refuses a symlinked env file and leaves its target alone", () => {
    const dir = tmp()
    const outside = join(dir, "outside.txt")
    writeFileSync(outside, "ORIGINAL\n")
    const link = join(dir, "link.env")
    symlinkSync(outside, link)
    expect(() => storeEnv("KEY", link, SECRET)).toThrow(/ELOOP/)
    expect(readFileSync(outside, "utf8")).toBe("ORIGINAL\n")
  })

  it("writes NAME=value", () => {
    const p = join(tmp(), "app.env")
    storeEnv("API_KEY", p, SECRET)
    expect(readFileSync(p, "utf8")).toBe(`API_KEY=${SECRET}\n`)
    expect(mode(p)).toBe(0o600)
  })

  it("dedups by exact key, preserving prefix overlaps", () => {
    const p = join(tmp(), "app.env")
    writeFileSync(p, "API_KEY=keep\nAPI=replace\nOTHER=stay\n")
    storeEnv("API", p, "new")
    const lines = readFileSync(p, "utf8").trim().split("\n")
    expect(lines).toContain("API_KEY=keep")
    expect(lines).toContain("OTHER=stay")
    expect(lines).toContain("API=new")
    expect(lines).not.toContain("API=replace")
  })

  it("interpolates the real var name in the retrieve hint", () => {
    const hint = storeEnv("OPENAI_API_KEY", join(tmp(), "x.env"), SECRET)
    expect(hint).toContain("${OPENAI_API_KEY}")
  })

  it.each(["val\nINJECTED=1", "val\rINJECTED=1"])("rejects newline value %j", (bad) => {
    expect(() => storeEnv("API_KEY", join(tmp(), "x.env"), bad)).toThrow(ValidationError)
  })

  it.each(["1abc", "a-b", "a b", "", "FOO=BAR"])("rejects invalid name %j", (bad) => {
    expect(() => storeEnv(bad, join(tmp(), "x.env"), SECRET)).toThrow(ValidationError)
  })
})

describe("storeKeychain", () => {
  const spy = () => {
    const calls: string[][] = []
    return {
      calls,
      run: (_cmd: string, args: string[]) => (calls.push(args), { status: 0, stderr: "" }),
    }
  }

  it("builds the security argv and returns a find hint", () => {
    const { calls, run } = spy()
    const hint = storeKeychain("my-svc", SECRET, run)
    expect(calls[0].slice(0, 3)).toEqual(["add-generic-password", "-U", "-a"])
    expect(calls[0]).toContain("my-svc")
    expect(hint).toContain("find-generic-password -s my-svc")
  })

  // Reverted from stdin in 0.8.1: the prompt reader caps the value at 128 bytes and
  // truncates silently, so a long token was stored wrong while reporting success.
  it.each([SECRET, "a".repeat(500), "has spaces", "multi\nline"])(
    "hands security the exact value %j",
    (value) => {
      const { calls, run } = spy()
      storeKeychain("svc", value, run)
      expect(calls[0].at(-1)).toBe(value)
    },
  )

  it("throws when security exits non-zero", () => {
    const run = () => ({ status: 1, stderr: "nope" })
    expect(() => storeKeychain("s", SECRET, run)).toThrow()
  })
})

describe("dispatchStore", () => {
  it.each([
    ["keychain", "NAME"],
    ["keychain:custom", "custom"],
  ])("resolves keychain service for %s", (dest, expected) => {
    expect(keychainService("NAME", dest)).toBe(expected)
  })

  it("routes file:", () => {
    const p = join(tmp(), "d.secret")
    expect(dispatchStore("N", `file:${p}`, SECRET)).toEqual({ label: `file:${p}`, retrieve: p })
  })

  it("routes env:", () => {
    const p = join(tmp(), "d.env")
    const out = dispatchStore("API_KEY", `env:${p}`, SECRET)
    expect(out.label).toBe(`env:${p}`)
    expect(out.retrieve).toContain("source")
  })

  it("rejects an unknown dest", () => {
    expect(() => dispatchStore("N", "s3://x", SECRET)).toThrow(ValidationError)
  })
})
