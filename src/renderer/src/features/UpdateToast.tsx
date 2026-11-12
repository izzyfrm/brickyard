import { ArrowDownToLine, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '../components/ui/Button'
import { useStore } from '../lib/store'

/** Bottom-right notice shown when GitHub has a newer Brickyard release. */
export function UpdateToast(): React.JSX.Element {
  const update = useStore((s) => s.update)
  const dismissed = useStore((s) => s.dismissedUpdate)
  const dismiss = useStore((s) => s.dismissUpdate)
  const show = !!update && update.version !== dismissed

  return (
    <AnimatePresence>
      {show && update && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="float fixed bottom-5 right-5 z-40 w-[340px] overflow-hidden rounded-2xl"
        >
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-16 h-24 bg-[radial-gradient(60%_100%_at_50%_100%,color-mix(in_oklch,var(--ember)_35%,transparent),transparent)]" />
          <div className="relative flex gap-3 p-4">
            <span className="relative mt-1 grid size-2.5 shrink-0 place-items-center">
              <span className="pulse-ring absolute size-2 rounded-full bg-ember" />
              <span className="relative size-2 rounded-full bg-ember shadow-[0_0_10px_var(--ember)]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold tracking-[-0.01em]">New update!</div>
              <p className="mt-0.5 text-[13px] leading-snug text-fg2">
                Brickyard {update.version} is out. Download the newest version.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ember" onClick={() => void window.api.openRelease(update.url)}>
                  <ArrowDownToLine /> Download
                </Button>
                <Button size="sm" variant="ghost" onClick={() => dismiss(update.version)}>
                  Later
                </Button>
              </div>
            </div>
            <button
              aria-label="Dismiss update notice"
              onClick={() => dismiss(update.version)}
              className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-md text-fg3 outline-none transition-colors hover:bg-white/10 hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/60"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
