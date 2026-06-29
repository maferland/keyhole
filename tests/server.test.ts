import { mkdtempSync, readFileSync, symlinkSync } from "node:fs"
import { connect } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { exitCode, parseArgs } from "../src/cli.ts"
import { CaptureSession } from "../src/server.ts"

const SECRET = "topsecret-do-not-leak-xyz"
const tmp = () => mkdtempSync(join(tmpdir(), "getsecret-"))

let open: CaptureSession[] = []
afterEach(() => {
  open.forEach((s) => s.close())
  open = []
})

async function start(names: string[], dest: string): Promise<CaptureSession> {
  const s = await new CaptureSession({ names, dest }).listen()
  open.push(s)
  return s
}

interface RawOpts {
  method?: string
  path: string
  host?: string
  origin?: string
  body?: string
  sendLength?: boolean
}

function raw(port: number, opts: RawOpts): Promise<{ status: number; body: string }> {
  const { method = "GET", path, origin, body, sendLength = true } = opts
  const host = opts.host ?? `127.0.0.1:${port}`
  const lines = [`${method} ${path} HTTP/1.1`, `Host: ${host}`, "Connection: close"]
  if (origin) lines.push(`Origin: ${origin}`)
  if (body !== undefined) {
    lines.push("Content-Type: application/json")
    if (sendLength) lines.push(`Content-Length: ${Buffer.byteLength(body)}`)
  }
  const payload = lines.join("\r\n") + "\r\n\r\n" + (body ?? "")
  return new Promise((resolve, reject) => {
    const sock = connect(port, "127.0.0.1", () => sock.write(payload))
    let data = ""
    sock.on("data", (d) => (data += d))
    sock.on("end", () => {
      resolve({
        status: Number(data.split(" ")[1]),
        body: data.split("\r\n\r\n").slice(1).join("\r\n\r\n"),
      })
    })
    sock.on("error", reject)
  })
}

const submit = (s: CaptureSession, secrets: Record<string, string>, extra: Partial<RawOpts> = {}) =>
  raw(s.port, {
    method: "POST",
    path: s.token + "/submit",
    body: JSON.stringify({ secrets }),
    ...extra,
  })

describe("GET form", () => {
  it("serves the form at the token path", async () => {
    const s = await start(["API_KEY"], `file:${join(tmp(), "o")}`)
    const r = await raw(s.port, { path: s.token })
    expect(r.status).toBe(200)
    expect(r.body).toContain("Provide a secret")
    expect(r.body).toContain("API_KEY")
    expect(r.body).toContain(s.token + "/submit")
  })

  it("matches the token exactly, not as a prefix", async () => {
    const s = await start(["API_KEY"], `file:${join(tmp(), "o")}`)
    expect((await raw(s.port, { path: s.token + "evil" })).status).toBe(404)
    expect((await raw(s.port, { path: "/" })).status).toBe(404)
  })
})

describe("POST guards", () => {
  it("404s a wrong path", async () => {
    const s = await start(["API_KEY"], `file:${join(tmp(), "o")}`)
    expect((await raw(s.port, { method: "POST", path: "/nope" })).status).toBe(404)
  })

  it("rejects a rebinding Host", async () => {
    const s = await start(["API_KEY"], `file:${join(tmp(), "o")}`)
    const r = await submit(s, { API_KEY: SECRET }, { host: "evil.example:1234" })
    expect(r.status).toBe(403)
    expect(s.result.stored).toBeUndefined()
  })

  it("rejects a foreign Origin", async () => {
    const s = await start(["API_KEY"], `file:${join(tmp(), "o")}`)
    expect((await submit(s, { API_KEY: SECRET }, { origin: "http://evil.example" })).status).toBe(
      403,
    )
  })

  it("accepts the localhost alias", async () => {
    const s = await start(["API_KEY"], `file:${join(tmp(), "o")}`)
    const r = await submit(
      s,
      { API_KEY: SECRET },
      {
        host: `localhost:${s.port}`,
        origin: `http://localhost:${s.port}`,
      },
    )
    expect(r.status).toBe(200)
  })

  it("411s a missing content-length", async () => {
    const s = await start(["API_KEY"], `file:${join(tmp(), "o")}`)
    const r = await submit(s, { API_KEY: SECRET }, { sendLength: false })
    expect(r.status).toBe(411)
  })

  it("400s an empty value", async () => {
    const s = await start(["API_KEY"], `file:${join(tmp(), "o")}`)
    expect((await submit(s, { API_KEY: "" })).status).toBe(400)
  })
})

describe("store + single-use", () => {
  it("stores and resolves done without leaking the value", async () => {
    const p = join(tmp(), "out.secret")
    const s = await start(["API_KEY"], `file:${p}`)
    const r = await submit(s, { API_KEY: SECRET })
    expect(r.status).toBe(200)
    const result = await s.wait(0)
    expect(result.stored).toBe(true)
    expect(result.secrets?.[0]).toMatchObject({ name: "API_KEY", dest: `file:${p}` })
    expect(readFileSync(p, "utf8")).toBe(SECRET)
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })

  it("409s a second submit and does not overwrite", async () => {
    const p = join(tmp(), "out.secret")
    const s = await start(["API_KEY"], `file:${p}`)
    expect((await submit(s, { API_KEY: SECRET })).status).toBe(200)
    const r = await submit(s, { API_KEY: "second" })
    expect(r.status).toBe(409)
    expect(readFileSync(p, "utf8")).toBe(SECRET)
  })

  it("captures multiple secrets in one form", async () => {
    const p = join(tmp(), "multi.env")
    const s = await start(["A_KEY", "B_KEY"], `env:${p}`)
    const r = await submit(s, { A_KEY: "aaa", B_KEY: "bbb" })
    expect(r.status).toBe(200)
    expect(s.result.secrets).toHaveLength(2)
    const env = readFileSync(p, "utf8")
    expect(env).toContain("A_KEY=aaa")
    expect(env).toContain("B_KEY=bbb")
  })
})

describe("failure paths", () => {
  it("500s a hard store failure, fails fast, no leak", async () => {
    const dir = tmp()
    symlinkSync(join(dir, "target"), join(dir, "link"))
    const s = await start(["API_KEY"], `file:${join(dir, "link")}`)
    const r = await submit(s, { API_KEY: SECRET })
    expect(r.status).toBe(500)
    expect(r.body).toContain("store error")
    expect(s.result.error).toBeDefined()
    expect(s.result.error).not.toContain(SECRET)
    expect(exitCode(s.result)).toBe(3)
  })

  it("400s a validation failure and stays open for retry", async () => {
    const s = await start(["API_KEY"], `env:${join(tmp(), "a.env")}`)
    expect((await submit(s, { API_KEY: "line1\nINJECTED=1" })).status).toBe(400)
    expect(s.result.stored).toBeUndefined()
    expect((await submit(s, { API_KEY: "clean" })).status).toBe(200)
  })
})

describe("cli", () => {
  it("parses names, dest and options", () => {
    const a = parseArgs(["A", "B", "--dest", "env:/x", "--timeout", "30"])
    expect(a.names).toEqual(["A", "B"])
    expect(a.dest).toBe("env:/x")
    expect(a.timeout).toBe(30)
  })

  it("rejects file: with multiple secrets", () => {
    expect(() => parseArgs(["A", "B", "--dest", "file:/x"])).toThrow()
  })

  it("requires at least one name", () => {
    expect(() => parseArgs(["--dest", "keychain"])).toThrow()
  })

  it.each([
    [{ stored: true }, 0],
    [{ error: "boom" }, 3],
    [{}, 2],
  ])("maps result %j to exit %i", (result, code) => {
    expect(exitCode(result)).toBe(code)
  })
})
