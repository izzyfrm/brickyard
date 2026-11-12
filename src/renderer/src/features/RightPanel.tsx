import { ArrowLeft, ChevronRight, File, Folder, FolderOpen, FolderPlus, RefreshCw, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DirEntry, GitChange } from '../../../shared/types'
import { Button } from '../components/ui/Button'
import { ProviderMark, StatusDot } from '../components/ui/Marks'
import { cn } from '../lib/cn'
import { highlight, langFromPath } from '../lib/highlight'
import { useConfig, useStore, type PanelTab } from '../lib/store'

const TABS: { id: PanelTab; name: string }[] = [
  { id: 'files', name: 'Files' },
  { id: 'changes', name: 'Changes' },
  { id: 'studio', name: 'Studio' }
]

function useRoot(): { path: string; name: string } | null {
  const cfg = useConfig()
  const projects = useStore((s) => s.projects)
  return projects.find((p) => p.id === cfg.projectId) ?? null
}

function NoProject(): React.JSX.Element {
  const addProject = useStore((s) => s.addProject)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <FolderOpen className="size-6 text-fg3" />
      <p className="text-[13px] font-medium">No project folder</p>
      <p className="text-xs leading-relaxed text-fg3">Open the folder your Roblox project lives in (a Rojo project works best) to browse its code here.</p>
      <Button className="mt-2" onClick={() => void addProject()}>
        <FolderPlus /> Open folder
      </Button>
    </div>
  )
}

/* ---------------------------------------------------------------- Files */

function Node({ root, entry, depth, onOpen }: { root: string; entry: DirEntry; depth: number; onOpen: (p: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [kids, setKids] = useState<DirEntry[] | null>(null)
  const toggle = (): void => {
    if (!entry.dir) return onOpen(entry.path)
    setOpen((v) => !v)
    if (!kids) void window.api.listDir(root, entry.path).then(setKids)
  }
  return (
    <>
      <button
        onClick={toggle}
        style={{ paddingLeft: 8 + depth * 14 }}
        className="flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[13px] text-fg2 outline-none transition-colors hover:bg-white/[0.05] hover:text-fg focus-visible:bg-white/[0.07]"
      >
        {entry.dir ? (
          <>
            <ChevronRight className={cn('size-3 shrink-0 text-fg3 transition-transform duration-150', open && 'rotate-90')} />
            <Folder className="size-3.5 shrink-0 text-ember-hi/80" />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File className="size-3.5 shrink-0 text-fg3" />
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {open && kids?.map((k) => <Node key={k.path} root={root} entry={k} depth={depth + 1} onOpen={onOpen} />)}
      {open && kids?.length === 0 && (
        <div style={{ paddingLeft: 30 + depth * 14 }} className="h-6 text-xs leading-6 text-fg3">
          Empty
        </div>
      )}
    </>
  )
}

function Viewer({ root, file, onBack }: { root: string; file: string; onBack: () => void }): React.JSX.Element {
  const [state, setState] = useState<{ text: string; truncated: boolean } | { error: string } | null>(null)
  useEffect(() => {
    void window.api.readFile(root, file).then(setState)
  }, [root, file])
  const slash = (p: string): string => p.split('\\').join('/')
  const rel = slash(file).toLowerCase().startsWith(slash(root).toLowerCase()) ? slash(file).slice(root.length).replace(/^\//, '') : slash(file)
  const html = useMemo(() => (state && 'text' in state ? highlight(state.text, langFromPath(file)) : ''), [state, file])
  const lines = state && 'text' in state ? state.text.split('\n').length : 0
  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 460, damping: 40 }} className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-line px-2">
        <Button variant="ghost" size="icon" aria-label="Back to files" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <span className="truncate font-mono text-[11.5px] text-fg2">{rel}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {state === null ? (
          <div className="shimmer p-4 text-[13px]">Loading</div>
        ) : 'error' in state ? (
          <div className="p-4 text-[13px] text-fg3">{state.error}</div>
        ) : (
          <div className="flex min-w-max py-2">
            <pre aria-hidden className="code sticky left-0 select-none bg-panel pl-3 pr-3 text-right text-fg3/60">
              {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
            </pre>
            <pre className="code pr-4">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>
        )}
      </div>
      {state && 'truncated' in state && state.truncated && <div className="label border-t border-line px-3 py-1.5">File is large: showing the first 400 KB</div>}
    </motion.div>
  )
}

function Files({ root }: { root: string }): React.JSX.Element {
  const [entries, setEntries] = useState<DirEntry[] | null>(null)
  const [file, setFile] = useState<string | null>(null)
  useEffect(() => {
    void window.api.listDir(root, root).then(setEntries)
  }, [root])
  if (file) return <Viewer key={file} root={root} file={file} onBack={() => setFile(null)} />
  return (
    <div className="h-full overflow-y-auto p-1.5">
      {entries === null ? (
        <div className="shimmer p-2.5 text-[13px]">Loading</div>
      ) : entries.length === 0 ? (
        <div className="p-2.5 text-[13px] text-fg3">This folder is empty.</div>
      ) : (
        entries.map((e) => <Node key={e.path} root={root} entry={e} depth={0} onOpen={setFile} />)
      )}
    </div>
  )
}

/* -------------------------------------------------------------- Changes */

const STATUS_COLOR: Record<string, string> = { M: 'text-ember-hi', A: 'text-ok', '??': 'text-ok', D: 'text-bad', R: 'text-fg2' }

function DiffView({ root, file, onBack }: { root: string; file: string; onBack: () => void }): React.JSX.Element {
  const [diff, setDiff] = useState<string | null>(null)
  useEffect(() => {
    void window.api.gitDiff(root, file).then(setDiff)
  }, [root, file])
  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 460, damping: 40 }} className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-line px-2">
        <Button variant="ghost" size="icon" aria-label="Back to changes" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <span className="truncate font-mono text-[11.5px] text-fg2">{file}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        {diff === null ? (
          <div className="shimmer px-4 text-[13px]">Loading</div>
        ) : !diff ? (
          <div className="px-4 text-[13px] text-fg3">No text diff for this file.</div>
        ) : (
          <pre className="code min-w-max">
            {diff.split('\n').map((l, i) => {
              const meta = /^(diff |index |--- |\+\+\+ |new file|deleted file|similarity|rename)/.test(l)
              if (meta) return null
              return (
                <div
                  key={i}
                  className={cn(
                    'px-3',
                    l.startsWith('@@') && 'mt-2 bg-white/[0.04] py-0.5 text-fg3',
                    l.startsWith('+') && 'bg-ok/[0.09] text-[oklch(0.86_0.1_150)]',
                    l.startsWith('-') && 'bg-bad/[0.1] text-[oklch(0.8_0.1_25)]',
                    !/^[+\-@]/.test(l) && 'text-fg2'
                  )}
                >
                  {l || ' '}
                </div>
              )
            })}
          </pre>
        )}
      </div>
    </motion.div>
  )
}

function Changes({ root }: { root: string }): React.JSX.Element {
  const [data, setData] = useState<{ repo: boolean; changes: GitChange[] } | null>(null)
  const [file, setFile] = useState<string | null>(null)
  const busy = useStore((s) => Object.values(s.running).some(Boolean))
  const load = useCallback(() => void window.api.gitChanges(root).then(setData), [root])
  // Refresh when opened and every time an agent finishes a turn.
  useEffect(() => {
    if (!busy) load()
  }, [busy, load])

  if (file) return <DiffView key={file} root={root} file={file} onBack={() => setFile(null)} />
  if (data === null) return <div className="shimmer p-4 text-[13px]">Loading</div>
  if (!data.repo)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 px-8 text-center">
        <p className="text-[13px] font-medium">Not a git repository</p>
        <p className="text-xs leading-relaxed text-fg3">Run `git init` in this folder and Brickyard will show every file your agents change.</p>
      </div>
    )
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line pl-3 pr-1.5">
        <span className="label">
          {data.changes.length} changed file{data.changes.length === 1 ? '' : 's'}
        </span>
        <Button variant="ghost" size="icon" aria-label="Refresh" onClick={load}>
          <RefreshCw />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {data.changes.length === 0 && <div className="p-2.5 text-[13px] text-fg3">Working tree is clean.</div>}
        {data.changes.map((c) => (
          <button
            key={c.path}
            onClick={() => setFile(c.path)}
            className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.07]"
          >
            <span className={cn('w-4 shrink-0 text-center font-mono text-[11px] font-semibold', STATUS_COLOR[c.status] ?? 'text-fg2')}>{c.status === '??' ? 'N' : c.status[0]}</span>
            <span className="truncate font-mono text-[12px] text-fg2">{c.path}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Studio */

function StudioTab(): React.JSX.Element {
  const studio = useStore((s) => s.studio)
  const providers = useStore((s) => s.providers)
  const on = useStore((s) => s.studioMcp)
  const setStudioMcp = useStore((s) => s.setStudioMcp)
  return (
    <div className="h-full space-y-5 overflow-y-auto p-4">
      <div className="lit space-y-3 rounded-2xl p-4">
        <div className="flex items-center gap-2.5">
          <StatusDot on={!!studio?.studioRunning} pulse />
          <div>
            <div className="text-[13px] font-medium">{studio?.studioRunning ? 'Roblox Studio is open' : 'Roblox Studio is closed'}</div>
            <div className="text-xs text-fg3">{studio?.studioRunning ? 'Agents can read and edit your place.' : 'Open a place so agents can reach it.'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StatusDot on={!!studio?.mcpInstalled} />
          <div className="min-w-0">
            <div className="text-[13px] font-medium">{studio?.mcpInstalled ? 'Studio MCP server found' : 'Studio MCP server missing'}</div>
            <div className="truncate font-mono text-[11px] text-fg3">{studio?.mcpPath ?? 'Update Roblox Studio to get it'}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="label mb-2 px-1">Attach Studio tools</div>
        <button
          role="switch"
          aria-checked={on}
          onClick={() => setStudioMcp(!on)}
          className="flex w-full items-center gap-3 rounded-2xl p-3 text-left outline-none ring-1 ring-line transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium">Give agents the Studio MCP</span>
            <span className="block text-xs leading-snug text-fg3">Brickyard hands the server to the agent on each run, or uses the one already in its config. Your CLI config is never edited.</span>
          </span>
          <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200', on ? 'bg-ember' : 'bg-white/15')}>
            <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] duration-200 ease-spring', on ? 'left-[18px]' : 'left-0.5')} />
          </span>
        </button>
      </div>

      <div>
        <div className="label mb-2 px-1">Per agent</div>
        <div className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {providers
            .filter((p) => p.installed && p.supported)
            .map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 px-3 py-2.5">
                <ProviderMark id={p.id} size={20} />
                <span className="flex-1 text-[13px]">{p.name}</span>
                <span className={cn('text-xs', p.studioMcp ? 'text-ok' : 'text-fg3')}>
                  {p.studioMcpOwn ? 'Already in its config' : p.studioMcp ? 'Attached by Brickyard' : 'Set up in the CLI itself'}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export function RightPanel(): React.JSX.Element {
  const tab = useStore((s) => s.panel) ?? 'files'
  const setPanel = useStore((s) => s.setPanel)
  const root = useRoot()
  return (
    <div className="stage flex h-full w-[440px] flex-col overflow-hidden rounded-2xl">
      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-line px-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setPanel(t.id)}
            className={cn(
              'relative h-7 rounded-lg px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/60',
              tab === t.id ? 'text-fg' : 'text-fg3 hover:text-fg2'
            )}
          >
            {tab === t.id && (
              <motion.span layoutId="panel-tab" transition={{ type: 'spring', stiffness: 520, damping: 40 }} className="absolute inset-0 rounded-lg bg-white/[0.08]" />
            )}
            <span className="relative">{t.name}</span>
          </button>
        ))}
        {root && tab !== 'studio' && <span className="ml-2 truncate font-mono text-[11px] text-fg3">{root.name}</span>}
        <Button variant="ghost" size="icon" aria-label="Close panel" className="ml-auto" onClick={() => setPanel(null)}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'studio' ? <StudioTab /> : !root ? <NoProject /> : tab === 'files' ? <Files key={root.path} root={root.path} /> : <Changes key={root.path} root={root.path} />}
      </div>
    </div>
  )
}
