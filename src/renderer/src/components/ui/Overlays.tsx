import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

/** Base UI sets data-starting-style / data-ending-style, so both overlays animate in and out. */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-6">
          <BaseDialog.Popup
            className={cn(
              'float pointer-events-auto flex max-h-full w-[560px] max-w-full flex-col overflow-hidden rounded-[20px] outline-none',
              'transition-[opacity,scale,translate,filter] duration-300 ease-spring will-change-transform',
              'data-[starting-style]:translate-y-3 data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0 data-[starting-style]:blur-[6px]',
              'data-[ending-style]:translate-y-2 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[ending-style]:blur-[4px]',
              className
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
              <div>
                <BaseDialog.Title className="text-[17px] font-semibold tracking-[-0.02em]">{title}</BaseDialog.Title>
                {description && <BaseDialog.Description className="mt-0.5 text-[13px] text-fg3">{description}</BaseDialog.Description>}
              </div>
              <BaseDialog.Close render={<Button variant="ghost" size="icon" aria-label="Close" />}>
                <X />
              </BaseDialog.Close>
            </div>
            {children}
          </BaseDialog.Popup>
        </div>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  side = 'top',
  align = 'start',
  className
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactElement
  children: ReactNode
  side?: 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  className?: string
}): React.JSX.Element {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner side={side} align={align} sideOffset={8} className="z-50">
          <BasePopover.Popup
            className={cn(
              'float origin-[var(--transform-origin)] rounded-2xl p-1.5 outline-none',
              'transition-[opacity,scale,translate] duration-200 ease-spring',
              'data-[starting-style]:scale-[0.94] data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0',
              className
            )}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}
