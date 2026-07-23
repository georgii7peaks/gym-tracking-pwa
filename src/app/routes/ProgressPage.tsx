// Progress tab (docs/plans/progress-total-volume.md): whole-body training output
// over time — Total Volume (Σ weight×reps of done sets per Workout Session) and
// Total Duration (Σ durationSec) — with an optional filter down to a single
// exercise via a bottom Drawer. Volume is aggregated canonically in kg and shown
// in the Settings weight unit; range chips (1M/3M/6M/All) narrow the charts.
import { useState, type ReactNode } from 'react'
import { Check, ChevronRight, TrendingUp } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { EmptyState } from '@/components/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Drawer } from '@/components/ui/Drawer'
import { ProgressChart } from '@/components/ProgressChart'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { getProgressSeries, listTrackedExercises } from '@/data/queries'
import { filterByRange, type ProgressRange } from '@/domain/progress'
import { kgToDisplay } from '@/domain/weight'
import { formatDuration } from '@/domain/duration'
import { useWeightUnit } from '@/prefs/useWeightUnit'
import { formatSessionDate } from '@/lib/datetime'

/** Selected filter: a specific exercise name, or all exercises combined. */
type Selection = string | 'all'

export function ProgressPage() {
  const { t, language } = useI18n()
  const { unit, unitLabel } = useWeightUnit()

  const { data: indexData } = useLiveData(() => listTrackedExercises(), [])
  const exercises = indexData ?? []

  const [selected, setSelected] = useState<Selection>('all')
  const [range, setRange] = useState<ProgressRange>('all')
  const [pickerOpen, setPickerOpen] = useState(false)

  const { data: seriesData } = useLiveData(
    () => getProgressSeries(selected === 'all' ? undefined : selected),
    [selected]
  )
  const volumePoints = seriesData?.volume.points ?? []
  const durationPoints = seriesData?.duration.points ?? []

  // Nothing trained at all → the tab-level empty state (no filter to offer).
  if (exercises.length === 0) {
    return (
      <Screen title={t('progress.title')}>
        <EmptyState
          icon={TrendingUp}
          title={t('progress.empty.title')}
          hint={t('progress.empty.hint')}
        />
      </Screen>
    )
  }

  // "All": show whichever total has data. A specific exercise: show only the one
  // chart matching its metric (weightReps → Volume, duration → Duration) — the
  // metric is the one the domain resolved for the name (buildExerciseIndex).
  const selectedMetric =
    selected === 'all' ? undefined : exercises.find((e) => e.name === selected)?.metric
  const now = Date.now()
  const formatDate = (ms: number) => formatSessionDate(ms, language)

  // Both charts, described uniformly; only those shown for the current selection
  // and with points in range survive the filter, then render via one map.
  const charts = [
    {
      show: selected === 'all' || selectedMetric === 'weightReps',
      title:
        selected === 'all'
          ? t('progress.volume.title', { unit: unitLabel })
          : t('progress.volume.titleFor', { name: selected, unit: unitLabel }),
      points: filterByRange(volumePoints, range, now),
      formatValue: (value: number) => Math.round(kgToDisplay(value, unit)).toLocaleString(),
    },
    {
      show: selected === 'all' || selectedMetric === 'duration',
      title:
        selected === 'all'
          ? t('progress.duration.title')
          : t('progress.duration.titleFor', { name: selected }),
      points: filterByRange(durationPoints, range, now),
      formatValue: formatDuration,
    },
  ].filter((chart) => chart.show && chart.points.length > 0)

  const selectedLabel = selected === 'all' ? t('progress.filter.all') : selected

  const pick = (value: Selection) => {
    setSelected(value)
    setPickerOpen(false)
  }

  return (
    <Screen title={t('progress.title')}>
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={`${t('progress.filter.button')}: ${selectedLabel}`}
          className="flex items-center justify-between gap-3 border-2 border-border bg-card p-3 text-left shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-mono text-xs uppercase text-muted-foreground">
              {t('progress.filter.button')}
            </span>
            <span className="display truncate text-base">{selectedLabel}</span>
          </span>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>

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

        {charts.length === 0 ? (
          <EmptyState icon={TrendingUp} title={t('progress.noData')} />
        ) : (
          <div className="flex flex-col gap-6">
            {charts.map((chart) => (
              <ChartSection key={chart.title} title={chart.title}>
                <ProgressChart
                  points={chart.points}
                  formatValue={chart.formatValue}
                  formatDate={formatDate}
                  ariaLabel={t('progress.chartLabel', { title: chart.title })}
                />
              </ChartSection>
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('progress.filter.button')}
      >
        <ul className="flex flex-col gap-2 pb-2">
          <li>
            <FilterRow label={t('progress.filter.all')} active={selected === 'all'} onClick={() => pick('all')} />
          </li>
          {exercises.map((exercise) => (
            <li key={exercise.name}>
              <FilterRow
                label={exercise.name}
                metricShort={t(
                  exercise.metric === 'duration' ? 'metric.duration.short' : 'metric.weightReps.short'
                )}
                lastTrained={t('progress.lastTrained', {
                  date: formatDate(exercise.lastTrainedAt),
                })}
                active={selected === exercise.name}
                onClick={() => pick(exercise.name)}
              />
            </li>
          ))}
        </ul>
      </Drawer>
    </Screen>
  )
}

function ChartSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="display text-lg">{title}</h2>
      {children}
    </section>
  )
}

interface FilterRowProps {
  label: string
  metricShort?: string
  lastTrained?: string
  active: boolean
  onClick: () => void
}

function FilterRow({ label, metricShort, lastTrained, active, onClick }: FilterRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex w-full items-center gap-3 border-2 border-border bg-background p-3 text-left shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="display text-base">{label}</span>
        {metricShort && <span className="text-sm text-muted-foreground">{metricShort}</span>}
        {lastTrained && (
          <span className="font-mono text-xs text-muted-foreground">{lastTrained}</span>
        )}
      </span>
      {active && <Check aria-hidden className="h-5 w-5 shrink-0 text-primary" />}
    </button>
  )
}
