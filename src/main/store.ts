import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { StoreData } from '../shared/types'

const file = (): string => join(app.getPath('userData'), 'brickyard-store.json')

export function loadStore(): StoreData {
  try {
    if (existsSync(file())) {
      const d = JSON.parse(readFileSync(file(), 'utf8'))
      if (Array.isArray(d.projects) && Array.isArray(d.threads)) return d
    }
  } catch {
    /* corrupt store: start clean rather than crash; the old file is left in place */
  }
  return { projects: [], threads: [] }
}

/** Atomic write: a crash mid-save can never leave a half-written store. */
export function saveStore(data: StoreData): void {
  const f = file()
  mkdirSync(dirname(f), { recursive: true })
  const tmp = f + '.tmp'
  writeFileSync(tmp, JSON.stringify(data))
  renameSync(tmp, f)
}
