import { execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { promisify } from 'util'
import type { ProviderId, ProviderStatus, StudioStatus } from '../shared/types'
import { ollamaRunning } from './hosted'

const run = promisify(execFile)

interface ProviderDef {
  id: ProviderId
  name: string
  command: string
  authHint: string
  supported: boolean
  studioMcp: boolean
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'claude', name: 'Claude', command: 'claude', authHint: 'Run `claude` once and sign in.', supported: true, studioMcp: true },
  { id: 'codex', name: 'Codex', command: 'codex', authHint: 'Run `codex login`.', supported: true, studioMcp: true },
  { id: 'gemini', name: 'Gemini', command: 'gemini', authHint: 'Run `gemini` and sign in.', supported: true, studioMcp: false },
  { id: 'opencode', name: 'OpenCode', command: 'opencode', authHint: 'Run `opencode auth login`.', supported: true, studioMcp: false },
  { id: 'grok', name: 'Grok', command: 'grok', authHint: 'Run `grok login`.', supported: true, studioMcp: false },
  { id: 'nvidia', name: 'NVIDIA', command: 'opencode', authHint: 'Add your NVIDIA API key in Settings → Agents. Needs OpenCode installed.', supported: true, studioMcp: false },
  { id: 'ollama', name: 'Ollama', command: 'opencode', authHint: 'Install Ollama and keep it running. Needs OpenCode installed.', supported: true, studioMcp: false },
  { id: 'cursor', name: 'Cursor', command: 'cursor-agent', authHint: 'Run `cursor-agent login`.', supported: false, studioMcp: false },
  { id: 'muse', name: 'Muse Code', command: 'muse', authHint: 'Install the Muse Code CLI and sign in.', supported: false, studioMcp: false },
  { id: 'pi', name: 'Pi', command: 'pi', authHint: 'Install the Pi coding agent CLI.', supported: false, studioMcp: false }
]

async function which(cmd: string): Promise<string | null> {
  try {
    const finder = process.platform === 'win32' ? 'where' : 'which'
    const { stdout } = await run(finder, [cmd], { timeout: 4000, windowsHide: true })
    const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    // npm on Windows installs an extensionless sh shim first; prefer the runnable one.
    return lines.find((l) => /\.(exe|cmd|bat)$/i.test(l)) ?? lines[0] ?? null
  } catch {
    return null
  }
}

export interface Launch {
  file: string
  prefix: string[]
  /** True when we could not avoid cmd.exe; args must then be shell-safe. */
  shell: boolean
}

let nodePath: string | null | undefined

/**
 * Turn a CLI path into something we can spawn WITHOUT a shell, so prompts and
 * config values never pass through cmd.exe quoting. npm `.cmd` shims are parsed
 * for the real target (a .js entry run by node, or a bundled .exe).
 */
export async function resolveLaunch(path: string): Promise<Launch> {
  if (!/\.(cmd|bat)$/i.test(path)) return { file: path, prefix: [], shell: false }
  try {
    const shim = readFileSync(path, 'utf8')
    const m = [...shim.matchAll(/"%dp0%\\([^"]+\.(?:js|mjs|cjs|exe))"/gi)].pop()
    if (m) {
      const target = join(dirname(path), m[1])
      if (existsSync(target)) {
        if (/\.exe$/i.test(target)) return { file: target, prefix: [], shell: false }
        if (nodePath === undefined) nodePath = await which('node')
        if (nodePath) return { file: nodePath, prefix: [target], shell: false }
      }
    }
  } catch {
    /* fall through */
  }
  return { file: path, prefix: [], shell: true }
}

const cache = new Map<ProviderId, ProviderStatus>()

export function cachedProvider(id: ProviderId): ProviderStatus | undefined {
  return cache.get(id)
}

/** Lets the main process tell detection whether a key is stored, without providers.ts importing Electron. */
let keyCheck: (id: ProviderId) => boolean = () => false
export function setKeyCheck(fn: (id: ProviderId) => boolean): void {
  keyCheck = fn
}

const HOSTED_IDS = new Set<ProviderId>(['nvidia', 'ollama'])

/** User-added providers, supplied by the main process so this file stays free of Electron. */
let customSource: () => { id: `custom-${string}`; name: string; baseURL: string; hasKey: boolean }[] = () => []
export function setCustomSource(fn: typeof customSource): void {
  customSource = fn
}

async function cliVersion(path: string): Promise<string | null> {
  try {
    const l = await resolveLaunch(path)
    const { stdout } = await run(l.file, [...l.prefix, '--version'], { timeout: 8000, shell: l.shell, windowsHide: true })
    return /\d+\.\d+[\w.-]*/.exec(stdout)?.[0] ?? null
  } catch {
    return null
  }
}

export async function detectProviders(): Promise<ProviderStatus[]> {
  const ollamaUp = ollamaRunning()
  const ollamaPath = which('ollama')
  const list = await Promise.all(
    PROVIDERS.map(async (p): Promise<ProviderStatus> => {
      const path = await which(p.command)
      const hosted = HOSTED_IDS.has(p.id)
      const base = { ...p, kind: hosted ? ('hosted' as const) : ('cli' as const), needsKey: p.id === 'nvidia', hasKey: p.id === 'nvidia' && keyCheck('nvidia'), custom: false }
      if (!hosted) return { ...base, installed: !!path, path, version: path ? await cliVersion(path) : null, studioMcpOwn: ownStudioServers(p.id, null).length > 0 }
      // Hosted: OpenCode is the engine, plus the host itself must be usable.
      const ready = !!path && (p.id === 'nvidia' ? base.hasKey : await ollamaUp)
      const op = await ollamaPath
      const version = p.id === 'ollama' && op ? await cliVersion(op) : null
      return { ...base, installed: ready, path, version, studioMcpOwn: false }
    })
  )
  // Custom providers need only OpenCode, the engine.
  const opencodePath = list.find((p) => p.id === 'opencode')?.path ?? null
  for (const c of customSource())
    list.push({
      id: c.id,
      name: c.name,
      command: 'opencode',
      authHint: 'Needs OpenCode installed. Edit it in Settings → Agents.',
      supported: true,
      studioMcp: false,
      studioMcpOwn: false,
      kind: 'hosted',
      needsKey: false,
      hasKey: c.hasKey,
      custom: true,
      installed: !!opencodePath,
      path: opencodePath,
      version: new URL(c.baseURL).host
    })
  for (const p of list) cache.set(p.id, p)
  return list
}

export function studioMcpPath(): string | null {
  const local = process.env.LOCALAPPDATA
  const p = local ? join(local, 'Roblox', 'mcp.bat') : null
  return p && existsSync(p) ? p : null
}

export async function studioStatus(): Promise<StudioStatus> {
  const mcpPath = studioMcpPath()
  let studioRunning = false
  try {
    if (process.platform === 'win32') {
      const { stdout } = await run('tasklist', ['/FI', 'IMAGENAME eq RobloxStudioBeta.exe', '/NH'], { timeout: 5000, windowsHide: true })
      studioRunning = stdout.includes('RobloxStudioBeta.exe')
    }
  } catch {
    /* ignore */
  }
  return { mcpInstalled: !!mcpPath, mcpPath, studioRunning }
}

/**
 * How to start the Studio MCP server. mcp.bat only forwards to StudioMCP.exe, so we
 * launch the exe directly: no cmd.exe means no quoting bugs (the wrapped form failed to connect).
 */
export function studioServer(): { command: string; args: string[] } | null {
  const bat = studioMcpPath()
  if (!bat) return null
  try {
    for (const m of readFileSync(bat, 'utf8').matchAll(/"([^"%]+StudioMCP\.exe)"/gi)) if (existsSync(m[1])) return { command: m[1], args: [] }
  } catch {
    /* fall through */
  }
  const dir = dirname(bat)
  return /\s/.test(dir) ? null : { command: 'cmd.exe', args: ['/c', `cd /d ${dir} && .\\mcp.bat`] }
}

/**
 * Names of Roblox Studio MCP servers the CLI already has in its own config.
 * If one exists we must not attach a second: two servers on one Studio means duplicate tools.
 */
export function ownStudioServers(id: ProviderId, cwd: string | null): string[] {
  const isStudio = (n: string): boolean => /roblox/i.test(n)
  try {
    if (id === 'claude') {
      const d = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
      const names = Object.keys(d.mcpServers ?? {})
      if (cwd) {
        const norm = (p: string): string => p.split('\\').join('/').toLowerCase()
        for (const [k, v] of Object.entries<{ mcpServers?: object }>(d.projects ?? {}))
          if (norm(k) === norm(cwd)) names.push(...Object.keys(v.mcpServers ?? {}))
      }
      return [...new Set(names.filter(isStudio))]
    }
    if (id === 'codex') {
      const toml = readFileSync(join(homedir(), '.codex', 'config.toml'), 'utf8')
      return [...toml.matchAll(/^\[mcp_servers\.([^\].]+)\]/gm)].map((m) => m[1].replace(/^"|"$/g, '')).filter(isStudio)
    }
  } catch {
    /* no config file: nothing configured */
  }
  return []
}
