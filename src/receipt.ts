import { randomBytes } from "node:crypto"

import type { Stored } from "./server.ts"
import { writeAtomic0600 } from "./stores.ts"
import pkg from "../package.json" with { type: "json" }

export const RECEIPT_SCHEMA = "keyhole.secret_reference_receipt.v1"

export interface Receipt {
  schema: typeof RECEIPT_SCHEMA
  keyhole: string
  request_id: string
  created_at: string
  context: string
  secrets: { name: string; dest: string; retrieve: string }[]
}

// The fields are picked one by one rather than spreading `Stored`, so nothing added to
// that type later can reach the receipt without someone deciding it belongs there.
export function buildReceipt(secrets: Stored[], context: string): Receipt {
  return {
    schema: RECEIPT_SCHEMA,
    keyhole: pkg.version,
    request_id: randomBytes(8).toString("hex"),
    created_at: new Date().toISOString(),
    context,
    secrets: secrets.map(({ name, dest, retrieve }) => ({ name, dest, retrieve })),
  }
}

// 0600 and atomic: the receipt holds no secret value, but it names what was granted
// where, and a half-written receipt is worse for an audit trail than no receipt.
export function writeReceipt(path: string, receipt: Receipt): void {
  writeAtomic0600(path, JSON.stringify(receipt, null, 2) + "\n")
}
