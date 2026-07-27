import { mkdtempSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const tmp = () => mkdtempSync(join(tmpdir(), "keyhole-"))

export const mode = (path: string) => statSync(path).mode & 0o777
