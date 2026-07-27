import { randomBytes } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import { buildPage } from "./page.ts"
import { dispatchStore, ValidationError } from "./stores.ts"

export interface Stored {
  name: string
  dest: string
  retrieve: string
}

export type Result =
  | { status: "stored"; secrets: Stored[] }
  | { status: "failed"; error: string }
  | { status: "timeout" }

export interface SessionOpts {
  names: string[]
  dest: string
  context?: string
  port?: number
}

const MAX_BODY = 64 * 1024

export class CaptureSession {
  readonly token = "/" + randomBytes(18).toString("base64url")
  readonly done: Promise<Result>

  private outcome: Result | null = null
  private readonly nonce = randomBytes(16).toString("base64")
  private readonly page: string
  private readonly server: Server
  private resolveDone!: (r: Result) => void

  constructor(private readonly opts: SessionOpts) {
    this.page = buildPage(opts.names, opts.context ?? "", opts.dest, this.token, this.nonce)
    this.done = new Promise((resolve) => (this.resolveDone = resolve))
    this.server = createServer((req, res) => this.handle(req, res))
  }

  listen(): Promise<this> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject)
      this.server.listen(this.opts.port ?? 0, "127.0.0.1", () => resolve(this))
    })
  }

  get port(): number {
    const addr = this.server.address()
    return typeof addr === "object" && addr ? addr.port : 0
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}${this.token}`
  }

  get result(): Result {
    return this.outcome ?? { status: "timeout" }
  }

  async wait(timeoutMs: number): Promise<Result> {
    const timeout = new Promise<Result>((resolve) =>
      setTimeout(() => resolve(this.result), timeoutMs),
    )
    return Promise.race([this.done, timeout])
  }

  close(): void {
    this.server.close()
  }

  // Single-use: the first settle wins and every later submit gets a 409.
  private settle(result: Result): void {
    if (this.outcome) return
    this.outcome = result
    this.resolveDone(result)
  }

  private get csp(): string {
    return [
      "default-src 'none'",
      `script-src 'nonce-${this.nonce}'`,
      `style-src 'nonce-${this.nonce}' https://fonts.googleapis.com`,
      "font-src https://fonts.gstatic.com",
      "connect-src 'self'",
      "form-action 'none'",
      "base-uri 'none'",
    ].join("; ")
  }

  // Host pinned to loopback:port makes the Origin check meaningful and kills DNS-rebinding.
  private loopback(scheme = ""): string[] {
    return [`${scheme}127.0.0.1:${this.port}`, `${scheme}localhost:${this.port}`]
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = req.url ?? ""
    if (req.method === "GET") {
      if (path !== this.token) return reply(res, 404)
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": this.csp,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      })
      res.end(this.page)
      return
    }
    if (req.method !== "POST" || path !== this.token + "/submit") return reply(res, 404)
    if (!this.loopback().includes(req.headers.host ?? "")) return reply(res, 403)
    const origin = req.headers.origin
    if (origin && !this.loopback("http://").includes(origin)) return reply(res, 403)
    if (this.outcome) return reply(res, 409, "already stored")
    if (req.headers["content-length"] == null) return reply(res, 411, "length required")

    let values: Record<string, string>
    try {
      values = (JSON.parse(await readBody(req)).secrets as Record<string, string>) ?? {}
    } catch (e) {
      const tooLarge = e instanceof BodyTooLarge
      return reply(res, tooLarge ? 413 : 400, tooLarge ? "too large" : "bad body")
    }
    for (const name of this.opts.names) {
      if (!values[name]) return reply(res, 400, `empty value for ${name}`)
    }
    try {
      const secrets = this.opts.names.map((name) => {
        const { label, retrieve } = dispatchStore(name, this.opts.dest, values[name])
        return { name, dest: label, retrieve }
      })
      this.settle({ status: "stored", secrets })
      reply(res, 200, "ok")
    } catch (e) {
      if (e instanceof ValidationError) return reply(res, 400, e.message) // retryable
      this.settle({ status: "failed", error: (e as Error).message })
      reply(res, 500, "store error")
    }
  }
}

class BodyTooLarge extends Error {}

function reply(res: ServerResponse, code: number, body = ""): void {
  res.writeHead(code)
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ""
    req.on("data", (chunk) => {
      data += chunk
      if (data.length > MAX_BODY) reject(new BodyTooLarge())
    })
    req.on("end", () => resolve(data))
    req.on("error", reject)
  })
}
