import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it } from "vitest"

import { buildReceipt, RECEIPT_SCHEMA, writeReceipt, type Receipt } from "../src/receipt.ts"
import type { Stored } from "../src/server.ts"
import { mode, tmp } from "./helpers.ts"

const SECRET = "topsecret-do-not-leak-xyz"

const stored: Stored[] = [
  { name: "API_KEY", dest: "keychain", retrieve: "security find-generic-password -s API_KEY" },
  { name: "DB_URL", dest: "env:/tmp/a.env", retrieve: "set -a; source /tmp/a.env; set +a" },
]

let dir: string
beforeEach(() => {
  dir = tmp()
})

describe("buildReceipt", () => {
  it("records what was granted, where, and by which build", () => {
    const receipt = buildReceipt(stored, "deploy needs the staging key")
    expect(receipt).toMatchObject({
      schema: RECEIPT_SCHEMA,
      context: "deploy needs the staging key",
      secrets: stored,
    })
    expect(receipt.keyhole).toMatch(/^\d+\.\d+\.\d+/)
  })

  it.each([
    ["created_at", (r: Receipt) => r.created_at, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/],
    ["request_id", (r: Receipt) => r.request_id, /^[0-9a-f]{16}$/],
  ])("stamps a %s", (_field, read, shape) => {
    expect(read(buildReceipt(stored, ""))).toMatch(shape)
  })

  it("gives each receipt its own request_id", () => {
    const [a, b] = [buildReceipt(stored, ""), buildReceipt(stored, "")]
    expect(a.request_id).not.toBe(b.request_id)
  })

  it("keeps only name, dest, and retrieve per secret", () => {
    expect(Object.keys(buildReceipt(stored, "").secrets[0])).toEqual(["name", "dest", "retrieve"])
  })

  // A digest of a low-entropy secret is an offline oracle, so the value is not recorded
  // in any form. This pins the explicit field pick against a widened Stored type.
  it("drops a value attached to a stored entry instead of copying it through", () => {
    const leaky = [{ ...stored[0], value: SECRET }] as unknown as Stored[]
    expect(JSON.stringify(buildReceipt(leaky, "ctx"))).not.toContain(SECRET)
  })
})

describe("writeReceipt", () => {
  const write = (path: string, context = "ctx") => {
    const receipt = buildReceipt(stored, context)
    writeReceipt(path, receipt)
    return receipt
  }

  it("writes readable JSON at 0600", () => {
    const path = join(dir, "receipt.json")
    const written = write(path)
    const raw = readFileSync(path, "utf8")
    expect(JSON.parse(raw)).toEqual(written)
    expect(raw.endsWith("\n")).toBe(true)
    expect(mode(path)).toBe(0o600)
  })

  it("creates a missing receipt directory", () => {
    const path = join(dir, "nested", "audit", "receipt.json")
    write(path)
    expect(JSON.parse(readFileSync(path, "utf8")).schema).toBe(RECEIPT_SCHEMA)
  })

  it("replaces an earlier receipt and leaves no temp file behind", () => {
    const path = join(dir, "receipt.json")
    write(path, "first")
    write(path, "second")
    expect(JSON.parse(readFileSync(path, "utf8")).context).toBe("second")
    expect(readdirSync(dir)).toEqual(["receipt.json"])
  })
})
