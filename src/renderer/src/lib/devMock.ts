// Dev-only: lets the renderer run in a plain browser tab (no Electron) for UI work.
// It fakes providers and streams a canned reply so every chat state can be seen.
import type { AgentEvent, Api, ProviderId, ProviderStatus, StoreData } from '../../../shared/types'

const def = (id: ProviderId, name: string, installed: boolean, version: string | null, supported = true, studioMcp = false): ProviderStatus => ({
  id, name, command: id, authHint: `Run \`${id} login\`.`, supported, studioMcp, studioMcpOwn: false, kind: 'cli', needsKey: false, hasKey: false, custom: false,
  installed, path: installed ? `C:/Users/dev/AppData/Roaming/npm/${id}.cmd` : null, version
})

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const REPLY = `I added a **round system** in \`ServerScriptService/RoundService.luau\`.

- Intermission runs for 15 seconds, then players teleport to the map
- The last player standing wins, and the result goes to every client

\`\`\`luau
local function startRound()
\tstate.phase = "Playing"
\tfor _, player in Players:GetPlayers() do
\t\tplayer:LoadCharacter() -- respawn at the map
\tend
end
\`\`\`

Nothing was playtested yet. Press Play in Studio to try it.`

export function installDevMock(): void {
  if (window.api) return
  let listener: ((id: string, e: AgentEvent) => void) | null = null
  const cancelled = new Set<string>()
  const api: Api = {
    listProviders: async () => {
      await sleep(300)
      return [
        def('claude', 'Claude', true, '2.1.286', true, true),
        def('codex', 'Codex', true, '0.166.0', true, true),
        def('gemini', 'Gemini', true, '0.67.0'),
        def('opencode', 'OpenCode', true, '2.2.7'),
        def('grok', 'Grok', true, '1.0.0'),
        { ...def('nvidia', 'NVIDIA', false, null), kind: 'hosted', needsKey: true },
        { ...def('ollama', 'Ollama', true, '0.40.14'), kind: 'hosted' },
        def('cursor', 'Cursor', false, null, false),
        def('muse', 'Muse Code', false, null, false),
        def('pi', 'Pi', false, null, false)
      ]
    },
    studioStatus: async () => ({ mcpInstalled: true, mcpPath: 'C:/Users/dev/AppData/Local/Roblox/mcp.bat', studioRunning: true }),
    listModels: async (id) => {
      await sleep(400)
      return id === 'claude'
        ? [
            { id: 'claude-fable-5-2', name: 'Fable 5.2', hint: 'Most capable' },
            { id: 'claude-opus-5-5', name: 'Opus 5.5', hint: 'Deep work' },
            { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', hint: 'Balanced' },
            { id: 'claude-haiku-5-5', name: 'Haiku 5.5', hint: 'Fastest' }
          ]
        : id === 'opencode'
          ? [
              { id: 'opencode/minimax-m3.1-flash-free', name: 'MiniMax M3.1 Flash Free', hint: 'Free · may train on prompts', free: true },
              { id: 'opencode/big-pickle', name: 'Big Pickle', hint: 'Free · may train on prompts', free: true },
              { id: 'anthropic/claude-sonnet-5-5', name: 'claude-sonnet-5-5', hint: 'anthropic' }
            ]
          : Array.from({ length: 30 }, (_, i) => ({ id: `vendor/model-${i + 1}`, name: `model-${i + 1}`, hint: 'vendor' }))
    },
    setKey: async (_n, key) => (key ? { ok: true, message: 'Key works. 61 chat models available.' } : { ok: true, message: 'Key removed.' }),
    testKey: async () => ({ ok: true, message: 'Key works. 61 chat models available.' }),
    checkUpdate: async () => ({ current: '0.1.0-beta.2', update: { version: '0.1.0-beta.3', name: 'Brickyard 0.1.0 beta 3', url: 'https://github.com/izzyfrm/brickyard/releases/tag/v0.1.0-beta.3', publishedAt: new Date().toISOString() } }),
    openRelease: async () => {},
    listCustom: async () => [],
    testCustom: async () => ({ ok: true, message: 'Connected. 312 models found.', count: 312 }),
    saveCustom: async (i) => ({ ok: true, message: `${i.name} added.` }),
    removeCustom: async () => {},
    appInfo: async () => ({ version: '0.1.0-beta.1', dataDir: 'C:/Users/dev/AppData/Roaming/brickyard' }),
    loadStore: async () => JSON.parse(localStorage.getItem('mock.store') ?? '{"projects":[],"threads":[]}') as StoreData,
    saveStore: async (d) => localStorage.setItem('mock.store', JSON.stringify(d)),
    pickFolder: async () => ({ name: 'obby-game', path: 'C:/Users/dev/obby-game' }),
    run: async (req) => {
      const emit = (e: AgentEvent): void => listener?.(req.threadId, e)
      const stop = (): boolean => cancelled.has(req.threadId)
      void (async () => {
        await sleep(500)
        emit({ kind: 'session', sessionId: 'mock' })
        for (const w of 'The user wants a round loop. I should check the existing scripts first.'.split(' ')) {
          if (stop()) break
          emit({ kind: 'thinking', text: w + ' ' })
          await sleep(40)
        }
        if (!stop()) {
          emit({ kind: 'tool', id: 't1', name: 'mcp__Roblox_Studio__script_search', input: { query: 'Round' } })
          await sleep(900)
          emit({ kind: 'tool_result', id: 't1', output: 'No scripts matched "Round".', isError: false })
          emit({ kind: 'tool', id: 't2', name: 'Edit', input: { file_path: 'src/server/RoundService.luau', old_string: 'local phase = nil', new_string: 'local state = { phase = "Intermission" }' } })
          await sleep(900)
          emit({ kind: 'tool_result', id: 't2', output: 'The file was updated.', isError: false })
        }
        for (const w of REPLY.split(/(?<=\s)/)) {
          if (stop()) break
          emit({ kind: 'text', text: w })
          await sleep(18)
        }
        cancelled.delete(req.threadId)
        emit({ kind: 'done', costUsd: 0.042 })
      })()
    },
    cancel: async (id) => void cancelled.add(id),
    onAgentEvent: (cb) => {
      listener = cb
      return () => (listener = null)
    },
    listDir: async (_root, dir) =>
      dir.endsWith('src')
        ? [{ name: 'RoundService.luau', path: dir + '/RoundService.luau', dir: false }]
        : [
            { name: 'src', path: dir + '/src', dir: true },
            { name: 'default.project.json', path: dir + '/default.project.json', dir: false }
          ],
    readFile: async () => ({ text: 'local Players = game:GetService("Players")\n\nlocal state = { phase = "Intermission" }\n\nreturn state\n', truncated: false }),
    gitChanges: async () => ({ repo: true, changes: [{ path: 'src/RoundService.luau', status: 'M' }, { path: 'src/Shop.luau', status: '??' }] }),
    gitDiff: async () => '@@ -1,3 +1,3 @@\n local Players = game:GetService("Players")\n-local phase = nil\n+local state = { phase = "Intermission" }\n'
  }
  window.api = api
}
