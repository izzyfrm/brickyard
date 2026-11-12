import { Folder, FolderPlus, Plus, Settings, SquarePen, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { Thread } from '../../../shared/types'
import { Button } from '../components/ui/Button'
import { Logo, ProviderMark, StatusDot } from '../components/ui/Marks'
import { cn } from '../lib/cn'
import { useStore } from '../lib/store'

function ThreadRow({ t }: { t: Thread }): React.JSX.Element {
  const active = useStore((s) => s.activeId === t.id)
  const running = useStore((s) => !!s.running[t.id])
  const open = useStore((s) => s.openThread)
  const del = useStore((s) => s.deleteThread)
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
      className="group relative"
    >
      {active && (
        <motion.span
          layoutId="thread-active"
          transition={{ type: 'spring', stiffness: 520, damping: 42 }}
          className="absolute inset-0 rounded-[10px] bg-white/[0.07] shadow-[inset_0_1px_0_rgb(255_255_255/6%)]"
        />
      )}
      <button
        onClick={() => open(t.id)}
        className={cn(
          'relative flex h-8 w-full items-center gap-2 rounded-[10px] pl-2 pr-8 text-left text-[13px] outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ember/60',
          active ? 'text-fg' : 'text-fg2 hover:bg-white/[0.035] hover:text-fg'
        )}
      >
        {running ? (
          <span className="grid size-4 shrink-0 place-items-center">
            <span className="size-3 animate-spin rounded-full border-[1.5px] border-ember/30 border-t-ember" />
          </span>
        ) : (
          <ProviderMark id={t.providerId} size={16} />
        )}
        <span className="truncate">{t.title}</span>
      </button>
      <button
        aria-label={`Delete ${t.title}`}
        onClick={() => del(t.id)}
        className="absolute right-1 top-1 grid size-6 place-items-center rounded-md text-fg3 opacity-0 outline-none transition-[opacity,color,background-color] hover:bg-white/10 hover:text-bad focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </motion.div>
  )
}

function Group({
  title,
  threads,
  onNew,
  onRemove
}: {
  title: string
  threads: Thread[]
  onNew: () => void
  onRemove?: () => void
}): React.JSX.Element {
  return (
    <div>
      <div className="group/h flex h-7 items-center gap-1.5 pl-2 pr-1">
        <Folder className="size-3 text-fg3" />
        <span className="label truncate">{title}</span>
        <span className="ml-auto flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/h:opacity-100">
          {onRemove && (
            <button aria-label={`Remove ${title}`} onClick={onRemove} className="grid size-5 place-items-center rounded text-fg3 hover:bg-white/10 hover:text-fg">
              <X className="size-3" />
            </button>
          )}
          <button aria-label={`New thread in ${title}`} onClick={onNew} className="grid size-5 place-items-center rounded text-fg3 hover:bg-white/10 hover:text-fg">
            <Plus className="size-3" />
          </button>
        </span>
      </div>
      <div className="space-y-px">
        <AnimatePresence initial={false}>
          {threads.map((t) => (
            <ThreadRow key={t.id} t={t} />
          ))}
        </AnimatePresence>
        {threads.length === 0 && <div className="px-2 py-1 text-xs text-fg3">No threads yet</div>}
      </div>
    </div>
  )
}

export function Sidebar(): React.JSX.Element {
  const projects = useStore((s) => s.projects)
  const threads = useStore((s) => s.threads)
  const studio = useStore((s) => s.studio)
  const providers = useStore((s) => s.providers)
  const { newThread, addProject, removeProject, setPanel, openSettings } = useStore.getState()

  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt)
  const loose = sorted.filter((t) => !t.projectId || !projects.some((p) => p.id === t.projectId))
  const ready = providers.filter((p) => p.installed && p.supported)

  return (
    <aside className="flex w-[264px] shrink-0 flex-col">
      <div className="drag flex h-11 shrink-0 items-center gap-2 px-4">
        <Logo size={18} />
        <span className="text-[14px] font-semibold tracking-[-0.02em]">Brickyard</span>
      </div>

      <div className="px-2.5 pb-2">
        <Button onClick={() => newThread()} className="w-full justify-start gap-2 pl-2.5">
          <SquarePen className="text-fg2" /> New thread
          <kbd className="ml-auto font-mono text-[10px] text-fg3">Ctrl N</kbd>
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 pb-3 pt-2">
        {projects.map((p) => (
          <Group
            key={p.id}
            title={p.name}
            threads={sorted.filter((t) => t.projectId === p.id)}
            onNew={() => newThread(p.id)}
            onRemove={() => removeProject(p.id)}
          />
        ))}
        {(loose.length > 0 || projects.length === 0) && <Group title="No project" threads={loose} onNew={() => newThread(null)} />}
        <button
          onClick={() => void addProject()}
          className="flex h-8 w-full items-center gap-2 rounded-[10px] border border-dashed border-line2 px-2 text-[13px] text-fg3 outline-none transition-colors hover:border-white/25 hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <FolderPlus className="size-3.5" /> Open project folder
        </button>
      </div>

      <div className="shrink-0 space-y-px border-t border-line p-2.5">
        <button
          onClick={() => setPanel('studio')}
          className="flex h-8 w-full items-center gap-2.5 rounded-[10px] px-2 text-[13px] text-fg2 outline-none transition-colors hover:bg-white/[0.05] hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <StatusDot on={!!studio?.studioRunning} pulse />
          {studio === null ? 'Checking Studio' : studio.studioRunning ? 'Studio is open' : 'Studio is closed'}
        </button>
        <button
          onClick={() => openSettings('agents')}
          className="flex h-8 w-full items-center gap-2.5 rounded-[10px] px-2 text-[13px] text-fg2 outline-none transition-colors hover:bg-white/[0.05] hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <span className="flex -space-x-1">
            {(ready.length ? ready : providers).slice(0, 4).map((p) => (
              <ProviderMark key={p.id} id={p.id} size={14} dim={!p.installed} />
            ))}
          </span>
          {providers.length === 0 ? 'Finding agents' : `${ready.length} agent${ready.length === 1 ? '' : 's'} ready`}
        </button>
        <button
          onClick={() => openSettings('appearance')}
          className="flex h-8 w-full items-center gap-2.5 rounded-[10px] px-2 text-[13px] text-fg2 outline-none transition-colors hover:bg-white/[0.05] hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <Settings className="size-3.5" />
          Settings
          <kbd className="ml-auto font-mono text-[10px] text-fg3">Ctrl ,</kbd>
        </button>
      </div>
    </aside>
  )
}
