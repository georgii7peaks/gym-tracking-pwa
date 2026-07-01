// A labelled −/+ stepper (APP_SPECIFICATION.md §5.5): weight, reps, minutes,
// seconds. Clamps to [min, max] by `step`; fires a selection haptic on change.
import { Minus, Plus } from 'lucide-react'
import { haptics } from '@/lib/haptics'

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** Optional display formatter for the current value (defaults to String). */
  format?: (value: number) => string
  /** Hide the numeric readout when the label already includes the value. */
  showValue?: boolean
}

// Avoid floating-point drift when stepping by fractional amounts (e.g. 2.5 kg).
function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  showValue = true,
}: StepperProps) {
  const set = (next: number) => {
    const clamped = round(Math.min(max, Math.max(min, next)))
    if (clamped !== value) {
      haptics.selection()
      onChange(clamped)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} −`}
          disabled={value <= min}
          onClick={() => set(value - step)}
          className="flex h-10 w-10 items-center justify-center border-2 border-border bg-card shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Minus aria-hidden className="h-4 w-4" strokeWidth={3} />
        </button>
        {showValue && (
          <span className="min-w-[3ch] text-center font-mono text-base font-bold tabular-nums">
            {format ? format(value) : value}
          </span>
        )}
        <button
          type="button"
          aria-label={`${label} +`}
          disabled={value >= max}
          onClick={() => set(value + step)}
          className="flex h-10 w-10 items-center justify-center border-2 border-border bg-card shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}
