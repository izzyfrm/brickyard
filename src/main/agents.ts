import { spawn, execFile, type ChildProcess } from 'child_process'
import { app } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'
import type { RunRequest } from '../shared/types'
import { ADAPTERS, type Ctx, type Emit, type Json } from './adapters'
import { cachedProvider, detectProviders, resolveLaunch } from './providers'

/** Agents that can be handed Brickyard's MCP server per run, and so can call the others. */
const CAN_LEAD = new Set(['claude', 'codex'])

/** Path of the bundled stdio MCP server. Packaged builds keep it outside the asar so it can be executed. */
function peerScript(): string {
  return join(__dirname, 'agent-mcp.js').replace('app.asar', 'app.asar.unpacked')
}

async function buildCtx(req: RunRequest): Promise<Ctx> {
  const dataDir = join(app.getPath('userData'), 'runs')
  const ctx: Ctx = { dataDir }
  if (!req.delegate || !CAN_LEAD.has(req.providerId)) return ctx
  const peers = (await detectProviders())
    .filter((p) => p.installed && p.supported && p.path && p.id !== req.providerId)
    .map((p) => ({ id: p.id, name: p.name, path: p.path }))
  if (!peers.length) return ctx
  mkdirSync(dataDir, { recursive: true })
  const info = join(dataDir, `peers-${req.threadId}.json`)
  writeFileSync(info, JSON.stringify({ cwd: req.cwd ?? app.getPath('home'), access: req.access, dataDir, peers }))
  // Electron doubles as Node here, so users do not need Node installed.
  ctx.peerMcp = { command: process.execPath, args: [peerScript(), info], env: { ELECTRON_RUN_AS_NODE: '1' } }
  return ctx
}


const running = new Map<string, ChildProcess>()
const cancelled = new Set<string>()

function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {})
  else child.kill('SIGTERM')
}

export function cancelRun(threadId: string): void {
  const c = running.get(threadId)
  if (c) {
    cancelled.add(threadId)
    killTree(c)
  }
}

export function cancelAll(): void {
  for (const c of running.values()) killTree(c)
}

export async function runTurn(req: RunRequest, emit: Emit): Promise<void> {
  const adapter = ADAPTERS[req.providerId]
  const fail = (message: string): void => {
    emit({ kind: 'error', message })
    emit({ kind: 'done' })
  }
  if (!adapter) return fail('Brickyard does not have a chat adapter for this provider yet.')
  if (running.has(req.threadId)) return fail('This thread is already running.')

  let info = cachedProvider(req.providerId)
  if (!info) info = (await detectProviders()).find((p) => p.id === req.providerId)
  if (!info?.path) return fail(`${info?.name ?? req.providerId} is not installed. ${info?.authHint ?? ''}`)

  const launch = await resolveLaunch(info.path)
  if (launch.shell) return fail(`Could not launch ${info.name} safely from ${info.path}.`)

  const { args, stdin } = adapter.args(req, await buildCtx(req))
  const cwd = req.cwd ?? app.getPath('home')
  if (!existsSync(cwd)) return fail(`The project folder no longer exists: ${cwd}`)
  let child: ChildProcess
  try {
    child = spawn(launch.file, [...launch.prefix, ...args], {
      cwd,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', MCP_TOOL_TIMEOUT: '900000' },
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch (e) {
    return fail(`Failed to start ${info.name}: ${(e as Error).message}`)
  }
  running.set(req.threadId, child)

  const state: Json = {}
  let sawError = false
  let stderr = ''
  const forward: Emit = (e) => {
    if (e.kind === 'error') sawError = true
    emit(e)
  }

  child.stdin?.on('error', () => {})
  if (stdin !== undefined) child.stdin?.write(stdin)
  child.stdin?.end()

  const rl = createInterface({ input: child.stdout! })
  rl.on('line', (line) => {
    const t = line.trim()
    if (!t.startsWith('{')) return
    try {
      adapter.parse(JSON.parse(t), forward, state)
    } catch {
      /* a malformed line must never kill the stream */
    }
  })
  child.stderr?.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-4000)
  })

  await new Promise<void>((resolve) => {
    child.on('error', (e) => {
      forward({ kind: 'error', message: `Failed to start ${info!.name}: ${e.message}` })
      resolve()
    })
    child.on('close', (code, signal) => {
      rl.close()
      if (!state.done) {
        if (cancelled.has(req.threadId) || signal || code === null) {
          /* cancelled by the user */
        } else if (code !== 0 && !sawError) {
          const tail = stderr.trim().split(/\r?\n/).filter((l) => !/^\s+at |DeprecationWarning|True color/.test(l)).slice(-6).join('\n')
          forward({ kind: 'error', message: tail || `${info!.name} exited with code ${code}.` })
        }
        emit({ kind: 'done' })
      }
      resolve()
    })
  })
  running.delete(req.threadId)
  cancelled.delete(req.threadId)
}
