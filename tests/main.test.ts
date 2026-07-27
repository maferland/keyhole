import { chmodSync, existsSync, readFileSync, symlinkSync } from "node:fs"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { main } from "../src/cli.ts"
import { tmp } from "./helpers.ts"

const SECRET = "topsecret-do-not-leak-xyz"

// main() spawns a browser and checks npm for updates. Both are switched off through the
// documented env vars rather than mocked, so the test drives the real code path.
beforeEach(() => {
  vi.stubEnv("BROWSER", "true")
  vi.stubEnv("KEYHOLE_NO_UPDATE_CHECK", "1")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

interface Run {
  code: Promise<number>
  stdout: () => string
  stderr: () => string
}

function run(argv: string[]): Run {
  const out: string[] = []
  const err: string[] = []
  const sinkTo = (lines: string[]) => (chunk: unknown) => {
    lines.push(String(chunk))
    return true
  }
  vi.spyOn(process.stdout, "write").mockImplementation(sinkTo(out))
  vi.spyOn(process.stderr, "write").mockImplementation(sinkTo(err))
  return { code: main(argv), stdout: () => out.join(""), stderr: () => err.join("") }
}

// The reporter shares this stdout, so the contract is the one JSON line, not the buffer.
const wire = (stdout: string) => stdout.split("\n").find((l) => l.startsWith('{"stored"')) ?? ""

// The URL is only knowable from what main() logged, which is how a human finds it too.
async function url(active: Run): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const match = active.stderr().match(/http:\/\/127\.0\.0\.1:\d+\/\S+/)
    if (match) return match[0]
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`main() never logged a URL: ${active.stderr()}`)
}

async function capture(argv: string[], secrets: Record<string, string>) {
  const active = run(argv)
  const response = await fetch(`${await url(active)}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secrets }),
  })
  return { ...active, code: await active.code, response }
}

describe("main", () => {
  let dir: string
  beforeEach(() => {
    dir = tmp()
  })

  it("stores, prints the wire format, and exits 0", async () => {
    const dest = join(dir, "out.secret")
    const result = await capture(["API_KEY", "--dest", `file:${dest}`], { API_KEY: SECRET })
    expect(result.code).toBe(0)
    expect(JSON.parse(wire(result.stdout()))).toEqual({
      stored: true,
      secrets: [{ name: "API_KEY", dest: `file:${dest}`, retrieve: dest }],
    })
    expect(readFileSync(dest, "utf8")).toBe(SECRET)
  })

  it("keeps the secret out of both streams", async () => {
    const result = await capture(["API_KEY", "--dest", `file:${join(dir, "o")}`], {
      API_KEY: SECRET,
    })
    expect(result.stdout()).not.toContain(SECRET)
    expect(result.stderr()).not.toContain(SECRET)
  })

  it("writes a receipt when asked", async () => {
    const receipt = join(dir, "audit", "receipt.json")
    const result = await capture(
      ["API_KEY", "--dest", `file:${join(dir, "o")}`, "--receipt", receipt, "--context", "why"],
      { API_KEY: SECRET },
    )
    expect(result.code).toBe(0)
    const written = JSON.parse(readFileSync(receipt, "utf8"))
    expect(written).toMatchObject({ context: "why", secrets: [{ name: "API_KEY" }] })
    expect(JSON.stringify(written)).not.toContain(SECRET)
  })

  it("writes no receipt unless asked", async () => {
    await capture(["API_KEY", "--dest", `file:${join(dir, "o")}`], { API_KEY: SECRET })
    expect(existsSync(join(dir, "receipt.json"))).toBe(false)
  })

  // The secret is stored by then, so failing here would invite a retry that asks a human
  // to type it a second time.
  it("warns but still exits 0 when the receipt cannot be written", async () => {
    chmodSync(dir, 0o500)
    const result = await capture(
      ["API_KEY", "--dest", `file:${join(tmp(), "o")}`, "--receipt", join(dir, "no", "r.json")],
      { API_KEY: SECRET },
    )
    chmodSync(dir, 0o700)
    expect(result.code).toBe(0)
    expect(result.stderr()).toMatch(/warning: no receipt written/)
    expect(JSON.parse(wire(result.stdout())).stored).toBe(true)
  })

  it("exits 3 on a store failure without echoing the value", async () => {
    symlinkSync(join(dir, "target"), join(dir, "link"))
    const result = await capture(["API_KEY", "--dest", `file:${join(dir, "link")}`], {
      API_KEY: SECRET,
    })
    expect(result.response.status).toBe(500)
    expect(result.code).toBe(3)
    expect(wire(result.stdout())).toBe("")
    expect(result.stderr()).toMatch(/store failed/)
    expect(result.stderr()).not.toContain(SECRET)
  })

  it.each([
    [["--dest", "file:/tmp/x"], /need at least one secret name/],
    [["A", "--dest", "s3://bucket"], /unknown --dest/],
    [["A", "--timeout", "abc"], /needs an integer/],
    [["A", "--nope"], /unknown option/],
  ])("exits 2 on bad usage %j, before any server starts", async (argv, message) => {
    const active = run(argv)
    expect(await active.code).toBe(2)
    expect(active.stderr()).toMatch(message)
    expect(active.stderr()).not.toMatch(/127\.0\.0\.1/)
    expect(wire(active.stdout())).toBe("")
  })

  it("exits 2 and stores nothing when nobody submits", async () => {
    const dest = join(dir, "never.secret")
    const active = run(["API_KEY", "--dest", `file:${dest}`, "--timeout", "1"])
    await url(active)
    expect(await active.code).toBe(2)
    expect(active.stderr()).toMatch(/timed out, nothing stored/)
    expect(existsSync(dest)).toBe(false)
  })
})
