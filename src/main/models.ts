import { execFile } from 'child_process'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import type { ModelInfo, ProviderId } from '../shared/types'
import { nvidiaModels, ollamaModels } from './hosted'
import { getKey } from './keys'
import { cachedProvider, resolveLaunch } from './providers'

const run = promisify(execFile)

/** Claude Code has no list command; these are the current model ids it accepts. */
const CLAUDE: ModelInfo[] = [
  { id: 'claude-fable-5-2', name: 'Fable 5.2', hint: 'Most capable' },
  { id: 'claude-opus-5-5', name: 'Opus 5.5', hint: 'Deep work' },
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', hint: 'Balanced' },
  { id: 'claude-haiku-5-5', name: 'Haiku 5.5', hint: 'Fastest' }
]

async function cli(id: ProviderId, args: string[]): Promise<string> {
  const path = cachedProvider(id)?.path
  if (!path) return ''
  const l = await resolveLaunch(path)
  if (l.shell) return ''
  const { stdout } = await run(l.file, [...l.prefix, ...args], { timeout: 45000, windowsHide: true, maxBuffer: 8e6, env: { ...process.env, NO_COLOR: '1' } })
  return stdout
}

const LOADERS: Partial<Record<ProviderId, () => Promise<ModelInfo[]>>> = {
  nvidia: async () => {
    const key = getKey('nvidia')
    return key ? nvidiaModels(key) : []
  },
  ollama: () => ollamaModels(),
  claude: async () => CLAUDE,

  // Codex caches the models this account may use; that is more accurate than any static list.
  codex: async () => {
    const d = JSON.parse(readFileSync(join(homedir(), '.codex', 'models_cache.json'), 'utf8'))
    const list: { slug: string; display_name?: string; description?: string; visibility?: string }[] = Array.isArray(d) ? d : (d.models ?? [])
    return list.filter((m) => m.visibility === 'list').map((m) => ({ id: m.slug, name: m.display_name ?? m.slug, hint: m.description }))
  },

  grok: async () =>
    [...(await cli('grok', ['models'])).matchAll(/^\s*[*-]\s+(\S+)(\s+\(default\))?\s*$/gm)].map((m) => ({
      id: m[1],
      name: m[1],
      hint: m[2] ? 'Default' : undefined
    })),

  gemini: async () => {
    const out = await cli('gemini', ['--list-models'])
    return [...out.matchAll(/^(\S+) \(([^)]+)\)\s*$/gm)].map((m) => ({ id: m[1], name: m[2] === m[1] ? m[1] : `${m[2]}` }))
  },

  opencode: async () =>
    (await cli('opencode', ['models']))
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[\w.@-]+\/\S+$/.test(l))
      .map((id) => ({ id, name: id.slice(id.indexOf('/') + 1), hint: id.slice(0, id.indexOf('/')) }))
}

const cache = new Map<ProviderId, ModelInfo[]>()

export async function listModels(id: ProviderId, refresh = false): Promise<ModelInfo[]> {
  if (!refresh && cache.has(id)) return cache.get(id)!
  try {
    const list = (await LOADERS[id]?.()) ?? []
    if (list.length) cache.set(id, list)
    return list
  } catch {
    return []
  }
}
