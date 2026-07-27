// Body Weight card on the Progress tab (docs/plans/body-weight-progress.md
// step 7). Independent of the exercise filter and usable before the first
// workout ever happens. The Y axis auto-scales so a 2 kg trend is actually
// visible, and the weigh-ins can be read raw or as daily / weekly averages.
import { useState } from 'react'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import { ProgressChart } from './ProgressChart'
import { BodyWeightDialog } from './BodyWeightDialog'
import { BodyWeightHistoryDrawer } from './BodyWeightHistoryDrawer'
import { useI18n } from '@/i18n/I18nProvider'
import { useWeightUnit } from '@/prefs/useWeightUnit'
import { formatWeightValue } from '@/domain/weight'
import { formatSessionDate } from '@/lib/datetime'
import { logBodyWeight } from '@/data/operations'
import {
  bodyWeightDelta,
  filterByRange,
  groupBodyWeightPoints,
  type BodyWeightGrouping,
  type ProgressPoint,
  type ProgressRange,
} from '@/domain/progress'

interface BodyWeightSectionProps {
  /** Every Body Weight Entry as a point, oldest first (raw, unfiltered). */
  points: ProgressPoint[]
  /** The Progress tab's shared range chips — they drive this chart too. */
  range: ProgressRange
}

export function BodyWeightSection({ points, range }: BodyWeightSectionProps) {
  const { t, language } = useI18n()
  const { unit, unitLabel } = useWeightUnit()
  const [grouping, setGrouping] = useState<BodyWeightGrouping>('raw')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Filter by range FIRST, then group — a bucket must never mix in weigh-ins
  // from outside the selected range.
  const plotted = groupBodyWeightPoints(filterByRange(points, range, Date.now()), grouping)
  // "Current" is always the latest RAW entry: never averaged, never range-filtered.
  const latest = points[points.length - 1]
  const delta = bodyWeightDelta(plotted)

  const chartTitle = t('progress.bodyWeight.chartTitle', { unit: unitLabel })
  const save = async (weightKg: number) => {
    await logBodyWeight(weightKg)
    setDialogOpen(false)
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="display text-lg">{t('progress.bodyWeight.title')}</h2>

      <div className="flex flex-col gap-3 border-2 border-border bg-card p-3 shadow-retro">
        {latest && (
          <div className="flex items-end justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="font-mono text-xs uppercase text-muted-foreground">
                {t('progress.bodyWeight.current')}
              </span>
              <span className="display text-2xl">
                {formatWeightValue(latest.value, unit)} {unitLabel}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatSessionDate(latest.at, language)}
              </span>
            </span>
            {delta !== undefined && (
              <span className="flex shrink-0 flex-col text-right">
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  {t('progress.bodyWeight.change')}
                </span>
                {/* Sign only, no colour: gaining can be the goal (bulking). */}
                <span className="display text-xl">
                  {delta < 0 ? '−' : '+'}
                  {formatWeightValue(Math.abs(delta), unit)} {unitLabel}
                </span>
              </span>
            )}
          </div>
        )}

        <SegmentedControl<BodyWeightGrouping>
          ariaLabel={t('progress.bodyWeight.group.label')}
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: 'raw', label: t('progress.bodyWeight.group.raw') },
            { value: 'day', label: t('progress.bodyWeight.group.day') },
            { value: 'week', label: t('progress.bodyWeight.group.week') },
          ]}
        />
      </div>

      {plotted.length > 0 ? (
        <>
          <ProgressChart
            points={plotted}
            baseline="auto"
            formatValue={(kg) => formatWeightValue(kg, unit)}
            formatDate={(ms) => formatSessionDate(ms, language)}
            ariaLabel={t('progress.chartLabel', { title: chartTitle })}
          />
          {grouping !== 'raw' && (
            // An averaged point is not a real weigh-in — say so.
            <p className="text-center font-mono text-xs text-muted-foreground">
              {t(grouping === 'day' ? 'progress.bodyWeight.avg.day' : 'progress.bodyWeight.avg.week')}
            </p>
          )}
        </>
      ) : (
        <p className="text-base text-muted-foreground">
          {points.length === 0 ? t('progress.bodyWeight.empty') : t('progress.noData')}
        </p>
      )}

      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => setDialogOpen(true)}>
          {t('progress.bodyWeight.log')}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setHistoryOpen(true)}>
          {t('progress.bodyWeight.history')}
        </Button>
      </div>

      <BodyWeightDialog
        open={dialogOpen}
        latestKg={latest?.value}
        onSubmit={save}
        onCancel={() => setDialogOpen(false)}
      />
      <BodyWeightHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        points={points}
      />
    </section>
  )
}
