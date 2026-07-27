import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import pkg from "../package.json" with { type: "json" }

const root = fileURLToPath(new URL("..", import.meta.url))
const readme = readFileSync(root + "README.md", "utf8")

// Prose drifts silently: nothing fails when a doc keeps claiming what the code stopped
// doing. These pin the two claims that actually went stale.
describe("README", () => {
  it("quotes the current version in every example receipt", () => {
    const quoted = [...readme.matchAll(/"keyhole": "([^"]+)"/g)].map((m) => m[1])
    expect(quoted.length).toBeGreaterThan(0)
    expect([...new Set(quoted)]).toEqual([pkg.version])
  })

  it("references only assets that exist", () => {
    const referenced = [...readme.matchAll(/assets\/[\w.-]+/g)].map((m) => m[0])
    expect(referenced.length).toBeGreaterThan(0)
    const missing = referenced.filter((path) => !existsSync(root + path))
    expect(missing).toEqual([])
  })
})
