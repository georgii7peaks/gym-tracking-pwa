// Progress tab (docs/plans/progress-by-program.md + body-weight-progress.md):
// the user's own Body Weight over time, plus training output BY PROGRAM — Total
// Volume (Σ weight×reps of done sets per Workout Session) and Total Duration
// (Σ durationSec), one coloured line per program so programs can be compared,
// with an optional filter down to a single program via a bottom Drawer.
// A "program" is the Workout Session's snapshotted name (CONTEXT.md: no link
// back to the Routine Day is stored) — so this tab never reads the routineDays
// table, and a deleted or renamed day keeps the history it already produced.
// Both weights are aggregated canonically in kg and shown in the Settings unit;
// ONE set of range chips (1M/3M/6M/All) narrows every chart here.
import { useState, type ReactNode } from 'react'
import { Check, ChevronRight, TrendingUp } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { EmptyState } from '@/components/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Drawer } from '@/components/ui/Drawer'
import { ProgressChart, type ChartSeries } from '@/components/ProgressChart'
import { PROGRAM_SLOTS, seriesColor } from '@/components/seriesColors'
import { BodyWeightSection } from '@/components/BodyWeightSection'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { getBodyWeightSeries, getProgramProgress } from '@/data/queries'
import { filterSeriesByRange, type ProgramSeries, type ProgressRange } from '@/domain/progress'
import { kgToDisplay } from '@/domain/weight'
import { formatDuration } from '@/domain/duration'
import { useWeightUnit } from '@/prefs/useWeightUnit'
import { formatSessionDate } from '@/lib/datetime'

/** Selected filter: a specific program name, or all programs combined. */
type Selection = string | 'all'

export function ProgressPage() {
  const { t, language } = useI18n()
  const { unit, unitLabel } = useWeightUnit()

  // One read with filter-independent deps: switching programs is a pure array
  // filter over what is already loaded, never another trip to IndexedDB.
  const { data } = useLiveData(() => getProgramProgress(), [])
  const programs = data?.programs ?? []

  const [selected, setSelected] = useState<Selection>('all')
  const [range, setRange] = useState<ProgressRange>('all')
  const [pickerOpen, setPickerOpen] = useState(false)

  const { data: bodyWeightData } = useLiveData(() => getBodyWeightSeries(), [])
  const bodyWeightPoints = bodyWeightData ?? []

  // Body weight works with zero workouts, so "nothing trained yet" is no longer
  // a tab-level early return: it becomes an inner block below the card. The
  // range chips only disappear when the whole tab is empty.
  const trained = programs.length > 0
  const showRange = trained || bodyWeightPoints.length > 0

  const now = Date.now()
  const formatDate = (ms: number) => formatSessionDate(ms, language)

  // The colour slot follows the PROGRAM, never its rank on the chart: this index
  // is independent of both the range chips and the selection, so narrowing the
  // range or picking a program can never repaint the lines that survive.
  const slotOf = new Map(programs.map((p, i) => [p.name, i]))

  const toChartSeries = (series: ProgramSeries[]): ChartSeries[] =>
    filterSeriesByRange(
      selected === 'all'
        ? // Hues are never cycled, so the combined view stops at the palette's
          // slots; the rest stay reachable one at a time.
          series.filter((s) => (slotOf.get(s.program) ?? PROGRAM_SLOTS) < PROGRAM_SLOTS)
        : series.filter((s) => s.program === selected),
      range,
      now
    ).map((s) => ({
      label: s.program,
      color: seriesColor(slotOf.get(s.program) ?? -1),
      points: s.points,
    }))

  // The program filter chooses which SERIES are plotted, never which CHARTS
  // exist: both are candidates, each rendered only if a series survives the
  // selection and the range. A program mixing both metrics appears on both.
  const charts = [
    {
      key: 'volume',
      title: t('progress.volume.title', { unit: unitLabel }),
      series: toChartSeries(data?.volume ?? []),
      formatValue: (value: number) => Math.round(kgToDisplay(value, unit)).toLocaleString(),
    },
    {
      key: 'duration',
      title: t('progress.duration.title'),
      series: toChartSeries(data?.duration ?? []),
      formatValue: formatDuration,
    },
  ].filter((chart) => chart.series.length > 0)

  const selectedLabel = selected === 'all' ? t('progress.filter.all') : selected
  const capped = selected === 'all' && programs.length > PROGRAM_SLOTS

  const pick = (value: Selection) => {
    setSelected(value)
    setPickerOpen(false)
  }

  return (
    <Screen title={t('progress.title')}>
      <div className="flex flex-col gap-4">
        {showRange && (
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
        )}

        <BodyWeightSection points={bodyWeightPoints} range={range} />

        {!trained ? (
          // Nothing trained yet — no program filter to offer, just the hint.
          <EmptyState
            icon={TrendingUp}
            title={t('progress.empty.title')}
            hint={t('progress.empty.hint')}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              data-testid="program-filter"
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

            {charts.length === 0 ? (
              <EmptyState icon={TrendingUp} title={t('progress.noData')} />
            ) : (
              <div className="flex flex-col gap-6">
                {charts.map((chart) => (
                  <ChartSection key={chart.key} title={chart.title}>
                    <ProgressChart
                      series={chart.series}
                      formatValue={chart.formatValue}
                      formatDate={formatDate}
                      ariaLabel={t('progress.chartLabel', { title: chart.title })}
                      legendLabel={t('progress.legend')}
                    />
                  </ChartSection>
                ))}
              </div>
            )}

            {capped && (
              <p className="text-center font-mono text-xs text-muted-foreground">
                {t('progress.program.capped')}
              </p>
            )}
          </>
        )}
      </div>

      <Drawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('progress.filter.button')}
      >
        <ul className="flex flex-col gap-2 pb-2">
          <li>
            <FilterRow
              label={t('progress.filter.all')}
              active={selected === 'all'}
              onClick={() => pick('all')}
            />
          </li>
          {programs.map((program, index) => (
            <li key={program.name}>
              <FilterRow
                label={program.name}
                // Teaches the legend's colour mapping before the chart is read.
                color={seriesColor(index)}
                sessions={t('progress.program.sessions', { n: program.sessionCount })}
                lastTrained={t('progress.lastTrained', {
                  date: formatDate(program.lastTrainedAt),
                })}
                active={selected === program.name}
                onClick={() => pick(program.name)}
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
  /** The program's chart colour; omitted for the "all programs" row. */
  color?: string
  sessions?: string
  lastTrained?: string
  active: boolean
  onClick: () => void
}

function FilterRow({ label, color, sessions, lastTrained, active, onClick }: FilterRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex w-full items-center gap-3 border-2 border-border bg-background p-3 text-left shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {color && (
        <span
          aria-hidden
          className="h-8 w-2 shrink-0 border-2 border-border"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="display text-base">{label}</span>
        {sessions && <span className="text-sm text-muted-foreground">{sessions}</span>}
        {lastTrained && (
          <span className="font-mono text-xs text-muted-foreground">{lastTrained}</span>
        )}
      </span>
      {active && <Check aria-hidden className="h-5 w-5 shrink-0 text-primary" />}
    </button>
  )
}
