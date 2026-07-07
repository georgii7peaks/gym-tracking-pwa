// Progress tab (docs/plans/progress-charts.md): every exercise ever trained
// (>=1 done set), most recently trained first. Tapping one opens its chart.
import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { EmptyState } from '@/components/EmptyState'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { listTrackedExercises } from '@/data/queries'
import { formatSessionDate } from '@/lib/datetime'

export function ProgressListPage() {
  const { t, language } = useI18n()
  const { data } = useLiveData(() => listTrackedExercises(), [])
  const exercises = data ?? []

  return (
    <Screen title={t('progress.title')}>
      {exercises.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={t('progress.empty.title')}
          hint={t('progress.empty.hint')}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {exercises.map((exercise) => (
            <li key={exercise.name}>
              <Link
                to={`/progress/${encodeURIComponent(exercise.name)}`}
                className="flex flex-col gap-1 border-2 border-border bg-card p-3 shadow-retro active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="display text-lg">{exercise.name}</span>
                <span className="text-sm text-muted-foreground">
                  {t(
                    exercise.metric === 'duration'
                      ? 'metric.duration.short'
                      : 'metric.weightReps.short'
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {t('progress.lastTrained', {
                    date: formatSessionDate(exercise.lastTrainedAt, language),
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
