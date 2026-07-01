// Inline active-session screen (design). Reached from the Workouts list; shows a
// stats bar, a Finish button, and exercise cards with inline set rows (steppers
// + done checkmark). A rest timer auto-starts on completing a set. Finishing
// opens a bottom drawer to confirm, then returns to the workouts list.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { EditToggle } from '@/components/ui/EditToggle'
import { StatTile } from '@/components/ui/StatTile'
import { Toast } from '@/components/ui/Toast'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RestTimerSheet } from '@/components/workout/RestTimerSheet'
import { WorkoutExerciseCard } from '@/components/workout/WorkoutExerciseCard'
import { AddSessionExerciseSheet } from './AddSessionExerciseSheet'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { getWorkoutScreen } from '@/data/queries'
import {
  addPlannedSet,
  deleteExerciseLog,
  deleteSession,
  deleteSet,
  finishSession,
  resumeSession,
  toggleSetDone,
  updateSet,
} from '@/data/operations'
import { getPreference } from '@/prefs/preferences'
import { haptics } from '@/lib/haptics'

function formatElapsed(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function WorkoutScreen() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { sessionId } = useParams()

  const { data, loading } = useLiveData(() => getWorkoutScreen(sessionId), [sessionId])
  const session = data?.session
  const exercises = useMemo(() => data?.exercises ?? [], [data])

  const [editing, setEditing] = useState(false)
  const [addExOpen, setAddExOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // A one-second clock drives the live TIME stat and the rest countdown.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Rest timer: an end timestamp (drift-free) + its total for the progress bar.
  const [rest, setRest] = useState<{ endsAt: number | null; total: number }>({
    endsAt: null,
    total: getPreference('restTimerSec'),
  })
  const restRemaining = rest.endsAt ? Math.max(0, Math.ceil((rest.endsAt - nowMs) / 1000)) : 0
  const restActive = rest.endsAt !== null && restRemaining > 0

  const showToast = (message: string) => setToast(message)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 1900)
    return () => clearTimeout(id)
  }, [toast])

  // Redirect to the list if the session is missing (bad id or just deleted).
  useEffect(() => {
    if (!loading && !session) navigate('/workouts', { replace: true })
  }, [loading, session, navigate])

  const stats = useMemo(() => {
    let total = 0
    let done = 0
    let volumeKg = 0
    for (const { sets } of exercises) {
      for (const s of sets) {
        total++
        if (s.done) {
          done++
          volumeKg += s.weightKg * s.reps
        }
      }
    }
    return { total, done, volumeKg: Math.round(volumeKg) }
  }, [exercises])

  if (!session) return null

  const onToggleDone = async (setId: string) => {
    const nowDone = await toggleSetDone(setId)
    if (nowDone) {
      haptics.success()
      if (getPreference('autoRest')) {
        const sec = getPreference('restTimerSec')
        setRest({ endsAt: Date.now() + sec * 1000, total: sec })
      }
    }
  }

  const adjustRest = (delta: number) =>
    setRest((r) =>
      r.endsAt ? { endsAt: r.endsAt + delta * 1000, total: Math.max(15, r.total + delta) } : r
    )
  const skipRest = () => setRest((r) => ({ endsAt: null, total: r.total }))

  // Time stops once the session is finished — the stat freezes at finishedAt
  // instead of ticking against the live clock.
  const isFinished = session.finishedAt !== undefined
  const elapsedSec = Math.floor(((session.finishedAt ?? nowMs) - session.startedAt) / 1000)

  return (
    <Screen
      title={t('workout.title')}
      onBack={() => navigate('/workouts')}
      headerRight={
        exercises.length > 0 ? <EditToggle editing={editing} onToggle={setEditing} /> : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="kicker">
          {t(isFinished ? 'workout.finishedPrefix' : 'workout.activePrefix')} · {session.name}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile value={formatElapsed(elapsedSec)} label={t('workout.stat.time')} />
          <StatTile value={stats.volumeKg.toLocaleString()} label={t('workout.stat.volume')} />
          <StatTile value={`${stats.done}/${stats.total}`} label={t('workout.stat.sets')} />
        </div>

        {/* Finish / Continue — directly under the stats bar */}
        {isFinished ? (
          <Button className="w-full" onClick={() => resumeSession(session.id)}>
            {t('workout.continue')}
          </Button>
        ) : (
          <Button className="w-full" onClick={() => setFinishOpen(true)}>
            {t('workout.finish')}
          </Button>
        )}

        {/* Exercise cards */}
        {exercises.map((exercise, i) => (
          <WorkoutExerciseCard
            key={exercise.log.id}
            index={i}
            exercise={exercise}
            unit={exercise.log.weightUnit ?? 'kg'}
            editing={editing}
            onAddSet={() => addPlannedSet(exercise.log)}
            onUpdateSet={(setId, patch) => updateSet(setId, patch)}
            onToggleSetDone={onToggleDone}
            onDeleteSet={(setId) => deleteSet(setId)}
            onDeleteExercise={() => deleteExerciseLog(exercise.log.id)}
          />
        ))}

        <Button variant="secondary" className="w-full" onClick={() => setAddExOpen(true)}>
          <Plus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
          {t('session.addExercise')}
        </Button>

        {editing && (
          <Button variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)}>
            {t('session.deleteWorkout')}
          </Button>
        )}
      </div>

      {restActive && (
        <RestTimerSheet
          remaining={restRemaining}
          total={rest.total}
          onSkip={skipRest}
          onAdd={adjustRest}
        />
      )}

      {toast && <Toast message={toast} />}

      <AddSessionExerciseSheet
        open={addExOpen}
        sessionId={session.id}
        onClose={() => setAddExOpen(false)}
        onAdded={(name) => showToast(t('workout.addedExercise', { name }))}
      />

      {/* Finish confirmation — bottom drawer; on confirm, back to the list. */}
      <Drawer
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title={t('workout.finishConfirm.title')}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setFinishOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1"
              onClick={async () => {
                setFinishOpen(false)
                await finishSession(session.id)
                navigate('/workouts')
              }}
            >
              {t('workout.finish')}
            </Button>
          </div>
        }
      >
        <p className="text-base">{t('workout.finishConfirm.message')}</p>
      </Drawer>

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
