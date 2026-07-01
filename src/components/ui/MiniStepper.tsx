// Compact inline −/value/+ stepper used inside set rows (design's weight/reps
// controls). Bordered group on a muted surface; fires a selection haptic.
import { haptics } from '@/lib/haptics'

interface MiniStepperProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  ariaLabel: string
  format?: (value: number) => string
  className?: string
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function MiniStepper({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
  format,
  className,
}: MiniStepperProps) {
  const set = (next: number) => {
    const clamped = round(Math.min(max, Math.max(min, next)))
    if (clamped !== value) {
      haptics.selection()
      onChange(clamped)
    }
  }
  const btn =
    'flex h-7 w-6 shrink-0 items-center justify-center text-lg font-bold leading-none text-foreground disabled:opacity-40'
  return (
    <div
      className={
        'flex items-center justify-between gap-0.5 border-2 border-border bg-muted px-1 py-0.5 ' +
        (className ?? '')
      }
    >
      <button
        type="button"
        aria-label={`${ariaLabel} −`}
        disabled={value <= min}
        onClick={() => set(value - step)}
        className={btn}
      >
        –
      </button>
      <span className="min-w-[2.5ch] flex-1 text-center font-mono text-sm font-bold tabular-nums">
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        aria-label={`${ariaLabel} +`}
        disabled={value >= max}
        onClick={() => set(value + step)}
        className={btn}
      >
        +
      </button>
    </div>
  )
}
