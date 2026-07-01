// Start Workout sheet (APP_SPECIFICATION.md §5.2): pick a Routine Day to perform.
// Tapping a day runs Start a Session (§6.1) and navigates into the new session.
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { listRoutineDaySummaries } from '@/data/queries'
import { startSessionFromDay } from '@/data/operations'
import type { WorkoutSession } from '@/domain/types'

interface StartWorkoutSheetProps {
  open: boolean
  onClose: () => void
  onStarted: (session: WorkoutSession) => void
}

export function StartWorkoutSheet({ open, onClose, onStarted }: StartWorkoutSheetProps) {
  const { t } = useI18n()
  const { data } = useLiveData(() => listRoutineDaySummaries(), [open])
  const days = data ?? []

  const start = async (dayId: string) => {
    const session = await startSessionFromDay(dayId)
    if (session) {
      onClose()
      onStarted(session)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('startWorkout.title')}>
      {days.length === 0 ? (
        <p className="text-muted-foreground">{t('startWorkout.noDays')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {days.map(({ day, exerciseNames }) => (
            <li key={day.id}>
              <button
                type="button"
                onClick={() => start(day.id)}
                aria-label={`${day.name}. ${t('startWorkout.dayHint')}`}
                className="flex w-full flex-col gap-1 border-2 border-border bg-background p-3 text-left shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-base font-bold">{day.name}</span>
                {exerciseNames.length > 0 && (
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {exerciseNames.join(' · ')}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
