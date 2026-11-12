/**
 * Model hosts that are not agent CLIs: NVIDIA's API and a local Ollama server.
 *
 * Neither can edit files or call tools on its own, so Brickyard drives them through
 * OpenCode (already a supported agent) as the engine. Each run gets a private OpenCode
 * config that defines the host as an OpenAI-compatible provider. Keys are passed by
 * environment variable and never written to disk.
 *
 * Electron-free on purpose: the agent bridge (agent-mcp) imports it too.
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ModelInfo, ProviderId } from '../shared/types'

export const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1'
export const OLLAMA_BASE = 'http://127.0.0.1:11434'

/** Providers that run through OpenCode against an HTTP model host. */
export const HOSTED: Partial<Record<ProviderId, { key: string; name: string; baseURL: string; keyEnv?: string }>> = {
  nvidia: { key: 'brickyard-nvidia', name: 'NVIDIA', baseURL: NVIDIA_BASE, keyEnv: 'BRICKYARD_NVIDIA_API_KEY' },
  ollama: { key: 'brickyard-ollama', name: 'Ollama', baseURL: `${OLLAMA_BASE}/v1` }
}

export const isHosted = (id: ProviderId): boolean => id in HOSTED

async function getJson(url: string, headers: Record<string, string> = {}, ms = 4000): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
  return res.json()
}

export async function ollamaRunning(): Promise<boolean> {
  try {
    await getJson(`${OLLAMA_BASE}/api/version`, {}, 1500)
    return true
  } catch {
    return false
  }
}

interface OllamaTag {
  name: string
  details?: { parameter_size?: string }
  capabilities?: string[]
}

/** Local models, tool-capable first: an agent without tool calling cannot edit anything. */
export async function ollamaModels(): Promise<ModelInfo[]> {
  const d = (await getJson(`${OLLAMA_BASE}/api/tags`)) as { models?: OllamaTag[] }
  const list = (d.models ?? []).map((m) => {
    const tools = !m.capabilities || m.capabilities.includes('tools')
    const cloud = /cloud/i.test(m.name)
    const hint = [m.details?.parameter_size, cloud ? 'Ollama cloud' : 'on this PC', tools ? null : 'no tool calling'].filter(Boolean).join(' · ')
    return { id: m.name, name: m.name.replace(/:latest$/, ''), hint, tools }
  })
  list.sort((a, b) => Number(b.tools) - Number(a.tools))
  return list.map(({ id, name, hint }) => ({ id, name, hint }))
}

/** Chat models on the NVIDIA API. Embedding, rerank, parsing and safety models are not agents. */
const NOT_CHAT = /embed|rerank|parse|guard|safety|reward|clip|asr|tts|riva|translate|vision-only|kosmos|deplot|paligemma|nv-grounding|retriev|calibration|kumo|body-pose|proteina|flux|stable-diffusion|cosmos|audio2face|bevformer/i

export async function nvidiaModels(key: string): Promise<ModelInfo[]> {
  const d = (await getJson(`${NVIDIA_BASE}/models`, { Authorization: `Bearer ${key}`, Accept: 'application/json' }, 8000)) as { data?: { id: string; owned_by?: string }[] }
  return (d.data ?? [])
    .filter((m) => !NOT_CHAT.test(m.id))
    .map((m) => ({ id: m.id, name: m.id.slice(m.id.indexOf('/') + 1), hint: m.owned_by ?? m.id.split('/')[0] }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Verifies a key with a one-token request to a small model. The model list is public and
 * NVIDIA checks the model name before the key, so nothing cheaper proves a key is real.
 */
export async function checkNvidiaKey(key: string): Promise<{ ok: boolean; message: string }> {
  if (!/^nvapi-[\w-]{20,}$/.test(key)) return { ok: false, message: 'That does not look like an NVIDIA key. They start with "nvapi-".' }
  let models: ModelInfo[]
  try {
    models = await nvidiaModels(key)
  } catch (e) {
    return { ok: false, message: `Could not reach NVIDIA: ${(e as Error).message}` }
  }
  const probe = ['nvidia/nemotron-3.5-bolt-e4b', 'nvidia/nemotron-3.5-lightning-30b-a3b'].find((id) => models.some((m) => m.id === id)) ?? models[0]?.id
  if (!probe) return { ok: false, message: 'NVIDIA returned no chat models to check the key against.' }
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ model: probe, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(30000)
    })
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'NVIDIA rejected this key.' }
    // Rate limited still means the key authenticated.
    if (res.ok || res.status === 429) return { ok: true, message: `Key works. ${models.length} chat models available.` }
    return { ok: false, message: `NVIDIA answered with an error (${res.status}). Try again in a minute.` }
  } catch (e) {
    return { ok: false, message: `Could not reach NVIDIA: ${(e as Error).message}` }
  }
}

/** Preferred defaults when the user has not picked a model. Falls back to the first listed. */
const PREFERRED: Partial<Record<ProviderId, string[]>> = {
  nvidia: ['minimaxai/minimax-m3.1-flash', 'mistralai/mistral-large-4-1t-a52b', 'deepseek-ai/deepseek-v4.1-flash'],
  ollama: []
}

export function pickDefault(id: ProviderId, models: ModelInfo[]): string | null {
  for (const want of PREFERRED[id] ?? []) if (models.some((m) => m.id === want)) return want
  // Ollama lists tool-capable models first.
  return models[0]?.id ?? null
}

/** Writes the per-run OpenCode config and returns the env that points OpenCode at it. */
export function hostedRun(id: ProviderId, model: string, runId: string, dataDir: string, secret?: string): { modelArg: string; env: Record<string, string> } {
  const h = HOSTED[id]!
  const options: Record<string, string> = { baseURL: h.baseURL }
  // OpenCode substitutes {env:NAME}, so the key itself never touches the file.
  options.apiKey = h.keyEnv ? `{env:${h.keyEnv}}` : 'ollama'
  const config = {
    $schema: 'https://opencode.ai/config.json',
    provider: { [h.key]: { npm: '@ai-sdk/openai-compatible', name: `${h.name} (Brickyard)`, options, models: { [model]: { name: model } } } }
  }
  mkdirSync(dataDir, { recursive: true })
  const file = join(dataDir, `opencode-${id}-${runId}.json`)
  writeFileSync(file, JSON.stringify(config))
  const env: Record<string, string> = { OPENCODE_CONFIG: file }
  if (h.keyEnv && secret) env[h.keyEnv] = secret
  return { modelArg: `${h.key}/${model}`, env }
}
