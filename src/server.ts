import { randomBytes } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"

import { buildPage } from "./page.ts"
import { dispatchStore, ValidationError } from "./stores.ts"

export interface Stored {
  name: string
  dest: string
  retrieve: string
}

export interface Result {
  stored?: boolean
  secrets?: Stored[]
  error?: string
}

export interface SessionOpts {
  names: string[]
  dest: string
  context?: string
  port?: number
}

export class CaptureSession {
  readonly token = "/" + randomBytes(18).toString("base64url")
  readonly result: Result = {}
  readonly done: Promise<Result>

  private settled = false
  private readonly page: string
  private readonly server: Server
  private resolveDone!: (r: Result) => void

  constructor(private readonly opts: SessionOpts) {
    this.page = buildPage(opts.names, opts.context ?? "", opts.dest, this.token)
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

  async wait(timeoutMs: number): Promise<Result> {
    const timeout = new Promise<Result>((resolve) =>
      setTimeout(() => resolve(this.result), timeoutMs),
    )
    return Promise.race([this.done, timeout])
  }

  close(): void {
    this.server.close()
  }

  // Host pinned to loopback:port makes the Origin check meaningful and kills DNS-rebinding.
  private loopback(scheme = ""): string[] {
    return [`${scheme}127.0.0.1:${this.port}`, `${scheme}localhost:${this.port}`]
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = req.url ?? ""
    if (req.method === "GET") {
      if (path !== this.token) return reply(res, 404)
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      res.end(this.page)
      return
    }
    if (req.method !== "POST" || path !== this.token + "/submit") return reply(res, 404)
    if (!this.loopback().includes(req.headers.host ?? "")) return reply(res, 403)
    const origin = req.headers.origin
    if (origin && !this.loopback("http://").includes(origin)) return reply(res, 403)
    if (this.settled) return reply(res, 409, "already stored")
    if (req.headers["content-length"] == null) return reply(res, 411, "length required")

    let values: Record<string, string>
    try {
      values = (JSON.parse(await readBody(req)).secrets as Record<string, string>) ?? {}
    } catch {
      return reply(res, 400, "bad body")
    }
    for (const name of this.opts.names) {
      if (!values[name]) return reply(res, 400, `empty value for ${name}`)
    }
    try {
      const secrets = this.opts.names.map((name) => {
        const { label, retrieve } = dispatchStore(name, this.opts.dest, values[name])
        return { name, dest: label, retrieve }
      })
      this.settled = true
      this.result.stored = true
      this.result.secrets = secrets
      this.resolveDone(this.result)
      reply(res, 200, "ok")
    } catch (e) {
      if (e instanceof ValidationError) return reply(res, 400, e.message) // retryable
      this.result.error = (e as Error).message
      this.settled = true
      this.resolveDone(this.result)
      reply(res, 500, "store error")
    }
  }
}

function reply(res: ServerResponse, code: number, body = ""): void {
  res.writeHead(code)
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ""
    req.on("data", (chunk) => (data += chunk))
    req.on("end", () => resolve(data))
    req.on("error", reject)
  })
}
