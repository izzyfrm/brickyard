import { execFile } from 'child_process'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import type { ModelInfo, ProviderId } from '../shared/types'
import { nvidiaModels, ollamaModels } from './hosted'
import { getKey } from './keys'
import { customModels } from './custom'
import { isCustomId } from '../shared/types'
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

  opencode: async () => {
    const [out, zen] = await Promise.all([cli('opencode', ['models']), zenCatalog()])
    const list = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[\w.@-]+\/\S+$/.test(l))
      .map((id): ModelInfo => {
        const provider = id.slice(0, id.indexOf('/'))
        const short = id.slice(id.indexOf('/') + 1)
        const info = provider === 'opencode' ? zen.get(short) : undefined
        // Free = OpenCode Zen prices it at zero. Without the catalog, fall back to the "-free" naming.
        const free = provider === 'opencode' && (info ? info.free : /-free$/.test(short))
        return { id, name: info?.name ?? short, hint: free ? 'Free · may train on prompts' : provider, free }
      })
    // Free models first, so someone without a paid account sees something that works.
    return list.sort((a, b) => Number(!!b.free) - Number(!!a.free))
  }
}

/** OpenCode Zen's catalog (names and prices) from models.dev, which OpenCode itself uses. */
let zenCache: { at: number; map: Map<string, { name: string; free: boolean }> } | null = null
async function zenCatalog(): Promise<Map<string, { name: string; free: boolean }>> {
  if (zenCache && Date.now() - zenCache.at < 6 * 60 * 60 * 1000) return zenCache.map
  try {
    const res = await fetch('https://models.dev/api.json', { signal: AbortSignal.timeout(6000) })
    const d = (await res.json()) as { opencode?: { models?: Record<string, { name?: string; cost?: { input?: number; output?: number } }> } }
    const map = new Map<string, { name: string; free: boolean }>()
    for (const [id, m] of Object.entries(d.opencode?.models ?? {}))
      map.set(id, { name: m.name ?? id, free: m.cost?.input === 0 && m.cost?.output === 0 })
    zenCache = { at: Date.now(), map }
    return map
  } catch {
    return zenCache?.map ?? new Map()
  }
}

/** The free model to use when someone runs OpenCode without picking one. */
export async function freeOpenCodeModel(): Promise<string | null> {
  const models = await listModels('opencode')
  const free = models.filter((m) => m.free)
  // Prefer models built for agentic coding when they are on the free list.
  for (const want of ['opencode/minimax-m3.1-flash-free', 'opencode/deepseek-v4.1-flash-free', 'opencode/glm-5.3-flash-free'])
    if (free.some((m) => m.id === want)) return want
  return free[0]?.id ?? null
}

const cache = new Map<ProviderId, ModelInfo[]>()

export async function listModels(id: ProviderId, refresh = false): Promise<ModelInfo[]> {
  if (!refresh && cache.has(id)) return cache.get(id)!
  try {
    const list = (isCustomId(id) ? await customModels(id) : await LOADERS[id]?.()) ?? []
    if (list.length) cache.set(id, list)
    return list
  } catch {
    return []
  }
}
