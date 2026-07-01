// Workouts tab / history (APP_SPECIFICATION.md §5.1): all sessions newest-first,
// each a tappable row into the Session detail. + opens the Start Workout sheet;
// Edit mode reveals a per-row delete that confirms (with a warning haptic).
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Dumbbell, Plus, Trash2 } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { EditToggle } from '@/components/ui/EditToggle'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StartWorkoutSheet } from './StartWorkoutSheet'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { listWorkoutSummaries, type WorkoutSummary } from '@/data/queries'
import { deleteSession } from '@/data/operations'
import { formatSessionDate } from '@/lib/datetime'
import { haptics } from '@/lib/haptics'

export function WorkoutsPage() {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const { data } = useLiveData(() => listWorkoutSummaries(), [])
  const summaries = data ?? []

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<WorkoutSummary | null>(null)

  const confirmDelete = async () => {
    if (pendingDelete) await deleteSession(pendingDelete.session.id)
    setPendingDelete(null)
  }

  return (
    <Screen
      title={t('workouts.title')}
      headerRight={
        <div className="flex items-center gap-2">
          {summaries.length > 0 && <EditToggle editing={editing} onToggle={setEditing} />}
          <Button
            size="icon"
            aria-label={t('workouts.new')}
            onClick={() => {
              haptics.selection()
              setSheetOpen(true)
            }}
          >
            <Plus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
          </Button>
        </div>
      }
    >
      {summaries.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title={t('workouts.empty.title')}
          hint={t('workouts.empty.hint')}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {summaries.map((summary) => (
            <li key={summary.session.id} className="flex items-stretch gap-2">
              <Link
                to={`/workouts/${summary.session.id}`}
                className="flex flex-1 flex-col gap-1 border-2 border-border bg-card p-3 shadow-retro active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-lg font-bold">{summary.session.name}</span>
                <span className="text-sm text-muted-foreground">
                  {formatSessionDate(summary.session.startedAt, language)}
                </span>
                <span className="text-sm font-semibold">
                  {t('workouts.summary', { n: summary.exerciseCount, m: summary.totalSets })}
                </span>
              </Link>
              {editing && (
                <button
                  type="button"
                  aria-label={`${t('common.delete')}: ${summary.session.name}`}
                  onClick={() => setPendingDelete(summary)}
                  className="flex w-12 shrink-0 items-center justify-center border-2 border-border bg-destructive text-destructive-foreground shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 aria-hidden className="h-5 w-5" strokeWidth={2.5} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <StartWorkoutSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onStarted={(session) => navigate(`/workouts/${session.id}`)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('session.deleteWorkout')}
        message={t('workouts.delete.confirm')}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  )
}
