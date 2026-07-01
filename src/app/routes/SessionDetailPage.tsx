// Session detail (APP_SPECIFICATION.md §5.3): view/adjust one Workout Session and
// drill into each exercise to log sets. Same screen for a just-started or a past
// session. The workout name is fixed (snapshot); startedAt is editable.
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Plus } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { EditToggle } from '@/components/ui/EditToggle'
import { TextField } from '@/components/ui/TextField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RowEditControls } from '@/components/RowEditControls'
import { AddSessionExerciseSheet } from './AddSessionExerciseSheet'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { getSessionDetail, type ExerciseRow } from '@/data/queries'
import {
  deleteExerciseLog,
  deleteSession,
  reorderExerciseLogs,
  updateSessionStartedAt,
} from '@/data/operations'
import { moveItem } from '@/domain/ordering'
import { formatDuration } from '@/domain/duration'
import { formatWeightDisplay } from '@/domain/weight'
import { useUnitLabels } from '@/prefs/useWeightUnit'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/datetime'

export function SessionDetailPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  const labels = useUnitLabels()

  const { data, loading } = useLiveData(() => getSessionDetail(sessionId), [sessionId])
  const session = data?.session
  const rows = data?.rows ?? []

  const [editing, setEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // The session was deleted (or never existed) — return to the list.
  useEffect(() => {
    if (!loading && !session) navigate('/workouts', { replace: true })
  }, [loading, session, navigate])

  if (!session) return null

  const move = async (from: number, to: number) => {
    await reorderExerciseLogs(
      session.id,
      moveItem(
        rows.map((r) => r.log.id),
        from,
        to
      )
    )
  }

  const statusLine = (row: ExerciseRow): string => {
    if (row.setCount === 0) {
      const short =
        row.log.metric === 'duration' ? t('metric.duration.short') : t('metric.weightReps.short')
      return t('session.notStarted', { metric: short })
    }
    const last = row.lastSet
    if (row.log.metric === 'duration') {
      return t('session.summary.duration', {
        n: row.setCount,
        duration: formatDuration(last?.durationSec ?? 0),
      })
    }
    return t('session.summary.weightReps', {
      n: row.setCount,
      weight: formatWeightDisplay(last?.weightKg ?? 0, row.log.weightUnit ?? 'kg', labels),
      reps: last?.reps ?? 0,
    })
  }

  return (
    <Screen
      title={session.name}
      onBack={() => navigate('/workouts')}
      headerRight={
        rows.length > 0 ? <EditToggle editing={editing} onToggle={setEditing} /> : undefined
      }
    >
      <div className="flex flex-col gap-6">
        {/* Date & time */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t('session.dateSection')}
          </h2>
          <TextField
            type="datetime-local"
            aria-label={t('session.start')}
            value={toDateTimeLocalValue(session.startedAt)}
            onChange={(e) => {
              const ms = fromDateTimeLocalValue(e.target.value)
              if (ms !== null) updateSessionStartedAt(session.id, ms)
            }}
          />
        </section>

        {/* Exercises */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t('dayEditor.exercises')}
          </h2>
          {rows.length > 0 && (
            <ul className="flex flex-col gap-3">
              {rows.map((row, index) => (
                <li key={row.log.id} className="flex items-stretch gap-2">
                  <Link
                    to={`/workouts/${session.id}/exercises/${row.log.id}`}
                    className="flex flex-1 items-center gap-3 border-2 border-border bg-card p-3 shadow-retro active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-base font-bold">{row.log.name}</span>
                      <span className="text-sm text-muted-foreground">{statusLine(row)}</span>
                    </span>
                    {row.setCount > 0 && (
                      <CheckCircle2
                        aria-label={t('session.setsRecorded')}
                        className="h-5 w-5 shrink-0 text-success"
                        strokeWidth={2.5}
                      />
                    )}
                    <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                  {editing && (
                    <RowEditControls
                      index={index}
                      count={rows.length}
                      onMoveUp={() => move(index, index - 1)}
                      onMoveDown={() => move(index, index + 1)}
                      onDelete={() => deleteExerciseLog(row.log.id)}
                      deleteLabel={`${t('common.delete')}: ${row.log.name}`}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">{t('session.exercisesFooter')}</p>
        </section>

        {/* Add one-off exercise */}
        <section className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
            {t('session.addExercise')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('session.addExerciseFooter')}</p>
        </section>

        {/* Delete workout */}
        <section>
          <Button variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)}>
            {t('session.deleteWorkout')}
          </Button>
        </section>
      </div>

      <AddSessionExerciseSheet
        open={addOpen}
        sessionId={session.id}
        onClose={() => setAddOpen(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t('session.deleteWorkout')}
        message={t('workouts.delete.confirm')}
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          await deleteSession(session.id)
          setConfirmDelete(false)
          navigate('/workouts')
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  )
}
