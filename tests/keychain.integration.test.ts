import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { userInfo } from "node:os"

import { afterEach, describe, expect, it } from "vitest"

import { storeKeychain } from "../src/stores.ts"

// Fake-Runner tests prove what keyhole sends, not what `security` does, so 0.8.0's
// truncation was invisible. Opt-in: writes a throwaway item, so CI enables it, not you.
const enabled =
  process.platform === "darwin" &&
  Boolean(process.env.KEYHOLE_KEYCHAIN_TEST) &&
  spawnSync("security", ["list-keychains"]).status === 0

const account = userInfo().username
const services: string[] = []

// `-w` prints hex when the stored bytes are not plain ASCII, so decode before comparing.
function readBack(service: string): string {
  const out = spawnSync("security", ["find-generic-password", "-s", service, "-a", account, "-w"], {
    encoding: "utf8",
  }).stdout.trimEnd()
  return /^([0-9a-f]{2})+$/.test(out) ? Buffer.from(out, "hex").toString("utf8") : out
}

const exists = (service: string) =>
  spawnSync("security", ["find-generic-password", "-s", service, "-a", account]).status === 0

afterEach(() => {
  services.splice(0).forEach((service) => {
    spawnSync("security", ["delete-generic-password", "-s", service, "-a", account])
  })
})

function service(): string {
  const name = `keyhole-test-${randomBytes(6).toString("hex")}`
  services.push(name)
  return name
}

describe.skipIf(!enabled)("storeKeychain against the real security binary", () => {
  it("returns a hint that actually retrieves the value", () => {
    const svc = service()
    const value = `sk-live-${randomBytes(8).toString("hex")}`
    expect(storeKeychain(svc, value)).toBe(
      `security find-generic-password -s ${svc} -a ${account} -w`,
    )
    expect(readBack(svc)).toBe(value)
  })

  // The bug 0.8.0 shipped: the stdin prompt capped the value at 128 bytes silently.
  it.each([1, 128, 129, 500, 4000])("stores a %i-byte value without truncating", (length) => {
    const svc = service()
    const value = "k" + "a".repeat(length - 1)
    storeKeychain(svc, value)
    expect(readBack(svc)).toHaveLength(length)
    expect(readBack(svc)).toBe(value)
  })

  it.each(["has spaces", 'quote"inside', "back\\slash", "semi;colon", "$(id)", "emoji 🔑 éàü"])(
    "round-trips %j",
    (value) => {
      const svc = service()
      storeKeychain(svc, value)
      expect(readBack(svc)).toBe(value)
    },
  )

  it("overwrites rather than adding a second item", () => {
    const svc = service()
    storeKeychain(svc, "first-value")
    storeKeychain(svc, "second-value")
    expect(readBack(svc)).toBe("second-value")
  })

  it("stores a multi-line value intact", () => {
    const svc = service()
    const pem = "-----BEGIN KEY-----\nabc\ndef\n-----END KEY-----"
    storeKeychain(svc, pem)
    expect(readBack(svc)).toBe(pem)
  })

  it("creates nothing when security fails", () => {
    const svc = service()
    expect(() => storeKeychain(svc, "v", () => ({ status: 1, stderr: "boom" }))).toThrow()
    expect(exists(svc)).toBe(false)
  })
})
