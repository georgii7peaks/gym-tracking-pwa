// Exercise detail (docs/plans/progress-charts.md): one exercise's progression
// as a line chart, with 1M/3M/6M/All range chips (default All). An unknown
// exercise name (e.g. a stale/direct URL) just renders empty, no crash.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { EmptyState } from '@/components/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ProgressChart } from '@/components/ProgressChart'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { getExerciseProgress } from '@/data/queries'
import { filterByRange, type ProgressRange } from '@/domain/progress'
import { formatWeightValue } from '@/domain/weight'
import { formatDuration } from '@/domain/duration'
import { formatSessionDate } from '@/lib/datetime'

export function ExerciseProgressPage() {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const { exerciseName = '' } = useParams()
  const name = decodeURIComponent(exerciseName)

  const { data } = useLiveData(() => getExerciseProgress(name), [name])
  const series = data ?? { metric: 'weightReps' as const, points: [] }

  const [range, setRange] = useState<ProgressRange>('all')
  const filtered = filterByRange(series.points, range, Date.now())

  const formatValue = (value: number) =>
    series.metric === 'duration'
      ? formatDuration(value)
      : formatWeightValue(value, series.weightUnit ?? 'kg')

  return (
    <Screen title={name} onBack={() => navigate('/progress')}>
      <div className="flex flex-col gap-4">
        <SegmentedControl<ProgressRange>
          ariaLabel={t('progress.title')}
          value={range}
          onChange={setRange}
          options={[
            { value: '1m', label: t('progress.range.1m') },
            { value: '3m', label: t('progress.range.3m') },
            { value: '6m', label: t('progress.range.6m') },
            { value: 'all', label: t('progress.range.all') },
          ]}
        />

        {filtered.length === 0 ? (
          <EmptyState icon={TrendingUp} title={t('progress.noData')} />
        ) : (
          <ProgressChart
            points={filtered}
            formatValue={formatValue}
            formatDate={(ms) => formatSessionDate(ms, language)}
            ariaLabel={t('progress.chartLabel', { name })}
          />
        )}
      </div>
    </Screen>
  )
}
