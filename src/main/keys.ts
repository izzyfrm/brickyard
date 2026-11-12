/**
 * API keys Brickyard holds itself (only NVIDIA for now).
 * Encrypted with the OS keychain via Electron safeStorage (DPAPI on Windows).
 * The renderer can set, test or clear a key, but can never read one back.
 */
import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

type KeyName = 'nvidia'
const file = (): string => join(app.getPath('userData'), 'keys.json')

function readAll(): Partial<Record<KeyName, string>> {
  try {
    return existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : {}
  } catch {
    return {}
  }
}

function writeAll(data: Partial<Record<KeyName, string>>): void {
  mkdirSync(dirname(file()), { recursive: true })
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(data))
  renameSync(tmp, file())
}

export function setKey(name: KeyName, key: string | null): void {
  const all = readAll()
  if (!key) delete all[name]
  else {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('This PC cannot encrypt secrets, so the key was not saved.')
    all[name] = safeStorage.encryptString(key.trim()).toString('base64')
  }
  writeAll(all)
}

export function getKey(name: KeyName): string | null {
  const enc = readAll()[name]
  if (!enc) return null
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return null
  }
}

export const hasKey = (name: KeyName): boolean => getKey(name) !== null
