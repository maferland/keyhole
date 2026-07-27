import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { exitCode, parseArgs, updateCheckDisabled } from "../src/cli.ts"
import type { Result } from "../src/server.ts"

describe("parseArgs", () => {
  it("parses names, dest and options", () => {
    const a = parseArgs(["A", "B", "--dest", "env:/x", "--timeout", "30"])
    expect(a.names).toEqual(["A", "B"])
    expect(a.dest).toBe("env:/x")
    expect(a.timeout).toBe(30)
  })

  it("defaults to keychain, a random port, a 300s timeout and no receipt", () => {
    expect(parseArgs(["A"])).toMatchObject({
      dest: "keychain",
      port: 0,
      timeout: 300,
      receipt: "",
    })
  })

  it("takes a receipt path", () => {
    expect(parseArgs(["A", "--receipt", "./audit/r.json"]).receipt).toBe("./audit/r.json")
  })

  it("keeps a context value that looks like a flag", () => {
    expect(parseArgs(["A", "--context", "-n flag-ish text"]).context).toBe("-n flag-ish text")
  })

  it.each(["--dest", "--context", "--port", "--timeout", "--receipt"])(
    "rejects %s without a value",
    (flag) => {
      expect(() => parseArgs(["A", flag])).toThrow(/needs a value/)
    },
  )

  it.each([
    ["--port", "abc"],
    ["--port", "-1"],
    ["--timeout", "abc"],
    ["--timeout", "1.5"],
    ["--timeout", "0"],
  ])("rejects %s %s", (flag, raw) => {
    expect(() => parseArgs(["A", flag, raw])).toThrow(/needs an integer/)
  })

  it("requires at least one name", () => {
    expect(() => parseArgs(["--dest", "keychain"])).toThrow(/at least one/)
  })

  it("rejects an unknown option", () => {
    expect(() => parseArgs(["A", "--nope"])).toThrow(/unknown option/)
  })
})

// Every dest problem knowable up front must fail here, before a browser opens and a
// human types a secret into a form that can never succeed.
describe("parseArgs dest validation", () => {
  it.each([
    [["A", "B", "--dest", "file:/x"], /single secret/],
    [["A", "--dest", "file:"], /needs a path/],
    [["A", "--dest", "env:"], /needs a path/],
    [["1BAD", "--dest", "env:/x"], /invalid variable name '1BAD'/],
    [["OK", "also bad", "--dest", "env:/x"], /invalid variable name 'also bad'/],
    [["A", "--dest", "keychain:"], /empty service/],
    [["A", "--dest", "s3://bucket"], /unknown --dest/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message)
  })

  it.each(["keychain", "keychain:svc", "file:/tmp/x", "env:/tmp/x"])("accepts %s", (dest) => {
    expect(parseArgs(["API_KEY", "--dest", dest]).dest).toBe(dest)
  })

  it("does not apply env name rules to other dests", () => {
    expect(parseArgs(["not-an-env-name", "--dest", "file:/tmp/x"]).names).toEqual([
      "not-an-env-name",
    ])
  })
})

describe("exitCode", () => {
  it.each<[Result, number]>([
    [{ status: "stored", secrets: [] }, 0],
    [{ status: "timeout" }, 2],
    [{ status: "failed", error: "boom" }, 3],
  ])("maps %j to exit %i", (result, code) => {
    expect(exitCode(result)).toBe(code)
  })
})

describe("updateCheckDisabled", () => {
  const ENV_KEYS = ["CLAUDE_PLUGIN_ROOT", "KEYHOLE_NO_UPDATE_CHECK"] as const
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    ENV_KEYS.forEach((key) => {
      saved[key] = process.env[key]
      delete process.env[key]
    })
  })
  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    })
  })

  it("checks by default", () => {
    expect(updateCheckDisabled()).toBe(false)
  })

  it.each(ENV_KEYS)("skips the check when %s is set", (key) => {
    process.env[key] = "1"
    expect(updateCheckDisabled()).toBe(true)
  })
})
