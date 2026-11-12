import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Tactile buttons: lit from above, they physically travel 1px when pressed.
 * `bone` is the loud one (white on black), `ember` is for the single most important action.
 */
const button = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium outline-none select-none',
    'transition-[transform,background-color,box-shadow,color,filter,opacity] duration-150 ease-spring',
    'active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
    'focus-visible:ring-2 focus-visible:ring-ember/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    '[&_svg]:size-[15px] [&_svg]:shrink-0'
  ],
  {
    variants: {
      variant: {
        bone: 'bg-[linear-gradient(180deg,#ffffff,#d6d5d1)] text-black shadow-[inset_0_1px_0_#fff,inset_0_-1px_0_rgb(0_0_0/18%),0_1px_2px_rgb(0_0_0/70%),0_0_0_1px_rgb(255_255_255/12%)] hover:brightness-110 active:shadow-[inset_0_1px_2px_rgb(0_0_0/30%)]',
        ember:
          'bg-[linear-gradient(180deg,var(--ember-hi),var(--ember))] text-black shadow-[inset_0_1px_0_rgb(255_255_255/45%),inset_0_-1px_0_rgb(0_0_0/20%),0_1px_2px_rgb(0_0_0/70%),0_6px_20px_-6px_var(--ember)] hover:brightness-110',
        dark: 'bg-[linear-gradient(180deg,var(--raised-2),var(--raised))] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/8%),0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/60%)] hover:brightness-125',
        ghost: 'text-fg2 hover:bg-white/[0.06] hover:text-fg'
      },
      size: {
        sm: 'h-7 rounded-lg px-2.5 text-xs',
        md: 'h-8 rounded-[10px] px-3 text-[13px]',
        lg: 'h-10 rounded-xl px-4 text-sm',
        icon: 'size-7 rounded-lg',
        'icon-lg': 'size-9 rounded-full'
      }
    },
    defaultVariants: { variant: 'dark', size: 'md' }
  }
)

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref
) {
  return <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...props} />
})
