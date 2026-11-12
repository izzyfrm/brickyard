import { Check, ChevronRight, Copy, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { CustomProvider, ProviderStatus } from '../../../shared/types'
import { Button } from '../components/ui/Button'
import { ProviderMark } from '../components/ui/Marks'
import { cn } from '../lib/cn'
import { GUIDES, PRESETS } from '../lib/guides'
import { useStore } from '../lib/store'

const input =
  'selectable h-8 w-full min-w-0 rounded-lg bg-black/40 px-2.5 text-xs outline-none ring-1 ring-line2 transition-shadow placeholder:text-fg3 focus:ring-ember/70'

function Command({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-1 flex items-center gap-2 rounded-lg bg-black/50 py-1 pl-2.5 pr-1 ring-1 ring-line">
      <code className="selectable min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg">
        {text}
      </code>
      <button
        aria-label={`Copy ${text}`}
        onClick={() => {
          void navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
        className="grid size-6 shrink-0 place-items-center rounded-md text-fg3 outline-none transition-colors hover:bg-white/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
      >
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

function state(p: ProviderStatus): { label: string; tone: 'ok' | 'warn' | 'off' } {
  if (p.installed && p.supported) return { label: 'Ready', tone: 'ok' }
  if (p.installed) return { label: 'Detected', tone: 'warn' }
  if (p.kind === 'hosted') return { label: 'Set up', tone: 'warn' }
  return { label: 'Not installed', tone: 'off' }
}

function ProviderRow({
  p,
  open,
  onToggle
}: {
  p: ProviderStatus
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const guide = GUIDES[p.id]
  const s = state(p)
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])
  const detail = p.installed
    ? p.kind === 'hosted'
      ? p.id === 'ollama'
        ? `Local server running${p.version ? ` · v${p.version}` : ''}`
        : 'Ready · runs through OpenCode'
      : (p.path ?? '')
    : (guide?.about ?? p.authHint)
  return (
    <div ref={ref}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04]"
      >
        <ProviderMark id={p.id} size={28} dim={!p.installed} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-[13px] font-medium', !p.installed && 'text-fg2')}>
              {p.name}
            </span>
            {p.version && p.kind === 'cli' && (
              <span className="font-mono text-[11px] text-fg3">{p.version}</span>
            )}
          </div>
          <div
            className={cn(
              'truncate text-xs text-fg3',
              p.installed && p.kind === 'cli' && 'font-mono text-[11px]'
            )}
          >
            {detail}
          </div>
        </div>
        <span
          className={cn(
            'label shrink-0 rounded-full px-2 py-1 !tracking-[0.1em]',
            s.tone === 'ok'
              ? 'bg-ok/10 !text-ok'
              : s.tone === 'warn'
                ? 'bg-ember/10 !text-ember-hi'
                : 'bg-white/[0.04]'
          )}
        >
          {s.label}
        </span>
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-fg3 transition-transform duration-200 ease-spring',
            open && 'rotate-90'
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && guide && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-3 pb-3.5 pl-[52px]">
              {p.installed && <p className="text-xs leading-relaxed text-fg2">{guide.about}</p>}
              <ol className="space-y-2.5">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-px grid size-[18px] shrink-0 place-items-center rounded-full bg-white/[0.07] font-mono text-[10px] text-fg2">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 text-xs leading-relaxed text-fg2">
                      {step.text}
                      {step.command && <Command text={step.command} />}
                    </div>
                  </li>
                ))}
              </ol>
              {guide.limited && (
                <p className="rounded-lg bg-ember/[0.08] px-2.5 py-2 text-xs leading-snug text-ember-hi ring-1 ring-ember/20">
                  {guide.limited}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs">
                {guide.link && (
                  <a
                    href={guide.link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-fg2 underline-offset-2 hover:text-fg hover:underline"
                  >
                    {guide.link.label} <ExternalLink className="size-3" />
                  </a>
                )}
                <span className="text-fg3">Done? Press Rescan above.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NvidiaKey(): React.JSX.Element {
  const p = useStore((s) => s.providers.find((x) => x.id === 'nvidia'))
  const rescan = useStore((s) => s.rescan)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null)
  const save = async (value: string | null): Promise<void> => {
    setBusy(true)
    setNote(null)
    const r = await window.api.setKey('nvidia', value)
    setNote(r)
    setBusy(false)
    if (r.ok) {
      setKey('')
      void rescan()
    }
  }
  return (
    <div className="space-y-2 rounded-xl bg-black/30 p-3 ring-1 ring-line">
      <div className="flex items-center gap-2.5">
        <ProviderMark id="nvidia" size={22} />
        <span className="text-[13px] font-medium">NVIDIA API key</span>
        {p?.hasKey && (
          <span className="label ml-auto rounded-full bg-ok/10 px-2 py-0.5 !text-ok">Saved</span>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (key.trim()) void save(key)
        }}
      >
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={p?.hasKey ? 'Replace the saved key' : 'nvapi-…'}
          aria-label="NVIDIA API key"
          className={cn(input, 'flex-1 font-mono')}
        />
        <Button type="submit" size="sm" disabled={busy || !key.trim()}>
          {busy ? 'Checking…' : 'Save'}
        </Button>
        {p?.hasKey && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>
            Remove
          </Button>
        )}
      </form>
      {note && <p className={cn('text-xs', note.ok ? 'text-ok' : 'text-bad')}>{note.message}</p>}
      <p className="text-[11px] leading-snug text-fg3">
        Saving sends one tiny test request to NVIDIA, then the key is encrypted with Windows and
        never shown again. NVIDIA logs prompts sent to its free endpoints.
      </p>
    </div>
  )
}

function CustomForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const rescan = useStore((s) => s.rescan)
  const [name, setName] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState('')
  const [busy, setBusy] = useState<'test' | 'save' | null>(null)
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null)
  const modelList = models.split(/[\s,]+/).filter(Boolean)

  const test = async (): Promise<void> => {
    setBusy('test')
    setNote(await window.api.testCustom(baseURL, apiKey || null))
    setBusy(null)
  }
  const save = async (): Promise<void> => {
    setBusy('save')
    const r = await window.api.saveCustom({
      name,
      baseURL,
      models: modelList,
      apiKey: apiKey || null
    })
    setBusy(null)
    setNote(r)
    if (r.ok) {
      await rescan()
      onDone()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="space-y-3 rounded-xl bg-black/30 p-3 ring-1 ring-line"
    >
      <div>
        <div className="label mb-1.5">Start from</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              title={p.note}
              onClick={() => {
                setName(p.name)
                setBaseURL(p.baseURL)
                setNote(null)
              }}
              className={cn(
                'h-7 rounded-lg px-2.5 text-xs outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ember/60',
                baseURL === p.baseURL
                  ? 'bg-ember/[0.12] text-ember-hi ring-ember/40'
                  : 'text-fg2 ring-line hover:bg-white/[0.05] hover:text-fg'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[11px] text-fg3">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My provider"
            className={input}
          />
        </label>
        <label className="space-y-1 text-[11px] text-fg3">
          API key <span className="text-fg3/70">(optional)</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            className={cn(input, 'font-mono')}
          />
        </label>
      </div>
      <label className="block space-y-1 text-[11px] text-fg3">
        Base URL <span className="text-fg3/70">(OpenAI-compatible, ends in /v1)</span>
        <input
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          spellCheck={false}
          placeholder="https://openrouter.ai/api/v1"
          className={cn(input, 'font-mono')}
        />
      </label>
      <label className="block space-y-1 text-[11px] text-fg3">
        Model ids{' '}
        <span className="text-fg3/70">
          (optional if the endpoint lists its models; separate with commas)
        </span>
        <input
          value={models}
          onChange={(e) => setModels(e.target.value)}
          spellCheck={false}
          placeholder="qwen/qwen3-coder:free"
          className={cn(input, 'font-mono')}
        />
      </label>
      {note && <p className={cn('text-xs', note.ok ? 'text-ok' : 'text-bad')}>{note.message}</p>}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ember"
          disabled={!!busy || !name.trim() || !baseURL.trim()}
          onClick={() => void save()}
        >
          {busy === 'save' ? 'Saving…' : 'Add provider'}
        </Button>
        <Button size="sm" disabled={!!busy || !baseURL.trim()} onClick={() => void test()}>
          {busy === 'test' ? 'Testing…' : 'Test connection'}
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-fg3">
        Runs through OpenCode, so it needs OpenCode installed. The key is encrypted with Windows.
        Pick models that support tool calling, or the agent cannot edit files.
      </p>
    </motion.div>
  )
}

function CustomList(): React.JSX.Element {
  const [list, setList] = useState<CustomProvider[]>([])
  // "Add your own provider" in the agent picker opens Settings with this form already open.
  const [adding, setAdding] = useState(() => useStore.getState().guideFor === 'custom')
  const rescan = useStore((s) => s.rescan)
  const providers = useStore((s) => s.providers)
  useEffect(() => {
    void window.api.listCustom().then(setList)
  }, [providers])
  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <div className="divide-y divide-line rounded-xl bg-black/30 ring-1 ring-line">
          {list.map((c) => (
            <div key={c.id} className="group flex items-center gap-3 px-3 py-2.5">
              <ProviderMark id={c.id} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{c.name}</div>
                <div className="truncate font-mono text-[11px] text-fg3">
                  {c.baseURL}
                  {c.hasKey ? ' · key saved' : ''}
                  {c.models.length
                    ? ` · ${c.models.length} model${c.models.length === 1 ? '' : 's'} added`
                    : ''}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${c.name}`}
                onClick={async () => {
                  await window.api.removeCustom(c.id)
                  void rescan()
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <CustomForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line2 text-[13px] text-fg2 outline-none transition-colors hover:border-white/25 hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <Plus className="size-3.5" /> Add your own provider
        </button>
      )}
    </div>
  )
}

function Group({
  title,
  hint,
  children
}: {
  title: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h3 className="text-[13px] font-medium">{title}</h3>
      {hint && <p className="mt-0.5 text-xs leading-snug text-fg3">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

export function AgentsSettings(): React.JSX.Element {
  const providers = useStore((s) => s.providers)
  const scanning = useStore((s) => s.scanning)
  const rescan = useStore((s) => s.rescan)
  // The open guide lives in the store, so the agent picker can open Settings on a specific one.
  const open = useStore((s) => s.guideFor)
  const toggle = (id: string): void => useStore.setState({ guideFor: open === id ? null : id })
  const clis = providers.filter((p) => p.kind === 'cli')
  const hosts = providers.filter((p) => p.kind === 'hosted' && !p.custom)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs leading-snug text-fg3">
          Click any agent to see how to connect it. Brickyard never sees your keys for agent CLIs.
        </p>
        <Button size="sm" onClick={() => void rescan()} disabled={scanning} className="shrink-0">
          <RefreshCw className={cn(scanning && 'animate-spin')} /> Rescan
        </Button>
      </div>
      <Group title="Agent CLIs">
        <div className="divide-y divide-line overflow-hidden rounded-xl bg-black/30 ring-1 ring-line">
          {clis.map((p) => (
            <ProviderRow key={p.id} p={p} open={open === p.id} onToggle={() => toggle(p.id)} />
          ))}
        </div>
      </Group>
      <Group
        title="Model hosts"
        hint="NVIDIA’s API and models on your own PC. OpenCode does the editing, so it must be installed."
      >
        <div className="space-y-2">
          <div className="divide-y divide-line overflow-hidden rounded-xl bg-black/30 ring-1 ring-line">
            {hosts.map((p) => (
              <ProviderRow key={p.id} p={p} open={open === p.id} onToggle={() => toggle(p.id)} />
            ))}
          </div>
          <NvidiaKey />
        </div>
      </Group>
      <Group
        title="Your own providers"
        hint="Any service that speaks the OpenAI API: OpenRouter, Groq, LM Studio, a company gateway."
      >
        <CustomList />
      </Group>
    </div>
  )
}
