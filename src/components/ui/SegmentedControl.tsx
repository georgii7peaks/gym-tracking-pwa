// RetroUI-style segmented control used for pickers (theme, language, metric…).
// Renders a radiogroup for accessibility.
import { cn } from '@/lib/cn'
import { haptics } from '@/lib/haptics'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex w-full rounded-[var(--radius-retro)] border-2 border-border bg-card p-1 shadow-retro-sm',
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (!selected) {
                haptics.selection()
                onChange(option.value)
              }
            }}
            className={cn(
              'flex-1 rounded-none px-3 py-2 text-sm font-semibold',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-muted-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
