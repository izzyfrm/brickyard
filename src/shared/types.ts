// Types shared by main, preload and renderer.

export type ProviderId = 'claude' | 'codex' | 'opencode' | 'gemini' | 'grok' | 'nvidia' | 'ollama' | 'cursor' | 'muse' | 'pi'

export interface ProviderStatus {
  id: ProviderId
  name: string
  command: string
  authHint: string
  /** True when Brickyard has a working chat adapter for this CLI. */
  supported: boolean
  /** True when Brickyard can hand this CLI the Roblox Studio MCP server per run. */
  studioMcp: boolean
  /** True when the CLI's own config already has a Roblox Studio MCP server. */
  studioMcpOwn: boolean
  /** 'cli' runs its own agent; 'hosted' is a model host driven through OpenCode. */
  kind: 'cli' | 'hosted'
  /** Hosted providers that need a key Brickyard stores (NVIDIA). */
  needsKey: boolean
  hasKey: boolean
  installed: boolean
  path: string | null
  version: string | null
}

export interface ModelInfo {
  /** Exactly what gets passed to the CLI's model flag. */
  id: string
  name: string
  hint?: string
  /** No charge to the user. Free models usually log prompts and may train on them. */
  free?: boolean
}

export interface UpdateInfo {
  version: string
  name: string
  url: string
  publishedAt: string
}

export interface StudioStatus {
  mcpInstalled: boolean
  mcpPath: string | null
  studioRunning: boolean
}

/** ask = read-only planning, edit = may edit files, full = no permission checks. */
export type Access = 'ask' | 'edit' | 'full'

export type AgentEvent =
  | { kind: 'session'; sessionId: string; model?: string }
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; id: string; name: string; input: unknown }
  | { kind: 'tool_result'; id: string; output: string; isError: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'done'; costUsd?: number; durationMs?: number }

export interface RunRequest {
  threadId: string
  providerId: ProviderId
  prompt: string
  cwd: string | null
  sessionId: string | null
  model: string | null
  access: Access
  studioMcp: boolean
  /** Let this agent call the user's other agents through Brickyard. */
  delegate: boolean
}

export type Part =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; id: string; name: string; input: unknown; output?: string; isError?: boolean; done: boolean }

export interface Message {
  id: string
  role: 'user' | 'assistant'
  parts: Part[]
  providerId?: ProviderId
  error?: string
  costUsd?: number
  durationMs?: number
  at: number
}

export interface Thread {
  id: string
  projectId: string | null
  title: string
  providerId: ProviderId
  model: string | null
  access: Access
  /** The CLI's own session id, used to resume the conversation. */
  sessionId: string | null
  messages: Message[]
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  path: string
}

export interface StoreData {
  projects: Project[]
  threads: Thread[]
}

export interface DirEntry {
  name: string
  path: string
  dir: boolean
}

export interface GitChange {
  path: string
  status: string
}

export interface Api {
  listProviders(): Promise<ProviderStatus[]>
  studioStatus(): Promise<StudioStatus>
  appInfo(): Promise<{ version: string; dataDir: string }>
  checkUpdate(): Promise<{ current: string; update: UpdateInfo | null; error?: string }>
  openRelease(url: string): Promise<void>
  setKey(name: 'nvidia', key: string | null): Promise<{ ok: boolean; message: string }>
  testKey(name: 'nvidia', key: string): Promise<{ ok: boolean; message: string }>
  listModels(id: ProviderId, refresh?: boolean): Promise<ModelInfo[]>
  loadStore(): Promise<StoreData>
  saveStore(data: StoreData): Promise<void>
  pickFolder(): Promise<{ name: string; path: string } | null>
  run(req: RunRequest): Promise<void>
  cancel(threadId: string): Promise<void>
  onAgentEvent(cb: (threadId: string, e: AgentEvent) => void): () => void
  listDir(root: string, dir: string): Promise<DirEntry[]>
  readFile(root: string, file: string): Promise<{ text: string; truncated: boolean } | { error: string }>
  gitChanges(root: string): Promise<{ repo: boolean; changes: GitChange[] }>
  gitDiff(root: string, file: string): Promise<string>
}
