/**
 * Brickyard's agent bridge: a tiny stdio MCP server.
 *
 * The lead agent (Claude or Codex) is handed this server for a run. Its one tool,
 * `ask_agent`, starts another of the user's installed agent CLIs headlessly, waits for it
 * to finish and returns its answer. It is launched by the agent, not by Brickyard, so it
 * must stay free of Electron APIs (it runs with ELECTRON_RUN_AS_NODE).
 *
 * Usage: agent-mcp.js <info.json>   where info = { cwd, access, dataDir, peers: [{id,name,path}] }
 */
import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { createInterface } from 'readline'
import type { Access, AgentEvent, ProviderId } from '../shared/types'
import { ADAPTERS, type Json } from './adapters'
import { resolveLaunch } from './providers'

interface Peer {
  id: ProviderId
  name: string
  path: string
}
interface Info {
  cwd: string
  access: Access
  dataDir: string
  peers: Peer[]
}

const info: Info = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const send = (msg: Json): void => void process.stdout.write(JSON.stringify(msg) + '\n')

const TOOLS = [
  {
    name: 'ask_agent',
    description:
      'Hand a task or question to another AI coding agent installed on this machine and get its final answer back. ' +
      'Use it for a second opinion, a review of your work, or to split off a self-contained piece of work. ' +
      'The other agent starts with no memory of this conversation, so the prompt must contain everything it needs. ' +
      `It works in the same project folder with "${info.access}" access and cannot use Roblox Studio tools. ` +
      `Available agents: ${info.peers.map((p) => `${p.id} (${p.name})`).join(', ')}.`,
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', enum: info.peers.map((p) => p.id), description: 'Which agent to ask.' },
        prompt: { type: 'string', description: 'The complete, self-contained task or question.' },
        model: { type: 'string', description: 'Optional model id for that agent. Omit to use its default.' }
      },
      required: ['agent', 'prompt']
    }
  }
]

async function askAgent(args: Json): Promise<{ text: string; isError: boolean }> {
  const peer = info.peers.find((p) => p.id === args.agent)
  const adapter = peer && ADAPTERS[peer.id]
  if (!peer || !adapter) return { text: `Unknown agent "${args.agent}". Available: ${info.peers.map((p) => p.id).join(', ')}.`, isError: true }
  if (typeof args.prompt !== 'string' || !args.prompt.trim()) return { text: 'The prompt is empty.', isError: true }

  const launch = await resolveLaunch(peer.path)
  if (launch.shell) return { text: `Could not launch ${peer.name} safely.`, isError: true }
  const built = adapter.args(
    {
      threadId: 'peer',
      providerId: peer.id,
      prompt: args.prompt,
      cwd: info.cwd,
      sessionId: null,
      model: typeof args.model === 'string' ? args.model : null,
      access: info.access,
      // One agent drives Studio at a time, and a called agent may not call further agents.
      studioMcp: false,
      delegate: false
    },
    { dataDir: info.dataDir }
  )

  return new Promise((resolve) => {
    let text = ''
    const errors: string[] = []
    let stderr = ''
    const state: Json = {}
    const child = spawn(launch.file, [...launch.prefix, ...built.args], {
      cwd: info.cwd,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', ELECTRON_RUN_AS_NODE: undefined },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    child.stdin?.on('error', () => {})
    if (built.stdin !== undefined) child.stdin?.write(built.stdin)
    child.stdin?.end()
    const emit = (e: AgentEvent): void => {
      if (e.kind === 'text') text += e.text
      else if (e.kind === 'error') errors.push(e.message)
    }
    createInterface({ input: child.stdout! }).on('line', (line) => {
      const t = line.trim()
      if (!t.startsWith('{')) return
      try {
        adapter.parse(JSON.parse(t), emit, state)
      } catch {
        /* skip malformed lines */
      }
    })
    child.stderr?.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-2000)))
    child.on('error', (e) => resolve({ text: `Failed to start ${peer.name}: ${e.message}`, isError: true }))
    child.on('close', (code) => {
      const answer = text.trim()
      if (answer) return resolve({ text: answer + (errors.length ? `\n\n[${peer.name} also reported: ${errors.join('; ')}]` : ''), isError: false })
      resolve({ text: `${peer.name} returned no answer. ${errors.join('; ') || stderr.trim().split(/\r?\n/).slice(-3).join(' ') || `Exit code ${code}.`}`, isError: true })
    })
  })
}

createInterface({ input: process.stdin }).on('line', (line) => {
  let msg: Json
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  const { id, method, params } = msg
  if (id === undefined) return // notifications need no reply
  if (method === 'initialize')
    send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'brickyard', version: '0.1.0' } } })
  else if (method === 'ping') send({ jsonrpc: '2.0', id, result: {} })
  else if (method === 'tools/list') send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
  else if (method === 'tools/call' && params?.name === 'ask_agent')
    void askAgent(params.arguments ?? {}).then((r) => send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.text }], isError: r.isError } }))
  else send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
})
