import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Access, AgentEvent, ProviderId, RunRequest } from '../shared/types'
import { ownStudioServers, studioServer } from './providers'

export type Emit = (e: AgentEvent) => void
export type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** An MCP server handed to the agent for this run. */
export interface McpServer {
  command: string
  args: string[]
  env: Record<string, string>
}

export interface Ctx {
  /** Where per-run config files are written. */
  dataDir: string
  /** Brickyard's own MCP server, which lets this agent call the user's other agents. */
  peerMcp?: McpServer
}

export interface Adapter {
  /** CLI args. `stdin`, when set, is written to the process and closed. */
  args(req: RunRequest, ctx: Ctx): { args: string[]; stdin?: string }
  /** Translate one JSON line from the CLI into Brickyard events. */
  parse(line: Json, emit: Emit, state: Json): void
}

const MODEL_RE = /^[\w.\-/:#[\]@]+$/
const model = (m: string | null): string | null => (m && MODEL_RE.test(m) ? m : null)

function str(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

/** Pull plain text out of the many "content" shapes tools return. */
function contentText(c: unknown): string {
  if (typeof c === 'string') return c
  if (Array.isArray(c))
    return c
      .map((x) => (typeof x === 'string' ? x : (x?.text ?? x?.content?.text ?? (x?.type === 'image' ? '[image]' : str(x)))))
      .join('\n')
  return str(c)
}

/* ------------------------------------------------------------------ Claude */

const CLAUDE_MODE: Record<Access, string> = { ask: 'plan', edit: 'acceptEdits', full: 'bypassPermissions' }

const claude: Adapter = {
  args(req, ctx) {
    const a = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages']
    a.push('--permission-mode', CLAUDE_MODE[req.access])
    if (req.sessionId) a.push('--resume', req.sessionId)
    const m = model(req.model)
    if (m) a.push('--model', m)
    const servers: Record<string, unknown> = {}
    const allow: string[] = []
    const own = ownStudioServers('claude', req.cwd)
    if (!req.studioMcp) {
      // Toggle is off: hide any Studio server the CLI has in its own config.
      if (own.length) a.push('--disallowedTools', ...own.map((n) => `mcp__${n}`))
    } else {
      const studio = own.length ? null : studioServer()
      if (studio) servers.Brickyard_Studio = { type: 'stdio', ...studio, env: {} }
      // Headless runs cannot answer permission prompts, so Studio tools are pre-approved in Edit mode.
      if (req.access === 'edit') allow.push(...own.map((n) => `mcp__${n}`), ...(studio ? ['mcp__Brickyard_Studio'] : []))
    }
    if (ctx.peerMcp) {
      servers.brickyard = { type: 'stdio', ...ctx.peerMcp }
      if (req.access !== 'full') allow.push('mcp__brickyard')
    }
    if (Object.keys(servers).length) {
      mkdirSync(ctx.dataDir, { recursive: true })
      const file = join(ctx.dataDir, `mcp-${req.threadId}.json`)
      writeFileSync(file, JSON.stringify({ mcpServers: servers }))
      a.push('--mcp-config', file)
    }
    if (allow.length) a.push('--allowedTools', ...allow)
    return { args: a, stdin: req.prompt }
  },
  parse(o, emit, st) {
    if (o.type === 'system' && o.subtype === 'init') {
      emit({ kind: 'session', sessionId: o.session_id, model: o.model })
    } else if (o.type === 'stream_event' && !o.parent_tool_use_id) {
      const d = o.event?.delta
      if (o.event?.type === 'content_block_delta') {
        if (d?.type === 'text_delta') emit({ kind: 'text', text: d.text })
        else if (d?.type === 'thinking_delta') emit({ kind: 'thinking', text: d.thinking })
      } else if (o.event?.type === 'message_start') {
        // Separate consecutive assistant messages inside one turn.
        if (st.sawText) emit({ kind: 'text', text: '\n\n' })
      } else if (o.event?.type === 'content_block_start' && o.event.content_block?.type === 'text') {
        st.sawText = true
      }
    } else if (o.type === 'assistant' && !o.parent_tool_use_id) {
      for (const b of o.message?.content ?? [])
        if (b.type === 'tool_use') emit({ kind: 'tool', id: b.id, name: b.name, input: b.input })
    } else if (o.type === 'user' && !o.parent_tool_use_id) {
      const c = o.message?.content
      if (Array.isArray(c))
        for (const b of c)
          if (b.type === 'tool_result')
            emit({ kind: 'tool_result', id: b.tool_use_id, output: contentText(b.content), isError: !!b.is_error })
    } else if (o.type === 'result') {
      if (o.is_error || (o.subtype && o.subtype !== 'success'))
        emit({ kind: 'error', message: o.result || o.error || `Claude stopped: ${o.subtype}` })
      emit({ kind: 'done', costUsd: o.total_cost_usd, durationMs: o.duration_ms })
      st.done = true
    }
  }
}

/* ------------------------------------------------------------------- Codex */

const codex: Adapter = {
  args(req, ctx) {
    const a = ['exec', '--json', '--skip-git-repo-check']
    if (req.access === 'full') a.push('--dangerously-bypass-approvals-and-sandbox')
    else a.push('-s', req.access === 'ask' ? 'read-only' : 'workspace-write')
    const m = model(req.model)
    if (m) a.push('-m', m)
    const own = ownStudioServers('codex', req.cwd)
    if (!req.studioMcp) for (const n of own) a.push('-c', `mcp_servers.${n}.enabled=false`)
    else if (!own.length) {
      const studio = studioServer()
      if (studio) {
        // TOML literal strings (single quotes) keep the Windows backslashes intact.
        a.push('-c', `mcp_servers.brickyard_studio.command='${studio.command}'`)
        a.push('-c', `mcp_servers.brickyard_studio.args=[${studio.args.map((x) => `'${x}'`).join(', ')}]`)
      }
    }
    // Same reason as the bridge below: in Edit mode Studio tools must run without a prompt.
    if (req.studioMcp && req.access === 'edit')
      for (const n of own.length ? own : ['brickyard_studio']) a.push('-c', `mcp_servers.${n}.default_tools_approval_mode='approve'`)
    if (ctx.peerMcp) {
      const lit = (x: string): string => `'${x}'`
      a.push('-c', `mcp_servers.brickyard.command=${lit(ctx.peerMcp.command)}`)
      a.push('-c', `mcp_servers.brickyard.args=[${ctx.peerMcp.args.map(lit).join(', ')}]`)
      a.push('-c', `mcp_servers.brickyard.env={${Object.entries(ctx.peerMcp.env).map(([k, v]) => `${k}=${lit(v)}`).join(', ')}}`)
      // Another agent can take minutes; Codex's default tool timeout is one.
      a.push('-c', 'mcp_servers.brickyard.tool_timeout_sec=900')
      // Headless Codex cannot ask for approval, so the bridge is pre-approved.
      a.push('-c', "mcp_servers.brickyard.default_tools_approval_mode='approve'")
    }
    if (req.sessionId) a.push('resume', req.sessionId)
    a.push(req.prompt)
    return { args: a }
  },
  parse(o, emit, st) {
    const it = o.item
    if (o.type === 'thread.started') emit({ kind: 'session', sessionId: o.thread_id })
    else if (o.type === 'item.started' || o.type === 'item.completed') {
      const end = o.type === 'item.completed'
      if (!it) return
      if (it.type === 'agent_message' && end) {
        emit({ kind: 'text', text: (st.sawText ? '\n\n' : '') + (it.text ?? '') })
        st.sawText = true
      } else if (it.type === 'reasoning' && end) emit({ kind: 'thinking', text: (it.text ?? '') + '\n' })
      else if (['command_execution', 'file_change', 'mcp_tool_call', 'web_search'].includes(it.type)) {
        if (!st.tools) st.tools = new Set<string>()
        if (!st.tools.has(it.id)) {
          st.tools.add(it.id)
          const name =
            it.type === 'command_execution' ? 'Shell'
            : it.type === 'file_change' ? 'Edit files'
            : it.type === 'web_search' ? 'Web search'
            : `${it.server}.${it.tool}`
          const input =
            it.type === 'command_execution' ? { command: it.command }
            : it.type === 'file_change' ? { changes: it.changes }
            : it.type === 'web_search' ? { query: it.query }
            : it.arguments
          emit({ kind: 'tool', id: it.id, name, input })
        }
        if (end) {
          const failed = it.status === 'failed' || (typeof it.exit_code === 'number' && it.exit_code !== 0) || !!it.error
          const out = it.aggregated_output ?? (it.error ? str(it.error.message ?? it.error) : contentText(it.result?.content ?? it.result ?? ''))
          emit({ kind: 'tool_result', id: it.id, output: out, isError: failed })
        }
      }
    } else if (o.type === 'error') st.lastError = o.message
    else if (o.type === 'turn.failed') {
      emit({ kind: 'error', message: o.error?.message ?? st.lastError ?? 'Codex turn failed' })
      emit({ kind: 'done' })
      st.done = true
    } else if (o.type === 'turn.completed') {
      emit({ kind: 'done' })
      st.done = true
    }
  }
}

/* ------------------------------------------------------------------ Gemini */

const gemini: Adapter = {
  args(req) {
    const a = ['-o', 'stream-json', '--skip-trust']
    a.push('--approval-mode', req.access === 'full' ? 'yolo' : req.access === 'ask' ? 'plan' : 'auto_edit')
    const m = model(req.model)
    if (m) a.push('-m', m)
    if (req.sessionId) a.push('--resume', req.sessionId)
    a.push('-p', req.prompt)
    return { args: a }
  },
  parse(o, emit, st) {
    if (o.type === 'init') emit({ kind: 'session', sessionId: o.session_id, model: o.model })
    else if (o.type === 'message' && o.role === 'assistant') emit({ kind: 'text', text: o.content ?? '' })
    else if (o.type === 'tool_use') emit({ kind: 'tool', id: o.tool_id, name: o.tool_name, input: o.parameters })
    else if (o.type === 'tool_result')
      emit({ kind: 'tool_result', id: o.tool_id, output: str(o.output ?? o.error?.message ?? ''), isError: o.status === 'error' })
    else if (o.type === 'error') emit({ kind: 'error', message: str(o.message ?? o.error) })
    else if (o.type === 'result') {
      if (o.status && o.status !== 'success') emit({ kind: 'error', message: str(o.error?.message ?? o.error ?? o.status) })
      emit({ kind: 'done', durationMs: o.stats?.duration_ms })
      st.done = true
    }
  }
}

/* ---------------------------------------------------------------- OpenCode */

const opencode: Adapter = {
  args(req) {
    const a = ['run', '--format', 'json']
    if (req.access === 'full') a.push('--auto')
    const m = model(req.model)
    if (m) a.push('-m', m)
    if (req.sessionId) a.push('--session', req.sessionId)
    a.push(req.prompt)
    return { args: a }
  },
  parse(o, emit, st) {
    if (o.sessionID && !st.session) {
      st.session = o.sessionID
      emit({ kind: 'session', sessionId: o.sessionID })
    }
    const p = o.part
    if (o.type === 'text' && p?.text) {
      emit({ kind: 'text', text: (st.sawText ? '\n\n' : '') + p.text })
      st.sawText = true
    } else if (o.type === 'reasoning' && p?.text) emit({ kind: 'thinking', text: p.text + '\n' })
    else if (o.type === 'tool_use' && p) {
      const id = p.callID ?? p.id
      emit({ kind: 'tool', id, name: p.tool, input: p.state?.input })
      if (p.state?.status === 'completed' || p.state?.status === 'error')
        emit({ kind: 'tool_result', id, output: str(p.state.output ?? p.state.error ?? ''), isError: p.state.status === 'error' })
    } else if (o.type === 'error') emit({ kind: 'error', message: o.error?.message ?? o.error?.data?.message ?? str(o.error) })
  }
}

/* -------------------------------------------------------------------- Grok */

const GROK_MODE: Record<Access, string> = { ask: 'plan', edit: 'acceptEdits', full: 'bypassPermissions' }

const grok: Adapter = {
  args(req) {
    const a = ['--output-format', 'streaming-json', '--permission-mode', GROK_MODE[req.access]]
    const m = model(req.model)
    if (m) a.push('-m', m)
    if (req.sessionId) a.push('--resume', req.sessionId)
    a.push('-p', req.prompt)
    return { args: a }
  },
  parse(o, emit, st) {
    if (o.type === 'text') emit({ kind: 'text', text: o.data ?? '' })
    else if (o.type === 'thought') emit({ kind: 'thinking', text: o.data ?? '' })
    else if (o.type === 'tool_call') emit({ kind: 'tool', id: o.toolCallId, name: o.toolName ?? o.title, input: o.rawInput })
    else if (o.type === 'tool_call_update' && (o.status === 'completed' || o.status === 'failed'))
      emit({ kind: 'tool_result', id: o.toolCallId, output: contentText(o.content), isError: o.status === 'failed' })
    else if (o.type === 'error') emit({ kind: 'error', message: str(o.message ?? o.data ?? o.error) })
    else if (o.type === 'end' && !st.done) {
      if (o.sessionId) emit({ kind: 'session', sessionId: o.sessionId })
      emit({ kind: 'done', costUsd: o.total_cost_usd })
      st.done = true
    }
  }
}

export const ADAPTERS: Partial<Record<ProviderId, Adapter>> = { claude, codex, gemini, opencode, grok }
