import { create } from 'zustand'
import { useSettings } from './settings'
import type {
  Access,
  AgentEvent,
  Message,
  Part,
  Project,
  ProviderId,
  ProviderStatus,
  StudioStatus,
  Thread,
  UpdateInfo
} from '../../../shared/types'

export type PanelTab = 'files' | 'changes' | 'studio'
export type SettingsTab = 'appearance' | 'agents' | 'behavior' | 'about'

/** Settings for the next thread, and the fallback when no thread is open. */
interface Draft {
  providerId: ProviderId
  model: string | null
  access: Access
  projectId: string | null
}

interface State {
  ready: boolean
  providers: ProviderStatus[]
  scanning: boolean
  studio: StudioStatus | null
  studioMcp: boolean
  projects: Project[]
  threads: Thread[]
  activeId: string | null
  running: Record<string, boolean>
  draft: Draft
  panel: PanelTab | null
  settingsOpen: boolean
  update: UpdateInfo | null
  dismissedUpdate: string | null
  settingsTab: SettingsTab

  init(): Promise<void>
  rescan(): Promise<void>
  setPanel(p: PanelTab | null): void
  openSettings(tab: SettingsTab | null): void
  checkUpdate(): Promise<{ current: string; update: UpdateInfo | null; error?: string }>
  dismissUpdate(version: string): void
  setStudioMcp(v: boolean): void
  openThread(id: string | null): void
  newThread(projectId?: string | null): void
  deleteThread(id: string): void
  addProject(): Promise<void>
  removeProject(id: string): void
  configure(patch: Partial<Draft>): void
  send(text: string): void
  cancel(): void
  onEvent(threadId: string, e: AgentEvent): void
}

const uid = (): string => crypto.randomUUID()
const DRAFT_KEY = 'brickyard.draft.v2'

function loadDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    if (d?.providerId) return { providerId: d.providerId, model: d.model ?? null, access: d.access ?? 'edit', projectId: d.projectId ?? null }
  } catch {
    /* ignore */
  }
  return { providerId: 'claude', model: null, access: 'edit', projectId: null }
}

let initStarted = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(get: () => State): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const { projects, threads } = get()
    void window.api.saveStore({ projects, threads })
  }, 400)
}

/** Apply one streamed event to the last assistant message of a thread. */
function applyEvent(t: Thread, e: AgentEvent): Thread {
  const messages = t.messages.slice()
  const i = messages.length - 1
  const last = messages[i]
  if (!last || last.role !== 'assistant') return t
  const msg: Message = { ...last, parts: last.parts.slice() }
  messages[i] = msg
  const next: Thread = { ...t, messages, updatedAt: Date.now() }
  const tail = msg.parts[msg.parts.length - 1]

  switch (e.kind) {
    case 'session':
      next.sessionId = e.sessionId
      break
    case 'text':
    case 'thinking':
      if (tail?.type === e.kind) msg.parts[msg.parts.length - 1] = { ...tail, text: tail.text + e.text }
      else if (e.text.trim() || e.kind === 'text') msg.parts.push({ type: e.kind, text: e.text.replace(/^\n+/, '') })
      break
    case 'tool':
      if (!msg.parts.some((p) => p.type === 'tool' && p.id === e.id))
        msg.parts.push({ type: 'tool', id: e.id, name: e.name, input: e.input, done: false })
      break
    case 'tool_result':
      msg.parts = msg.parts.map((p): Part =>
        p.type === 'tool' && p.id === e.id ? { ...p, output: e.output, isError: e.isError, done: true } : p
      )
      break
    case 'error':
      msg.error = msg.error ? msg.error + '\n' + e.message : e.message
      break
    case 'done':
      msg.costUsd = e.costUsd
      msg.durationMs = e.durationMs ?? Date.now() - msg.at
      msg.parts = msg.parts.map((p): Part => (p.type === 'tool' && !p.done ? { ...p, done: true } : p))
      break
  }
  return next
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  providers: [],
  scanning: false,
  studio: null,
  studioMcp: localStorage.getItem('brickyard.studioMcp') !== '0',
  projects: [],
  threads: [],
  activeId: null,
  running: {},
  draft: loadDraft(),
  panel: null,
  settingsOpen: false,
  update: null,
  dismissedUpdate: localStorage.getItem('brickyard.dismissedUpdate'),
  settingsTab: 'appearance',

  async init() {
    // StrictMode mounts twice in dev; a second listener would duplicate every streamed token.
    if (initStarted) return
    initStarted = true
    window.api.onAgentEvent((id, e) => get().onEvent(id, e))
    const [data, studio] = await Promise.all([window.api.loadStore(), window.api.studioStatus()])
    set({ projects: data.projects, threads: data.threads, studio, ready: true })
    void get().rescan()
    setInterval(() => void window.api.studioStatus().then((s) => set({ studio: s })), 5000)
    // Check shortly after launch, then every six hours. GitHub allows 60 unauthenticated calls an hour.
    const auto = (): void => {
      if (useSettings.getState().updateCheck) void get().checkUpdate()
    }
    setTimeout(auto, 4000)
    setInterval(auto, 6 * 60 * 60 * 1000)
  },

  async rescan() {
    set({ scanning: true })
    const providers = await window.api.listProviders()
    set({ providers, scanning: false })
    // If the saved default isn't usable, fall to the first provider that is.
    const d = get().draft
    const ok = (id: ProviderId): boolean => providers.some((p) => p.id === id && p.installed && p.supported)
    if (!ok(d.providerId)) {
      const first = providers.find((p) => p.installed && p.supported)
      if (first) get().configure({ providerId: first.id, model: null })
    }
  },

  setPanel: (panel) => set({ panel }),
  async checkUpdate() {
    const r = await window.api.checkUpdate()
    if (!r.error) set({ update: r.update })
    return r
  },
  dismissUpdate(version) {
    localStorage.setItem('brickyard.dismissedUpdate', version)
    set({ dismissedUpdate: version })
  },
  openSettings: (tab) => set(tab ? { settingsOpen: true, settingsTab: tab } : { settingsOpen: false }),
  setStudioMcp: (v) => {
    localStorage.setItem('brickyard.studioMcp', v ? '1' : '0')
    set({ studioMcp: v })
  },

  openThread: (activeId) => set({ activeId }),
  newThread: (projectId) => {
    set({ activeId: null })
    if (projectId !== undefined) get().configure({ projectId })
  },

  deleteThread(id) {
    if (get().running[id]) void window.api.cancel(id)
    set((s) => ({ threads: s.threads.filter((t) => t.id !== id), activeId: s.activeId === id ? null : s.activeId }))
    persist(get)
  },

  async addProject() {
    const picked = await window.api.pickFolder()
    if (!picked) return
    const existing = get().projects.find((p) => p.path === picked.path)
    const project = existing ?? { id: uid(), ...picked }
    if (!existing) set((s) => ({ projects: [...s.projects, project] }))
    set({ activeId: null })
    get().configure({ projectId: project.id })
    persist(get)
  },

  removeProject(id) {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      threads: s.threads.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
      draft: s.draft.projectId === id ? { ...s.draft, projectId: null } : s.draft
    }))
    persist(get)
  },

  /** Changes the open thread if there is one, and always the default for new threads. */
  configure(patch) {
    const { activeId } = get()
    set((s) => {
      const draft = { ...s.draft, ...patch }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      if (!activeId) return { draft }
      return {
        draft,
        threads: s.threads.map((t) => {
          if (t.id !== activeId) return t
          const switched = patch.providerId !== undefined && patch.providerId !== t.providerId
          return {
            ...t,
            providerId: patch.providerId ?? t.providerId,
            model: patch.model !== undefined ? patch.model : switched ? null : t.model,
            access: patch.access ?? t.access,
            // A different CLI cannot resume another CLI's session.
            sessionId: switched ? null : t.sessionId
          }
        })
      }
    })
    persist(get)
  },

  send(text) {
    const prompt = text.trim()
    if (!prompt) return
    const s = get()
    let thread = s.threads.find((t) => t.id === s.activeId)
    if (thread && s.running[thread.id]) return
    if (!thread) {
      thread = {
        id: uid(),
        projectId: s.draft.projectId,
        title: prompt.replace(/\s+/g, ' ').slice(0, 60),
        providerId: s.draft.providerId,
        model: s.draft.model,
        access: s.draft.access,
        sessionId: null,
        messages: [],
        updatedAt: Date.now()
      }
    }
    const now = Date.now()
    const user: Message = { id: uid(), role: 'user', parts: [{ type: 'text', text: prompt }], at: now }
    const reply: Message = { id: uid(), role: 'assistant', parts: [], providerId: thread.providerId, at: now }
    const updated: Thread = { ...thread, messages: [...thread.messages, user, reply], updatedAt: now }
    set((st) => ({
      threads: st.threads.some((t) => t.id === updated.id)
        ? st.threads.map((t) => (t.id === updated.id ? updated : t))
        : [updated, ...st.threads],
      activeId: updated.id,
      running: { ...st.running, [updated.id]: true }
    }))
    persist(get)
    const project = s.projects.find((p) => p.id === updated.projectId)
    const info = s.providers.find((p) => p.id === updated.providerId)
    void window.api.run({
      threadId: updated.id,
      providerId: updated.providerId,
      prompt,
      cwd: project?.path ?? null,
      sessionId: updated.sessionId,
      model: updated.model,
      access: updated.access,
      studioMcp: s.studioMcp && !!info?.studioMcp && !!s.studio?.mcpInstalled,
      delegate: useSettings.getState().delegate
    })
  },

  cancel() {
    const id = get().activeId
    if (id && get().running[id]) void window.api.cancel(id)
  },

  onEvent(threadId, e) {
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? applyEvent(t, e) : t)),
      running: e.kind === 'done' ? { ...s.running, [threadId]: false } : s.running
    }))
    if (e.kind === 'done' || e.kind === 'session' || e.kind === 'tool_result') persist(get)
  }
}))

/** The config the composer shows: the open thread's, or the draft. */
export function useConfig(): { providerId: ProviderId; model: string | null; access: Access; projectId: string | null } {
  return useStore((s) => {
    const t = s.threads.find((x) => x.id === s.activeId)
    return t ?? s.draft
  })
}
