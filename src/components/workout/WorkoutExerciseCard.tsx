// One exercise card on the inline Workout screen (design): header (index badge +
// name + metric note), column labels, set rows, and a dashed "Add set" button.
// In edit mode, a delete-exercise button and per-set delete appear.
import { Trash2 } from 'lucide-react'
import { SetRow } from './SetRow'
import { useI18n } from '@/i18n/I18nProvider'
import type { WorkoutExercise } from '@/data/queries'
import type { WeightUnit } from '@/prefs/preferences'

interface WorkoutExerciseCardProps {
  index: number
  exercise: WorkoutExercise
  unit: WeightUnit
  editing: boolean
  onAddSet: () => void
  onUpdateSet: (
    setId: string,
    patch: { weightKg?: number; reps?: number; durationSec?: number }
  ) => void
  onToggleSetDone: (setId: string) => void
  onDeleteSet: (setId: string) => void
  onDeleteExercise: () => void
}

const colLab = 'font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground'

export function WorkoutExerciseCard({
  index,
  exercise,
  unit,
  editing,
  onAddSet,
  onUpdateSet,
  onToggleSetDone,
  onDeleteSet,
  onDeleteExercise,
}: WorkoutExerciseCardProps) {
  const { t } = useI18n()
  const { log, sets } = exercise
  const isDuration = log.metric === 'duration'
  // Weight is entered in the exercise's unit; flag it (note line + weight column)
  // when that unit is pounds — kg is the canonical default and needs no marker.
  const note = isDuration
    ? t('metric.duration.short')
    : unit === 'lb'
      ? `${t('metric.weightReps.short')} · ${t('unit.lb')}`
      : t('metric.weightReps.short')
  const weightHeader =
    unit === 'lb' ? `${t('workout.colWeight')} · ${t('unit.lb')}` : t('workout.colWeight')

  return (
    <div className="overflow-hidden border-2 border-border bg-card shadow-retro">
      <div className="flex items-center gap-3 border-b-2 border-border px-3.5 py-3">
        <span className="display flex h-8 w-8 shrink-0 items-center justify-center border-2 border-border bg-primary text-sm text-primary-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="display truncate text-[15px]">{log.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{note}</div>
        </div>
        {editing && (
          <button
            type="button"
            aria-label={`${t('common.delete')}: ${log.name}`}
            onClick={onDeleteExercise}
            className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-border bg-destructive text-destructive-foreground"
          >
            <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="px-3 pb-3 pt-2">
        <div className="flex items-center gap-2 px-0 pb-1.5">
          <div className={`w-6 text-center ${colLab}`}>#</div>
          <div className={`flex-1 text-center ${colLab}`}>
            {isDuration ? t('workout.colTime') : weightHeader}
          </div>
          {!isDuration && (
            <div className={`w-[92px] text-center ${colLab}`}>{t('workout.colReps')}</div>
          )}
          <div className="w-10" />
          {editing && <div className="w-9" />}
        </div>

        {sets.map((set, i) => (
          <SetRow
            key={set.id}
            index={i}
            set={set}
            metric={log.metric}
            unit={unit}
            editing={editing}
            onUpdate={(patch) => onUpdateSet(set.id, patch)}
            onToggleDone={() => onToggleSetDone(set.id)}
            onDelete={() => onDeleteSet(set.id)}
          />
        ))}

        <button
          type="button"
          onClick={onAddSet}
          className="mt-1.5 w-full border-2 border-dashed border-border bg-transparent py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ＋ {t('workout.addSet')}
        </button>
      </div>
    </div>
  )
}
