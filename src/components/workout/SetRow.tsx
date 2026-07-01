// One inline set row (design): # · weight/reps (or duration) steppers · done
// checkmark, plus a delete affordance in edit mode. Weight edits in the display
// unit but persist canonical kg.
import { Check, Trash2 } from 'lucide-react'
import { MiniStepper } from '@/components/ui/MiniStepper'
import { useI18n } from '@/i18n/I18nProvider'
import { displayToKg, kgToDisplay, WEIGHT_UNITS } from '@/domain/weight'
import { formatDuration } from '@/domain/duration'
import type { Metric, SetEntry } from '@/domain/types'
import type { WeightUnit } from '@/prefs/preferences'
import { cn } from '@/lib/cn'

interface SetRowProps {
  index: number
  set: SetEntry
  metric: Metric
  unit: WeightUnit
  editing: boolean
  onUpdate: (patch: { weightKg?: number; reps?: number; durationSec?: number }) => void
  onToggleDone: () => void
  onDelete: () => void
}

const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

export function SetRow({
  index,
  set,
  metric,
  unit,
  editing,
  onUpdate,
  onToggleDone,
  onDelete,
}: SetRowProps) {
  const { t } = useI18n()
  const weightDisplay = Math.round(kgToDisplay(set.weightKg, unit) * 10) / 10

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-muted-foreground">
        {index + 1}
      </span>

      {metric === 'weightReps' ? (
        <>
          <MiniStepper
            className="flex-1"
            ariaLabel={t('workout.colWeight')}
            value={weightDisplay}
            min={0}
            max={WEIGHT_UNITS[unit].max}
            step={WEIGHT_UNITS[unit].step}
            format={fmtNum}
            onChange={(v) => onUpdate({ weightKg: displayToKg(v, unit) })}
          />
          <MiniStepper
            className="w-[92px]"
            ariaLabel={t('workout.colReps')}
            value={set.reps}
            min={1}
            max={100}
            step={1}
            onChange={(v) => onUpdate({ reps: v })}
          />
        </>
      ) : (
        <MiniStepper
          className="flex-1"
          ariaLabel={t('workout.colTime')}
          value={set.durationSec}
          min={0}
          max={3600}
          step={5}
          format={formatDuration}
          onChange={(v) => onUpdate({ durationSec: v })}
        />
      )}

      <button
        type="button"
        aria-label={t('workout.setDone')}
        aria-pressed={!!set.done}
        onClick={onToggleDone}
        className={cn(
          'flex h-9 w-10 shrink-0 items-center justify-center border-2 border-border',
          set.done ? 'bg-primary text-primary-foreground' : 'bg-card text-transparent'
        )}
      >
        <Check aria-hidden className="h-4 w-4" strokeWidth={3.5} />
      </button>

      {editing && (
        <button
          type="button"
          aria-label={t('common.delete')}
          onClick={onDelete}
          className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-border bg-destructive text-destructive-foreground"
        >
          <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
