import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusDot } from '../components/ui/Marks'
import { useStore } from '../lib/store'
import { Composer } from './Composer'
import { Message } from './Message'

const STARTERS = [
  { tag: 'Systems', text: 'Add a round system with an intermission, map teleport and a winner screen' },
  { tag: 'Security', text: 'Audit my RemoteEvents for exploits and fix anything the client can abuse' },
  { tag: 'Interface', text: 'Build a shop UI that works on phones, with the purchase checked on the server' },
  { tag: 'Debug', text: 'Read the Studio Output, find what is erroring and fix it' }
]

const rise = {
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 260, damping: 30, delay: 0.05 + i * 0.07 }
  })
}

function Hero(): React.JSX.Element {
  const studio = useStore((s) => s.studio)
  const on = !!studio?.studioRunning
  return (
    <motion.div
      key="hero"
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.985, filter: 'blur(6px)', transition: { duration: 0.18 } }}
      className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8"
    >
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        className="ember-sky pointer-events-none absolute inset-x-0 bottom-0 h-[70%]"
      />
      <div className="relative z-10 flex w-full max-w-[700px] flex-col items-center pb-[6vh]">
        <motion.div custom={0} variants={rise} className="mb-6 flex h-7 items-center gap-2 rounded-full bg-white/[0.04] pl-2.5 pr-3 ring-1 ring-line2 backdrop-blur">
          <StatusDot on={on} pulse />
          <span className="label !text-fg2">
            {studio === null ? 'Looking for Studio' : on ? (studio.mcpInstalled ? 'Studio connected · MCP ready' : 'Studio open · MCP missing') : 'Studio is closed'}
          </span>
        </motion.div>
        <motion.h1 custom={1} variants={rise} className="text-center text-[52px] font-semibold leading-[1.02] tracking-[-0.045em]">
          Build it in Studio.
          <br />
          <span className="ember-text">With any agent.</span>
        </motion.h1>
        <motion.p custom={2} variants={rise} className="mt-4 max-w-[440px] text-center text-[15px] leading-relaxed text-fg2">
          One place for Claude, Codex, Gemini and the rest, already wired into your Roblox place.
        </motion.p>
        <motion.div custom={3} variants={rise} className="mt-8 w-full">
          <Composer autoFocusKey="hero" />
        </motion.div>
        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          {STARTERS.map((s, i) => (
            <motion.button
              key={s.tag}
              custom={4 + i * 0.6}
              variants={rise}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => window.dispatchEvent(new CustomEvent('brickyard:prompt', { detail: s.text }))}
              className="group flex flex-col gap-1.5 rounded-2xl bg-black/40 p-3.5 text-left outline-none ring-1 ring-line backdrop-blur-md transition-[background-color,box-shadow] duration-200 hover:bg-black/55 hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-ember/70"
            >
              <span className="flex items-center justify-between">
                <span className="label !text-ember-hi">{s.tag}</span>
                <ArrowUpRight className="size-3.5 text-fg3 transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" />
              </span>
              <span className="text-[13px] leading-snug text-fg2 transition-colors group-hover:text-fg">{s.text}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function ThreadView({ id }: { id: string }): React.JSX.Element {
  const thread = useStore((s) => s.threads.find((t) => t.id === id))
  const running = useStore((s) => !!s.running[id])
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [away, setAway] = useState(false)

  const toBottom = useCallback((smooth: boolean) => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Follow the stream only while the user is already at the bottom.
  useEffect(() => {
    if (stick.current) toBottom(false)
  }, [thread?.messages, toBottom])

  useEffect(() => {
    stick.current = true
    toBottom(false)
  }, [id, toBottom])

  if (!thread) return <div />
  const lastId = thread.messages[thread.messages.length - 1]?.id

  return (
    <motion.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="relative flex h-full flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          const far = el.scrollHeight - el.scrollTop - el.clientHeight > 80
          stick.current = !far
          setAway(far)
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-7 px-8 pb-10 pt-8">
          {thread.messages.map((m) => (
            <Message key={m.id} msg={m} live={running && m.id === lastId} />
          ))}
        </div>
      </div>
      <div className="relative shrink-0 px-8 pb-5">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-panel to-transparent" />
        <AnimatePresence>
          {away && (
            <motion.button
              aria-label="Scroll to latest"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              onClick={() => toBottom(true)}
              className="float absolute -top-12 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full text-fg2 outline-none hover:text-fg"
            >
              <ArrowDown className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <div className="mx-auto w-full max-w-[716px]">
          <Composer autoFocusKey={id} />
        </div>
      </div>
    </motion.div>
  )
}

export function Chat(): React.JSX.Element {
  const activeId = useStore((s) => s.activeId)
  return (
    <AnimatePresence mode="wait" initial={false}>
      {activeId ? <ThreadView key={activeId} id={activeId} /> : <Hero key="hero" />}
    </AnimatePresence>
  )
}
