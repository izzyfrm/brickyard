import { AlertTriangle, Check, ChevronRight, Copy, FilePen, FileText, Globe, Search, Terminal, Wrench, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message as Msg, Part } from '../../../shared/types'
import { ProviderMark, StudioIcon } from '../components/ui/Marks'
import { cn } from '../lib/cn'
import { highlight } from '../lib/highlight'
import { useStore } from '../lib/store'

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [done, setDone] = useState(false)
  return (
    <button
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
      className="grid size-6 place-items-center rounded-md text-fg3 outline-none transition-colors hover:bg-white/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
    >
      {done ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
    </button>
  )
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }): React.JSX.Element {
  const html = useMemo(() => highlight(code, lang), [code, lang])
  return (
    <div className="my-3 overflow-hidden rounded-xl bg-black/50 ring-1 ring-line">
      <div className="flex h-8 items-center justify-between border-b border-line pl-3 pr-1">
        <span className="label">{lang || 'text'}</span>
        <CopyButton text={code} />
      </div>
      <pre className="code overflow-x-auto p-3">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => <>{children}</>,
        code({ className, children }) {
          const raw = String(children ?? '')
          const lang = /language-([\w-]+)/.exec(className ?? '')?.[1]
          if (!lang && !raw.includes('\n')) return <code>{children}</code>
          return <CodeBlock code={raw.replace(/\n$/, '')} lang={lang} />
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        )
      }}
    >
      {text}
    </ReactMarkdown>
  )
})

/* ---------------------------------------------------------------- Tools */

function toolLook(name: string): { icon: React.ComponentType<{ className?: string }>; label: string; studio: boolean } {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name)
  if (mcp) {
    const studio = /roblox/i.test(mcp[1])
    return { icon: studio ? StudioIcon : Wrench, label: `${studio ? 'Studio' : mcp[1]} · ${mcp[2]}`, studio }
  }
  if (/roblox/i.test(name)) return { icon: StudioIcon, label: name.replace(/^roblox[_.]studio[_.]?/i, 'Studio · '), studio: true }
  const n = name.toLowerCase()
  if (/bash|shell|terminal|command|powershell/.test(n)) return { icon: Terminal, label: name, studio: false }
  if (/edit|write|replace|patch|file_change|notebook/.test(n)) return { icon: FilePen, label: name, studio: false }
  if (/read|list|ls|view/.test(n)) return { icon: FileText, label: name, studio: false }
  if (/grep|glob|search|find/.test(n) && !/web/.test(n)) return { icon: Search, label: name, studio: false }
  if (/web|fetch|http/.test(n)) return { icon: Globe, label: name, studio: false }
  return { icon: Wrench, label: name, studio: false }
}

/** The one argument worth showing on the collapsed row. */
function summary(input: unknown): string {
  if (input == null) return ''
  if (typeof input === 'string') return input
  const o = input as Record<string, unknown>
  for (const k of ['prompt', 'file_path', 'target_file', 'path', 'command', 'pattern', 'query', 'url', 'description', 'code', 'source']) {
    const v = o[k]
    if (typeof v === 'string' && v) {
      // Absolute paths: keep the last two segments, the rest is noise on one line.
      if (/path|file/.test(k) && /^([a-z]:[\\/]|\/)/i.test(v)) return v.split(/[\\/]/).slice(-2).join('/')
      return v.replace(/\s+/g, ' ')
    }
  }
  if (Array.isArray(o.changes)) return (o.changes as { path?: string }[]).map((c) => c.path).filter(Boolean).join(', ')
  const first = Object.values(o).find((v) => typeof v === 'string') as string | undefined
  return first ? first.replace(/\s+/g, ' ') : ''
}

function EditDiff({ before, after }: { before: string; after: string }): React.JSX.Element {
  return (
    <pre className="code overflow-x-auto">
      {before.split('\n').map((l, i) => (
        <div key={'a' + i} className="bg-bad/[0.1] px-3 text-[oklch(0.8_0.1_25)]">
          <span className="mr-2 select-none opacity-50">-</span>
          {l}
        </div>
      ))}
      {after.split('\n').map((l, i) => (
        <div key={'b' + i} className="bg-ok/[0.09] px-3 text-[oklch(0.86_0.1_150)]">
          <span className="mr-2 select-none opacity-50">+</span>
          {l}
        </div>
      ))}
    </pre>
  )
}

function ToolCard({ part }: { part: Extract<Part, { type: 'tool' }> }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const look = toolLook(part.name)
  // Calls to the user's other agents get that agent's own mark.
  const peerId = /ask_agent/.test(part.name) && typeof (part.input as { agent?: unknown } | null)?.agent === 'string' ? ((part.input as { agent: string }).agent) : null
  const peerName = useStore((s) => (peerId ? (s.providers.find((p) => p.id === peerId)?.name ?? peerId) : null))
  const sum = summary(part.input)
  const inp = (part.input ?? {}) as Record<string, unknown>
  const isEdit = typeof inp.old_string === 'string' && typeof inp.new_string === 'string'
  const inputText = typeof part.input === 'string' ? part.input : JSON.stringify(part.input, null, 2)

  return (
    <div className={cn('my-1.5 overflow-hidden rounded-xl ring-1 transition-colors', open ? 'bg-white/[0.03] ring-line2' : 'ring-line hover:bg-white/[0.03]')}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2.5 px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember/60"
      >
        {peerId ? <ProviderMark id={peerId} size={16} /> : <look.icon className={cn('size-3.5 shrink-0', look.studio ? 'text-ember' : 'text-fg3')} />}
        <span className="shrink-0 text-[13px] font-medium">{peerId ? `Ask ${peerName}` : look.label}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg3">{sum}</span>
        {!part.done ? (
          <span className="size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-white/15 border-t-fg2" />
        ) : part.isError ? (
          <X className="size-3.5 shrink-0 text-bad" />
        ) : (
          <Check className="size-3.5 shrink-0 text-ok/80" />
        )}
        <ChevronRight className={cn('size-3.5 shrink-0 text-fg3 transition-transform duration-200 ease-spring', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-line p-2.5">
              {isEdit ? (
                <div className="max-h-72 overflow-auto rounded-lg bg-black/40 py-1.5 ring-1 ring-line">
                  <EditDiff before={inp.old_string as string} after={inp.new_string as string} />
                </div>
              ) : (
                inputText &&
                inputText !== '{}' && (
                  <pre className="code max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2.5 text-fg2 ring-1 ring-line">{inputText}</pre>
                )
              )}
              {part.output ? (
                <pre
                  className={cn(
                    'code max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2.5 ring-1 ring-line',
                    part.isError ? 'text-[oklch(0.8_0.1_25)]' : 'text-fg2'
                  )}
                >
                  {part.output.length > 12000 ? part.output.slice(0, 12000) + '\n… output truncated' : part.output}
                </pre>
              ) : (
                part.done && <div className="label px-1">No output</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Thinking({ text, live }: { text: string; live: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="my-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md py-0.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
      >
        <ChevronRight className={cn('size-3.5 text-fg3 transition-transform duration-200 ease-spring', open && 'rotate-90')} />
        <span className={live ? 'shimmer' : 'text-fg3'}>{live ? 'Thinking' : 'Thought'}</span>
      </button>
      {open && <div className="selectable ml-[7px] mt-1 whitespace-pre-wrap border-l border-line2 pl-3.5 text-[13px] leading-relaxed text-fg3">{text}</div>}
    </div>
  )
}

function fmtDuration(ms: number): string {
  const s = ms / 1000
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

export const Message = memo(function Message({ msg, live }: { msg: Msg; live: boolean }) {
  const name = useStore((s) => s.providers.find((p) => p.id === msg.providerId)?.name ?? msg.providerId)

  if (msg.role === 'user') {
    const text = msg.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
    return (
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="flex justify-end"
      >
        <div className="lit selectable max-w-[82%] whitespace-pre-wrap rounded-[18px] rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed">{text}</div>
      </motion.div>
    )
  }

  const last = msg.parts[msg.parts.length - 1]
  const waiting = live && (!last || (last.type === 'tool' && last.done))
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
      <div className="mb-2 flex items-center gap-2">
        <ProviderMark id={msg.providerId ?? ''} size={18} />
        <span className="label !text-fg2">{name}</span>
      </div>
      {msg.parts.map((p, i) => {
        const isTail = i === msg.parts.length - 1
        if (p.type === 'text')
          return (
            <div key={i} className={cn('md', live && isTail && 'caret')}>
              <Markdown text={p.text} />
            </div>
          )
        if (p.type === 'thinking') return <Thinking key={i} text={p.text} live={live && isTail} />
        return <ToolCard key={p.id} part={p} />
      })}
      {waiting && <div className="shimmer mt-1 text-[13px]">{last ? 'Working' : 'Starting agent'}</div>}
      {msg.error && (
        <div className="selectable mt-2 flex gap-2.5 rounded-xl bg-bad/[0.08] p-3 text-[13px] leading-relaxed text-[oklch(0.84_0.08_25)] ring-1 ring-bad/25">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" />
          <span className="min-w-0 whitespace-pre-wrap break-words">{msg.error}</span>
        </div>
      )}
      {!live && msg.durationMs !== undefined && (
        <div className="label mt-2.5 flex gap-2 !tracking-[0.08em]">
          <span>{fmtDuration(msg.durationMs)}</span>
          {msg.costUsd !== undefined && msg.costUsd > 0 && <span>· ${msg.costUsd.toFixed(msg.costUsd < 0.1 ? 3 : 2)}</span>}
          {!msg.error && msg.parts.length === 0 && <span>· no output</span>}
        </div>
      )}
    </motion.div>
  )
})
