import { Check, Info, Palette, RefreshCw, SlidersHorizontal, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Logo, ProviderMark } from '../components/ui/Marks'
import { Dialog } from '../components/ui/Overlays'
import { cn } from '../lib/cn'
import { ACCENTS, SURFACES, useSettings, type Accent, type Surface, type TextSize } from '../lib/settings'
import { useStore, type SettingsTab } from '../lib/store'

const TABS: { id: SettingsTab; name: string; icon: typeof Palette }[] = [
  { id: 'appearance', name: 'Appearance', icon: Palette },
  { id: 'agents', name: 'Agents', icon: Users },
  { id: 'behavior', name: 'Behavior', icon: SlidersHorizontal },
  { id: 'about', name: 'About', icon: Info }
]

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section>
      <h3 className="text-[13px] font-medium">{title}</h3>
      {hint && <p className="mt-0.5 text-xs leading-snug text-fg3">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

function Toggle({ on, onChange, title, hint }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string }): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left outline-none ring-1 ring-line transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-ember/60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-xs leading-snug text-fg3">{hint}</span>
      </span>
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200', on ? 'bg-ember' : 'bg-white/15')}>
        <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] duration-200 ease-spring', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; name: string }[]; onChange: (v: T) => void; label: string }): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-[10px] bg-black/40 p-0.5 ring-1 ring-line">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'relative h-7 rounded-[8px] px-3 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/60',
            value === o.id ? 'text-fg' : 'text-fg3 hover:text-fg2'
          )}
        >
          {value === o.id && (
            <motion.span layoutId={`seg-${label}`} transition={{ type: 'spring', stiffness: 520, damping: 40 }} className="absolute inset-0 rounded-[8px] bg-white/[0.1] shadow-[inset_0_1px_0_rgb(255_255_255/8%)]" />
          )}
          <span className="relative">{o.name}</span>
        </button>
      ))}
    </div>
  )
}

function Appearance(): React.JSX.Element {
  const s = useSettings()
  return (
    <div className="space-y-6">
      <Section title="Accent" hint="The one color Brickyard uses for focus, glow and anything that needs your eye.">
        <div role="radiogroup" aria-label="Accent" className="flex gap-2">
          {(Object.keys(ACCENTS) as Accent[]).map((id) => {
            const a = ACCENTS[id]
            const on = s.accent === id
            return (
              <button
                key={id}
                role="radio"
                aria-checked={on}
                aria-label={a.name}
                title={a.name}
                onClick={() => s.set({ accent: id })}
                className={cn(
                  'grid size-9 place-items-center rounded-full outline-none transition-[transform,box-shadow] duration-150 ease-spring hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-white/70',
                  on && 'ring-2 ring-white/80 ring-offset-2 ring-offset-[var(--raised)]'
                )}
                style={{ background: `linear-gradient(180deg, oklch(0.81 ${a.chroma * 0.82} ${a.hi}), oklch(0.66 ${a.chroma} ${a.hue}))`, boxShadow: on ? undefined : 'inset 0 1px 0 rgb(255 255 255 / 35%)' }}
              >
                {on && <Check className="size-4 text-black" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Surface" hint="How dark the background is.">
        <div role="radiogroup" aria-label="Surface" className="grid grid-cols-3 gap-2">
          {(Object.keys(SURFACES) as Surface[]).map((id) => {
            const sf = SURFACES[id]
            const on = s.surface === id
            return (
              <button
                key={id}
                role="radio"
                aria-checked={on}
                onClick={() => s.set({ surface: id })}
                className={cn('rounded-xl p-1.5 text-left outline-none ring-1 transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ember/60', on ? 'ring-2 ring-ember' : 'ring-line hover:ring-white/25')}
              >
                {/* A miniature of the app in that surface */}
                <span className="flex h-14 gap-1 rounded-lg p-1.5" style={{ background: sf.bg }}>
                  <span className="w-1/4 rounded" style={{ background: sf.bg, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 8%)' }} />
                  <span className="flex flex-1 items-end rounded p-1" style={{ background: sf.panel, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 8%)' }}>
                    <span className="h-2.5 w-full rounded-sm" style={{ background: sf.raised2 }} />
                  </span>
                </span>
                <span className="mt-1.5 block px-1 pb-0.5 text-xs">{sf.name}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Text size">
        <Segmented<TextSize>
          label="Text size"
          value={s.textSize}
          onChange={(textSize) => s.set({ textSize })}
          options={[
            { id: 'sm', name: 'Compact' },
            { id: 'md', name: 'Default' },
            { id: 'lg', name: 'Large' }
          ]}
        />
      </Section>

      <Section title="Effects">
        <div className="space-y-1.5">
          <Toggle on={s.glow} onChange={(glow) => s.set({ glow })} title="Glow" hint="The warm light on the home screen and around the message box." />
          <Toggle on={s.grain} onChange={(grain) => s.set({ grain })} title="Film grain" hint="A faint texture over the whole window." />
          <Toggle on={s.reduceMotion} onChange={(reduceMotion) => s.set({ reduceMotion })} title="Reduce motion" hint="Turns off springs, slides and shimmer." />
        </div>
      </Section>
    </div>
  )
}

function Agents(): React.JSX.Element {
  const providers = useStore((s) => s.providers)
  const scanning = useStore((s) => s.scanning)
  const rescan = useStore((s) => s.rescan)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs leading-snug text-fg3">Brickyard runs the CLIs already installed and signed in on this PC. It never sees your keys.</p>
        <Button size="sm" onClick={() => void rescan()} disabled={scanning} className="shrink-0">
          <RefreshCw className={cn(scanning && 'animate-spin')} /> Rescan
        </Button>
      </div>
      <div className="divide-y divide-line rounded-xl bg-black/30 ring-1 ring-line">
        {providers.map((p) => {
          const state = !p.installed ? 'Not installed' : p.supported ? 'Ready' : 'Detected'
          return (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <ProviderMark id={p.id} size={28} dim={!p.installed} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={cn('text-[13px] font-medium', !p.installed && 'text-fg2')}>{p.name}</span>
                  {p.version && <span className="font-mono text-[11px] text-fg3">{p.version}</span>}
                </div>
                <div className="truncate text-xs text-fg3">
                  {!p.installed ? p.authHint : p.supported ? <span className="font-mono text-[11px]">{p.path}</span> : 'Installed, but Brickyard has no chat adapter for it yet.'}
                </div>
              </div>
              <span className={cn('label shrink-0 rounded-full px-2 py-1 !tracking-[0.1em]', state === 'Ready' ? 'bg-ok/10 !text-ok' : state === 'Detected' ? 'bg-ember/10 !text-ember-hi' : 'bg-white/[0.04]')}>
                {state}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Behavior(): React.JSX.Element {
  const s = useSettings()
  const studioMcp = useStore((st) => st.studioMcp)
  const setStudioMcp = useStore((st) => st.setStudioMcp)
  return (
    <div className="space-y-6">
      <Section title="Teamwork">
        <div className="space-y-1.5">
          <Toggle
            on={s.delegate}
            onChange={(delegate) => s.set({ delegate })}
            title="Let agents call your other agents"
            hint="Claude and Codex can ask any other ready agent for a second opinion, a review or a side task. Each call uses that agent's own account."
          />
          <Toggle on={studioMcp} onChange={setStudioMcp} title="Attach Roblox Studio tools" hint="Gives the agent you are talking to the Studio MCP server. Agents it calls never get Studio access." />
        </div>
      </Section>
      <Section title="Send message with">
        <Segmented
          label="Send key"
          value={s.sendKey}
          onChange={(sendKey) => s.set({ sendKey })}
          options={[
            { id: 'enter', name: 'Enter' },
            { id: 'mod-enter', name: 'Ctrl + Enter' }
          ]}
        />
        <p className="mt-2 text-xs text-fg3">{s.sendKey === 'enter' ? 'Shift + Enter adds a new line.' : 'Enter adds a new line.'}</p>
      </Section>
    </div>
  )
}

function About(): React.JSX.Element {
  const [info, setInfo] = useState<{ version: string; dataDir: string } | null>(null)
  const reset = useSettings((s) => s.reset)
  useEffect(() => {
    void window.api.appInfo().then(setInfo)
  }, [])
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3.5">
        <Logo size={40} />
        <div>
          <div className="text-[17px] font-semibold tracking-[-0.02em]">Brickyard</div>
          <div className="label mt-0.5">{info ? `Version ${info.version}` : 'Loading'} · Beta</div>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-fg2">
        A free, open source control surface for building Roblox games with the AI agents you already use. This is a beta: expect rough edges, and keep your place backed up.
      </p>
      <Section title="Your data" hint="Threads and projects are stored only on this PC.">
        <div className="selectable rounded-xl bg-black/30 px-3 py-2.5 font-mono text-[11.5px] text-fg2 ring-1 ring-line">{info?.dataDir ?? '…'}</div>
      </Section>
      <Section title="Reset" hint="Puts appearance and behavior back to how they shipped. Threads are kept.">
        <Button onClick={reset}>Reset settings</Button>
      </Section>
    </div>
  )
}

export function SettingsDialog(): React.JSX.Element {
  const open = useStore((s) => s.settingsOpen)
  const shown = useStore((s) => s.settingsTab)
  const openSettings = useStore((s) => s.openSettings)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && openSettings(null)} title="Settings" className="h-[560px] w-[720px]">
      <div className="flex min-h-0 flex-1 border-t border-line">
        <nav className="w-[172px] shrink-0 space-y-px border-r border-line p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => openSettings(t.id)}
              className={cn(
                'relative flex h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/60',
                shown === t.id ? 'text-fg' : 'text-fg2 hover:bg-white/[0.04] hover:text-fg'
              )}
            >
              {shown === t.id && <motion.span layoutId="settings-tab" transition={{ type: 'spring', stiffness: 520, damping: 42 }} className="absolute inset-0 rounded-[10px] bg-white/[0.08]" />}
              <t.icon className="relative size-3.5" />
              <span className="relative">{t.name}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          <motion.div key={shown} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
            {shown === 'appearance' ? <Appearance /> : shown === 'agents' ? <Agents /> : shown === 'behavior' ? <Behavior /> : <About />}
          </motion.div>
        </div>
      </div>
    </Dialog>
  )
}
