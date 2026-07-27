import { describe, expect, it } from "vitest"

import { buildPage } from "../src/page.ts"

const page = (names: string[], context = "", dest = "keychain") =>
  buildPage(names, context, dest, "/tok3n", "n0nce")

describe("buildPage escaping", () => {
  it("escapes context instead of rendering markup", () => {
    const html = page(["API_KEY"], '<img src=x onerror=alert(1)>"')
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;&quot;")
    expect(html).not.toContain("<img src=x")
  })

  it("escapes secret names", () => {
    expect(page(["<b>NAME</b>"])).not.toContain("<b>NAME</b>")
  })

  // Regression: multi-pass substitution used to re-scan inserted text, so a value
  // containing a placeholder name got expanded by a later pass.
  it.each(["{eyeIcon}", "{fields}", "{token}", "{destJson}"])(
    "does not expand %s coming from context",
    (placeholder) => {
      const html = page(["API_KEY"], placeholder)
      expect(html).toContain(`<div class=chip-ctx>${placeholder}</div>`)
    },
  )

  it("does not expand a placeholder coming from a secret name", () => {
    expect(page(["{token}"])).toContain('<label for="s0">{token}</label>')
  })

  it("leaves the page's own literal braces alone", () => {
    expect(page(["API_KEY"])).toContain("JSON.stringify({secrets})")
  })

  it("passes dest to the client unescaped, as a JS string literal", () => {
    expect(page(["K"], "", 'file:/tmp/a"b&c')).toContain('dest="file:/tmp/a\\"b&c"')
  })
})

describe("buildPage content", () => {
  it("omits the context chip when there is no context", () => {
    expect(page(["API_KEY"])).not.toContain("<div class=chip-ctx")
  })

  // The chip wraps rather than truncating, so no title-attribute fallback is needed.
  it("renders context as visible wrapping text, not a tooltip", () => {
    const html = page(["API_KEY"], "why the agent needs this")
    expect(html).toContain("<div class=chip-ctx>why the agent needs this</div>")
    expect(html).not.toContain('title="why the agent needs this"')
    expect(html).toMatch(/\.chip-ctx\{[^}]*overflow-wrap:break-word/)
    expect(html).not.toMatch(/\.chip-ctx\{[^}]*white-space:nowrap/)
  })

  it("stamps the CSP nonce on both inline blocks and fetches no third-party script", () => {
    const html = page(["API_KEY"])
    expect(html).toContain('<style nonce="n0nce">')
    expect(html).toContain('<script nonce="n0nce">')
    expect(html).not.toContain("registry.npmjs.org")
  })

  it("shows the capture URL without a doubled slash", () => {
    expect(page(["A"])).toContain("<div class=url>127.0.0.1/s/tok3n</div>")
  })

  it("closes every svg attribute so the eye icon renders", () => {
    expect(page(["A"])).not.toMatch(/=\d+\/>/)
  })

  it("builds one field per name and posts to the token path", () => {
    const html = page(["A_KEY", "B_KEY"])
    expect(html).toContain('data-name="A_KEY"')
    expect(html).toContain('data-name="B_KEY"')
    expect(html).toContain("Your agent needs 2 secrets")
    expect(html).toContain("'/tok3n/submit'")
  })

  it("disables the file chip when several secrets are captured", () => {
    expect(page(["A", "B"])).toContain("dchip dis")
    expect(page(["A"])).not.toContain("dchip dis")
  })

  it.each([
    ["keychain", "keychain"],
    ["file:/tmp/x", "file"],
    ["env:/tmp/x", "env"],
  ])("preselects the chip matching dest %s", (dest, chip) => {
    expect(page(["A"], "", dest)).toContain(`<div class="dchip on" data-d=${chip}`)
  })

  it("never prefills an input", () => {
    expect(page(["API_KEY"], "ctx")).not.toMatch(/<input[^>]*\svalue=/)
  })
})
