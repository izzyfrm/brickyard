import { FolderTree, GitCompareArrows } from 'lucide-react'
import { StudioIcon } from './components/ui/Marks'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import { cn } from './lib/cn'
import { useStore, type PanelTab } from './lib/store'
import { Chat } from './features/Chat'
import { SettingsDialog } from './features/SettingsDialog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { applySettings, useSettings } from './lib/settings'
import { RightPanel } from './features/RightPanel'
import { Sidebar } from './features/Sidebar'

const PANELS: { id: PanelTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'files', label: 'Files', icon: FolderTree },
  { id: 'changes', label: 'Changes', icon: GitCompareArrows },
  { id: 'studio', label: 'Studio', icon: StudioIcon }
]

function TopBar(): React.JSX.Element {
  const title = useStore((s) => s.threads.find((t) => t.id === s.activeId)?.title)
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  return (
    // Right padding leaves room for the native window controls.
    <div className="drag flex h-11 shrink-0 items-center gap-3 pl-2 pr-[146px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={title ?? 'new'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
          className="min-w-0 truncate text-[13px] text-fg2"
        >
          {title ?? 'New thread'}
        </motion.span>
      </AnimatePresence>
      <div className="no-drag ml-auto flex items-center gap-0.5 rounded-[10px] bg-white/[0.04] p-0.5 ring-1 ring-line">
        {PANELS.map((p) => (
          <button
            key={p.id}
            aria-label={p.label}
            aria-pressed={panel === p.id}
            title={p.label}
            onClick={() => setPanel(panel === p.id ? null : p.id)}
            className={cn(
              'grid h-6 w-8 place-items-center rounded-[7px] outline-none transition-[background-color,color,transform] duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-ember/60',
              panel === p.id ? 'bg-white/[0.12] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/10%)]' : 'text-fg3 hover:text-fg'
            )}
          >
            <p.icon className="size-3.5" />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const panel = useStore((s) => s.panel)
  const reduceMotion = useSettings((s) => s.reduceMotion)

  useEffect(() => {
    applySettings(useSettings.getState())
    void useStore.getState().init()
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        useStore.getState().newThread()
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        useStore.getState().openSettings('appearance')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
    <div className="grain flex h-full bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1 pb-2 pr-2">
          <main className="stage relative min-w-0 flex-1 overflow-hidden rounded-2xl">{ready && (
              <ErrorBoundary>
                <Chat />
              </ErrorBoundary>
            )}</main>
          <AnimatePresence initial={false}>
            {panel && (
              <motion.div
                key="panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 448, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 40 }}
                className="shrink-0 overflow-hidden"
              >
                <div className="h-full pl-2">
                  <RightPanel />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <SettingsDialog />
    </div>
    </MotionConfig>
  )
}
