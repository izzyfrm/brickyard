/**
 * User-added providers: any OpenAI-compatible endpoint (OpenRouter, Groq, LM Studio, a company
 * gateway...). Like NVIDIA they run through OpenCode. Definitions live in custom-providers.json;
 * keys live encrypted in keys.json and are never written to the definitions file.
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { CustomProvider, CustomProviderInput, ModelInfo } from '../shared/types'
import { openAIModels } from './hosted'
import { getKey, setKey } from './keys'

interface Stored {
  id: `custom-${string}`
  name: string
  baseURL: string
  models: string[]
}

const file = (): string => join(app.getPath('userData'), 'custom-providers.json')
const keyName = (id: string): string => `custom:${id}`

function readAll(): Stored[] {
  try {
    const d = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : []
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

function writeAll(list: Stored[]): void {
  mkdirSync(dirname(file()), { recursive: true })
  writeFileSync(file() + '.tmp', JSON.stringify(list, null, 2))
  renameSync(file() + '.tmp', file())
}

export function listCustom(): CustomProvider[] {
  return readAll().map((p) => ({ ...p, hasKey: getKey(keyName(p.id)) !== null }))
}

export function getCustom(id: string): (Stored & { apiKey: string | null }) | null {
  const p = readAll().find((x) => x.id === id)
  return p ? { ...p, apiKey: getKey(keyName(p.id)) } : null
}

/** Normalises a base URL: trims, drops a trailing slash and a pasted /chat/completions. */
function cleanURL(raw: string): string | null {
  const s = raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/, '')
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:' ? s : null
  } catch {
    return null
  }
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'provider'
  )
}

export async function testCustom(
  baseURL: string,
  apiKey: string | null
): Promise<{ ok: boolean; message: string; count: number }> {
  const url = cleanURL(baseURL)
  if (!url)
    return { ok: false, message: 'Enter a full URL, like https://openrouter.ai/api/v1', count: 0 }
  try {
    const models = await openAIModels(url, apiKey)
    return {
      ok: true,
      message: models.length
        ? `Connected. ${models.length} model${models.length === 1 ? '' : 's'} found.`
        : 'Connected, but it listed no models. Add model ids by hand.',
      count: models.length
    }
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 401 || status === 403)
      return { ok: false, message: 'The endpoint rejected the API key.', count: 0 }
    return {
      ok: false,
      message: `Could not list models: ${(e as Error).message}. You can still add model ids by hand.`,
      count: 0
    }
  }
}

export async function saveCustom(
  input: CustomProviderInput
): Promise<{ ok: boolean; message: string; provider?: CustomProvider }> {
  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Give the provider a name.' }
  const baseURL = cleanURL(input.baseURL)
  if (!baseURL) return { ok: false, message: 'Enter a full URL, like https://openrouter.ai/api/v1' }
  const models = [
    ...new Set(input.models.map((m) => m.trim()).filter((m) => /^[\w.\-/:#[\]@]+$/.test(m)))
  ]
  const list = readAll()
  let id = input.id ?? (`custom-${slug(name)}` as const)
  if (!input.id)
    for (let n = 2; list.some((p) => p.id === id); n++) id = `custom-${slug(name)}-${n}`
  const existingKey = getKey(keyName(id))
  const apiKey = input.apiKey === undefined ? existingKey : input.apiKey
  // Without any model the provider is unusable, so require the endpoint to list some or the user to type them.
  if (!models.length) {
    const t = await testCustom(baseURL, apiKey)
    if (!t.ok) return { ok: false, message: t.message }
    if (!t.count)
      return { ok: false, message: 'The endpoint listed no models. Type at least one model id.' }
  }
  const stored: Stored = { id, name, baseURL, models }
  writeAll([...list.filter((p) => p.id !== id), stored])
  if (input.apiKey !== undefined) setKey(keyName(id), input.apiKey || null)
  return { ok: true, message: `${name} added.`, provider: { ...stored, hasKey: !!apiKey } }
}

export function removeCustom(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id))
  setKey(keyName(id), null)
}

/** Models for a custom provider: what the endpoint lists, plus anything typed by hand. */
export async function customModels(id: string): Promise<ModelInfo[]> {
  const p = getCustom(id)
  if (!p) return []
  const manual: ModelInfo[] = p.models.map((m) => ({ id: m, name: m, hint: 'added by you' }))
  try {
    const listed = await openAIModels(p.baseURL, p.apiKey)
    return [...manual, ...listed.filter((m) => !p.models.includes(m.id))]
  } catch {
    return manual
  }
}
