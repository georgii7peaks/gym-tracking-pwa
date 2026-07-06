// RetroUI on/off switch: a labelled row with a chunky bordered track and a
// square thumb that slides right and fills with the accent when on.
import { haptics } from '@/lib/haptics'
import { cn } from '@/lib/cn'

interface SwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => {
          haptics.selection()
          onChange(!checked)
        }}
        className="relative h-8 w-14 shrink-0 border-2 border-border bg-card shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 h-6 w-6 border-2 border-border transition-[left] duration-100',
            checked ? 'left-[26px] bg-primary' : 'left-0.5 bg-muted'
          )}
        />
      </button>
    </div>
  )
}
