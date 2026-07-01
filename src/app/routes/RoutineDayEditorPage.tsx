// Routine Day editor (APP_SPECIFICATION.md §5.7): rename the day and manage its
// exercises inline (name field + metric segmented picker). Edit mode reveals
// delete + reorder. Renaming/reordering here affects only FUTURE sessions.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { EditToggle } from '@/components/ui/EditToggle'
import { TextField } from '@/components/ui/TextField'
import { PromptDialog } from '@/components/ui/PromptDialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { RowEditControls } from '@/components/RowEditControls'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { getRoutineDayEditor } from '@/data/queries'
import {
  addRoutineExercise,
  deleteRoutineExercise,
  renameRoutineDay,
  renameRoutineExercise,
  reorderRoutineExercises,
  setRoutineExerciseMetric,
  setRoutineExerciseWeightUnit,
} from '@/data/operations'
import { moveItem } from '@/domain/ordering'
import type { Metric, RoutineExercise } from '@/domain/types'
import type { WeightUnit } from '@/prefs/preferences'
import { haptics } from '@/lib/haptics'

export function RoutineDayEditorPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { dayId = '' } = useParams()

  const { data, loading } = useLiveData(() => getRoutineDayEditor(dayId), [dayId])
  const day = data?.day
  const exercises = data?.exercises ?? []

  const [editing, setEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')

  // Seed the name field once the day loads (and when navigating to another day).
  useEffect(() => {
    if (day) setName(day.name)
  }, [day?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // The day was deleted (or never existed) — return to the list.
  useEffect(() => {
    if (!loading && !day) navigate('/routines', { replace: true })
  }, [loading, day, navigate])

  if (!day) return null

  const commitName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== day.name) renameRoutineDay(day.id, trimmed)
    else if (!trimmed) setName(day.name)
  }

  const move = async (from: number, to: number) => {
    await reorderRoutineExercises(
      day.id,
      moveItem(
        exercises.map((e) => e.id),
        from,
        to
      )
    )
  }

  return (
    <Screen
      title={name || day.name}
      onBack={() => navigate('/routines')}
      headerRight={
        exercises.length > 0 ? <EditToggle editing={editing} onToggle={setEditing} /> : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t('dayEditor.nameSection')}</h2>
          <TextField value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="kicker">{t('dayEditor.exercises')}</h2>
          <ul className="flex flex-col gap-3">
            {exercises.map((exercise, index) => (
              <ExerciseEditorRow
                key={exercise.id}
                exercise={exercise}
                index={index}
                count={exercises.length}
                editing={editing}
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
              />
            ))}
          </ul>

          <Button
            variant="secondary"
            onClick={() => {
              haptics.selection()
              setAddOpen(true)
            }}
          >
            <Plus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
            {t('dayEditor.addExercise')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('dayEditor.footer')}</p>
        </section>
      </div>

      <PromptDialog
        open={addOpen}
        title={t('dayEditor.newExercise')}
        placeholder={t('dayEditor.exerciseName')}
        confirmLabel={t('common.add')}
        onSubmit={async (value) => {
          await addRoutineExercise(day.id, value)
          setAddOpen(false)
        }}
        onCancel={() => setAddOpen(false)}
      />
    </Screen>
  )
}

// One inline-editable routine exercise: name field + metric picker (+ reorder/
// delete when the list is in edit mode).
function ExerciseEditorRow({
  exercise,
  index,
  count,
  editing,
  onMoveUp,
  onMoveDown,
}: {
  exercise: RoutineExercise
  index: number
  count: number
  editing: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState(exercise.name)

  // Keep the field in sync if the underlying record changes identity.
  useEffect(() => {
    setName(exercise.name)
  }, [exercise.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== exercise.name) renameRoutineExercise(exercise.id, trimmed)
    else if (!trimmed) setName(exercise.name)
  }

  return (
    <li className="flex items-start gap-2">
      <div className="flex flex-1 flex-col gap-2 border-2 border-border bg-card p-3 shadow-retro-sm">
        <TextField value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} />
        <SegmentedControl<Metric>
          ariaLabel={t('dayEditor.dataType')}
          value={exercise.metric}
          onChange={(metric) => setRoutineExerciseMetric(exercise.id, metric)}
          options={[
            { value: 'weightReps', label: t('metric.weightReps') },
            { value: 'duration', label: t('metric.duration') },
          ]}
        />
        {exercise.metric === 'weightReps' && (
          <SegmentedControl<WeightUnit>
            ariaLabel={t('weightUnit.label')}
            value={exercise.weightUnit ?? 'kg'}
            onChange={(unit) => setRoutineExerciseWeightUnit(exercise.id, unit)}
            options={[
              { value: 'kg', label: t('unit.kg') },
              { value: 'lb', label: t('unit.lb') },
            ]}
          />
        )}
      </div>
      {editing && (
        <RowEditControls
          index={index}
          count={count}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={() => deleteRoutineExercise(exercise.id)}
          deleteLabel={`${t('common.delete')}: ${exercise.name}`}
        />
      )}
    </li>
  )
}
