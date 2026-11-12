import { ArrowUp, Check, ChevronDown, Cpu, Eye, Folder, FolderPlus, PencilLine, RefreshCw, Search, ShieldOff, Square } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Access, ModelInfo } from '../../../shared/types'
import { ProviderMark, StudioIcon } from '../components/ui/Marks'
import { Popover } from '../components/ui/Overlays'
import { cn } from '../lib/cn'
import { useSettings } from '../lib/settings'
import { useConfig, useStore } from '../lib/store'

const chip =
  'flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-fg2 outline-none transition-[background-color,color,transform] duration-150 hover:bg-white/[0.07] hover:text-fg active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ember/60 data-[popup-open]:bg-white/[0.07] data-[popup-open]:text-fg'

const row =
  'flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left text-[13px] outline-none transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07] disabled:pointer-events-none disabled:opacity-45'

function ProviderPicker(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const providers = useStore((s) => s.providers)
  const configure = useStore((s) => s.configure)
  const cfg = useConfig()
  const current = providers.find((p) => p.id === cfg.providerId)
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-[260px]"
      trigger={
        <button className={chip} aria-label="Choose agent">
          <ProviderMark id={cfg.providerId} size={16} />
          <span className="font-medium text-fg">{current?.name ?? cfg.providerId}</span>
          <ChevronDown className="size-3 text-fg3" />
        </button>
      }
    >
      <div className="label px-2 pb-1 pt-1.5">Agent</div>
      {providers.map((p) => {
        const usable = p.installed && p.supported
        return (
          <button
            key={p.id}
            disabled={!usable}
            className={row}
            onClick={() => {
              if (p.id !== cfg.providerId) configure({ providerId: p.id, model: null })
              setOpen(false)
            }}
          >
            <ProviderMark id={p.id} size={20} dim={!usable} />
            <span className="flex-1">{p.name}</span>
            {!usable && (
              <span className="text-[11px] text-fg3">
                {p.id === 'nvidia' ? 'Add key in Settings' : p.id === 'ollama' ? 'Ollama not running' : p.installed ? 'No adapter yet' : 'Not installed'}
              </span>
            )}
            {p.id === cfg.providerId && <Check className="size-3.5 text-ember" />}
          </button>
        )
      })}
    </Popover>
  )
}

function ModelPicker(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [query, setQuery] = useState('')
  const configure = useStore((s) => s.configure)
  const cfg = useConfig()
  const providerId = cfg.providerId

  // Lists come from the CLI itself, so they match what this account can actually run.
  // The picker is remounted per provider (see key below), so this runs once per provider.
  useEffect(() => {
    let live = true
    void window.api.listModels(providerId).then((m) => live && setModels(m))
    return () => {
      live = false
    }
  }, [providerId])
  const reload = (): void => {
    setModels(null)
    void window.api.listModels(providerId, true).then(setModels)
  }

  const q = query.trim().toLowerCase()
  const shown = (models ?? []).filter((m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.hint?.toLowerCase().includes(q))
  const current = models?.find((m) => m.id === cfg.model)
  const custom = query.trim() && !(models ?? []).some((m) => m.id.toLowerCase() === q) ? query.trim() : null
  const pick = (id: string | null): void => {
    configure({ model: id })
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setQuery('')
        setOpen(o)
      }}
      className="flex max-h-[420px] w-[300px] flex-col"
      trigger={
        <button className={chip} aria-label="Choose model">
          <Cpu className="size-3.5" />
          <span className="max-w-[150px] truncate">{cfg.model ? (current?.name ?? cfg.model) : 'Default model'}</span>
          <ChevronDown className="size-3 text-fg3" />
        </button>
      }
    >
      <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
        <Search className="size-3.5 shrink-0 text-fg3" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (shown.length === 1) pick(shown[0].id)
            else if (custom) pick(custom)
          }}
          spellCheck={false}
          placeholder="Search or type a model id"
          className="selectable h-7 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg3"
        />
        <button
          aria-label="Reload model list"
          title="Reload model list"
          onClick={reload}
          className="grid size-6 shrink-0 place-items-center rounded-md text-fg3 outline-none transition-colors hover:bg-white/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <RefreshCw className={cn('size-3.5', models === null && 'animate-spin')} />
        </button>
      </div>
      <div className="-mx-1.5 min-h-0 flex-1 overflow-y-auto border-t border-line px-1.5 pt-1.5">
        {!q && (
          <button className={row} onClick={() => pick(null)}>
            <span className="flex-1">
              <span className="block">Default</span>
              <span className="block text-[11px] leading-snug text-fg3">Whatever the CLI is set to use</span>
            </span>
            {!cfg.model && <Check className="size-3.5 text-ember" />}
          </button>
        )}
        {models === null && <div className="shimmer px-2 py-2 text-[13px]">Asking the CLI for its models</div>}
        {shown.map((m) => (
          <button key={m.id} className={row} onClick={() => pick(m.id)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{m.name}</span>
              <span className="block truncate font-mono text-[10.5px] text-fg3">{[m.hint, m.name !== m.id ? m.id : null].filter(Boolean).join(' · ') || m.id}</span>
            </span>
            {m.id === cfg.model && <Check className="size-3.5 shrink-0 text-ember" />}
          </button>
        ))}
        {custom && (
          <button className={row} onClick={() => pick(custom)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                Use <span className="font-mono text-[12px]">{custom}</span>
              </span>
              <span className="block text-[11px] leading-snug text-fg3">Send this exact id to the CLI</span>
            </span>
          </button>
        )}
        {models !== null && models.length === 0 && !custom && (
          <div className="px-2 py-2 text-xs leading-snug text-fg3">This CLI did not report a model list. Type a model id to use it.</div>
        )}
      </div>
    </Popover>
  )
}

const ACCESS: { id: Access; name: string; hint: string; icon: typeof Eye }[] = [
  { id: 'ask', name: 'Plan only', hint: 'Reads and plans. Changes nothing.', icon: Eye },
  { id: 'edit', name: 'Edit', hint: 'Edits files and Studio. Risky commands are blocked.', icon: PencilLine },
  { id: 'full', name: 'Full access', hint: 'No permission checks at all.', icon: ShieldOff }
]

function AccessPicker(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const configure = useStore((s) => s.configure)
  const cfg = useConfig()
  const cur = ACCESS.find((a) => a.id === cfg.access) ?? ACCESS[1]
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-[270px]"
      trigger={
        <button className={cn(chip, cfg.access === 'full' && 'text-ember hover:text-ember')} aria-label="Access level">
          <cur.icon className="size-3.5" />
          {cur.name}
          <ChevronDown className="size-3 text-fg3" />
        </button>
      }
    >
      <div className="label px-2 pb-1 pt-1.5">Access</div>
      {ACCESS.map((a) => (
        <button
          key={a.id}
          className={row}
          onClick={() => {
            configure({ access: a.id })
            setOpen(false)
          }}
        >
          <a.icon className={cn('size-4 shrink-0', a.id === 'full' ? 'text-ember' : 'text-fg2')} />
          <span className="flex-1">
            <span className="block">{a.name}</span>
            <span className="block text-[11px] leading-snug text-fg3">{a.hint}</span>
          </span>
          {a.id === cfg.access && <Check className="size-3.5 text-ember" />}
        </button>
      ))}
    </Popover>
  )
}

function ProjectPicker(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const projects = useStore((s) => s.projects)
  const locked = useStore((s) => !!s.activeId)
  const { configure, addProject } = useStore.getState()
  const cfg = useConfig()
  const cur = projects.find((p) => p.id === cfg.projectId)
  const label = (
    <>
      <Folder className="size-3.5" />
      <span className="max-w-[140px] truncate">{cur?.name ?? 'No project'}</span>
    </>
  )
  // A thread stays in the folder it started in: its CLI session lives there.
  if (locked) return <span className="flex h-7 items-center gap-1.5 px-2 text-xs text-fg3">{label}</span>
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-[250px]"
      trigger={
        <button className={chip} aria-label="Choose project">
          {label}
          <ChevronDown className="size-3 text-fg3" />
        </button>
      }
    >
      <div className="label px-2 pb-1 pt-1.5">Work in</div>
      {[{ id: null as string | null, name: 'No project', path: 'Runs in your home folder' }, ...projects].map((p) => (
        <button
          key={p.id ?? 'none'}
          className={row}
          onClick={() => {
            configure({ projectId: p.id })
            setOpen(false)
          }}
        >
          <Folder className="size-4 shrink-0 text-fg2" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{p.name}</span>
            <span className="block truncate font-mono text-[10.5px] text-fg3">{p.path}</span>
          </span>
          {p.id === cfg.projectId && <Check className="size-3.5 text-ember" />}
        </button>
      ))}
      <div className="mt-1 border-t border-line pt-1">
        <button
          className={row}
          onClick={() => {
            setOpen(false)
            void addProject()
          }}
        >
          <FolderPlus className="size-4 text-fg2" /> Open folder…
        </button>
      </div>
    </Popover>
  )
}

function StudioToggle(): React.JSX.Element | null {
  const on = useStore((s) => s.studioMcp)
  const mcp = useStore((s) => !!s.studio?.mcpInstalled)
  const providers = useStore((s) => s.providers)
  const setStudioMcp = useStore((s) => s.setStudioMcp)
  const cfg = useConfig()
  const capable = !!providers.find((p) => p.id === cfg.providerId)?.studioMcp
  if (!mcp || !capable) return null
  return (
    <button
      aria-pressed={on}
      onClick={() => setStudioMcp(!on)}
      title={on ? 'Roblox Studio tools are attached to this agent' : 'Roblox Studio tools are off'}
      className={cn(chip, on && 'bg-ember/[0.12] text-ember hover:bg-ember/[0.18] hover:text-ember')}
    >
      <StudioIcon className="size-3.5" />
      Studio
      <span className={cn('size-1.5 rounded-full transition-colors', on ? 'bg-ember shadow-[0_0_6px_var(--ember)]' : 'bg-fg3/60')} />
    </button>
  )
}

export function Composer({ autoFocusKey }: { autoFocusKey: string }): React.JSX.Element {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const running = useStore((s) => (s.activeId ? !!s.running[s.activeId] : false))
  const { send, cancel } = useStore.getState()
  const sendKey = useSettings((s) => s.sendKey)
  const providerId = useConfig().providerId

  useEffect(() => {
    ref.current?.focus()
  }, [autoFocusKey])

  // Autosize up to a cap, then scroll.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [text])

  const submit = (): void => {
    if (running || !text.trim()) return
    send(text)
    setText('')
  }

  // Starter prompts dispatch this to fill the box.
  useEffect(() => {
    const h = (e: Event): void => {
      setText((e as CustomEvent<string>).detail)
      ref.current?.focus()
    }
    window.addEventListener('brickyard:prompt', h)
    return () => window.removeEventListener('brickyard:prompt', h)
  }, [])

  return (
    <div className="composer rounded-[22px] p-2">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          const mod = e.ctrlKey || e.metaKey
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && (sendKey === 'enter' ? !e.shiftKey : mod)) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Describe what to build or fix…"
        className="selectable block max-h-[220px] min-h-[44px] w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[15px] leading-relaxed outline-none placeholder:text-fg3"
      />
      <div className="flex items-center gap-0.5 pl-1">
        <ProviderPicker />
        <ModelPicker key={providerId} />
        <AccessPicker />
        <ProjectPicker />
        <StudioToggle />
        <div className="ml-auto">
          <AnimatePresence mode="popLayout" initial={false}>
            {running ? (
              <motion.button
                key="stop"
                aria-label="Stop"
                onClick={cancel}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 600, damping: 32 }}
                className="lit grid size-9 place-items-center rounded-full text-fg outline-none focus-visible:ring-2 focus-visible:ring-ember/70"
              >
                <Square className="size-3.5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                key="send"
                aria-label="Send"
                onClick={submit}
                disabled={!text.trim()}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 600, damping: 32 }}
                className={cn(
                  'grid size-9 place-items-center rounded-full outline-none transition-[background,box-shadow,color] duration-200 focus-visible:ring-2 focus-visible:ring-ember/70',
                  text.trim()
                    ? 'bg-[linear-gradient(180deg,#fff,#d6d5d1)] text-black shadow-[inset_0_1px_0_#fff,0_1px_2px_rgb(0_0_0/70%),0_4px_16px_-4px_rgb(255_255_255/35%)]'
                    : 'bg-white/[0.06] text-fg3'
                )}
              >
                <ArrowUp className="size-[18px]" strokeWidth={2.4} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
