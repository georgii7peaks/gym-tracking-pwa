// RetroUI-style button: bold border + hard offset shadow that "presses" in on
// active. Radix is layered in later phases only where a11y needs it.
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground border-2 border-border shadow-retro',
  secondary: 'bg-card text-card-foreground border-2 border-border shadow-retro',
  destructive: 'bg-destructive text-destructive-foreground border-2 border-border shadow-retro',
  ghost: 'bg-transparent text-foreground border-2 border-transparent',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-12 px-5 text-lg',
  icon: 'h-11 w-11',
}

const PRESSABLE =
  'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[transform,box-shadow] duration-75'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-retro)] font-semibold',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        variant !== 'ghost' && PRESSABLE,
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  )
})
