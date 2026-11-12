import claude from '@lobehub/icons-static-svg/icons/claude-color.svg?raw'
import codex from '@lobehub/icons-static-svg/icons/codex-color.svg?raw'
import cursor from '@lobehub/icons-static-svg/icons/cursor.svg?raw'
import gemini from '@lobehub/icons-static-svg/icons/gemini-color.svg?raw'
import grok from '@lobehub/icons-static-svg/icons/grok.svg?raw'
import muse from '@lobehub/icons-static-svg/icons/muse-color.svg?raw'
import opencode from '@lobehub/icons-static-svg/icons/opencode.svg?raw'
import pi from '@lobehub/icons-static-svg/icons/pi.svg?raw'
import { siRobloxstudio } from 'simple-icons'
import type { ProviderId } from '../../../../shared/types'
import { cn } from '../../lib/cn'

/**
 * Real provider logos (bundled SVGs from @lobehub/icons-static-svg, MIT), shown only to
 * identify which agent is which. Monochrome marks inherit the text color.
 */
const LOGOS: Record<string, string> = { claude, codex, cursor, gemini, grok, muse, opencode, pi }

export function ProviderMark({ id, size = 22, dim = false }: { id: ProviderId | string; size?: number; dim?: boolean }): React.JSX.Element {
  const svg = LOGOS[id]
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-[linear-gradient(180deg,#222221,#151514)] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/10%),0_0_0_1px_var(--line-2)]',
        '[&>svg]:block [&>svg]:size-full',
        dim && 'opacity-40 grayscale'
      )}
      style={{ width: size, height: size, borderRadius: size * 0.3, padding: size * 0.19 }}
      {...(svg ? { dangerouslySetInnerHTML: { __html: svg } } : { children: '?' })}
    />
  )
}

/** The Roblox Studio logo, for anything that touches Studio. */
export function StudioIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d={siRobloxstudio.path} />
    </svg>
  )
}

/** The Brickyard mark: three staggered bricks. */
export function Logo({ size = 22 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="by-g" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.84 0.15 65)" />
          <stop offset="1" stopColor="oklch(0.66 0.2 38)" />
        </linearGradient>
      </defs>
      <rect x="2" y="3.5" width="12" height="7.5" rx="2" fill="url(#by-g)" />
      <rect x="16" y="3.5" width="6" height="7.5" rx="2" fill="url(#by-g)" opacity=".55" />
      <rect x="2" y="13" width="6" height="7.5" rx="2" fill="url(#by-g)" opacity=".55" />
      <rect x="10" y="13" width="12" height="7.5" rx="2" fill="url(#by-g)" />
    </svg>
  )
}

export function StatusDot({ on, pulse = false }: { on: boolean; pulse?: boolean }): React.JSX.Element {
  return (
    <span className="relative grid size-2 shrink-0 place-items-center">
      {on && pulse && <span className="pulse-ring absolute size-1.5 rounded-full bg-ok" />}
      <span className={cn('relative size-1.5 rounded-full', on ? 'bg-ok shadow-[0_0_8px_var(--ok)]' : 'bg-fg3/60')} />
    </span>
  )
}
