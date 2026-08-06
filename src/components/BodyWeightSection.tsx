// Body Weight card on the Progress tab (docs/plans/body-weight-progress.md
// step 7, reworked by docs/plans/body-weight-point-actions.md). Independent of
// the exercise filter and usable before the first workout ever happens. The Y
// axis auto-scales so a 2 kg trend is actually visible, and the weigh-ins can
// be read raw or as daily / weekly averages. A wrong weigh-in is fixed through
// the chart itself: tap a point → act on the entries behind it.
import { useState } from 'react'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import { ProgressChart } from './ProgressChart'
import { BodyWeightDialog } from './BodyWeightDialog'
import { BodyWeightPointDrawer } from './BodyWeightPointDrawer'
import { useI18n } from '@/i18n/I18nProvider'
import { useWeightUnit } from '@/prefs/useWeightUnit'
import { formatWeightValue } from '@/domain/weight'
import { formatSessionDate } from '@/lib/datetime'
import { deleteBodyWeightEntry, logBodyWeight, updateBodyWeightEntry } from '@/data/operations'
import {
  bodyWeightDelta,
  bodyWeightEntriesForPoint,
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
  /** The plotted point whose Drawer is open (a raw entry or a bucket average). */
  const [actionPoint, setActionPoint] = useState<ProgressPoint | null>(null)
  /** The raw entry being edited, stacked on top of the Drawer. */
  const [editing, setEditing] = useState<ProgressPoint | null>(null)

  // Filter by range FIRST, then group — a bucket must never mix in weigh-ins
  // from outside the selected range. The filtered list is kept: resolving a
  // point back to its entries has to run against exactly what was grouped.
  const rangeFiltered = filterByRange(points, range, Date.now())
  const plotted = groupBodyWeightPoints(rangeFiltered, grouping)
  // "Current" is always the latest RAW entry: never averaged, never range-filtered.
  const latest = points[points.length - 1]
  const delta = bodyWeightDelta(plotted)

  const entriesFor = (point: ProgressPoint) =>
    bodyWeightEntriesForPoint(rangeFiltered, point, grouping)
  // Derived from live data every render: once the last entry behind the open
  // point is gone (deleted, or re-dated out of the bucket) the Drawer closes.
  const entries = actionPoint ? entriesFor(actionPoint) : []

  const chartTitle = t('progress.bodyWeight.chartTitle', { unit: unitLabel })
  const save = async (weightKg: number, measuredAt: number) => {
    await logBodyWeight(weightKg, measuredAt)
    setDialogOpen(false)
  }
  const saveEdit = async (weightKg: number, measuredAt: number) => {
    if (editing) await updateBodyWeightEntry(editing.id, { weightKg, measuredAt })
    setEditing(null)
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
            // Always exactly one series, so the chart renders with no legend
            // and no program prefix — identical to before it became multi-series.
            series={[{ label: chartTitle, color: 'var(--primary)', points: plotted }]}
            baseline="auto"
            formatValue={(kg) => formatWeightValue(kg, unit)}
            formatDate={(ms) => formatSessionDate(ms, language)}
            ariaLabel={t('progress.chartLabel', { title: chartTitle })}
            renderPointAction={(point) => (
              <Button variant="secondary" className="w-full" onClick={() => setActionPoint(point)}>
                {t(
                  entriesFor(point).length > 1
                    ? 'progress.bodyWeight.pointActionsMany'
                    : 'progress.bodyWeight.pointActions'
                )}
              </Button>
            )}
          />
          {grouping !== 'raw' && (
            // An averaged point is not a real weigh-in — say so.
            <p className="text-center font-mono text-xs text-muted-foreground">
              {t(
                grouping === 'day' ? 'progress.bodyWeight.avg.day' : 'progress.bodyWeight.avg.week'
              )}
            </p>
          )}
        </>
      ) : (
        <p className="text-base text-muted-foreground">
          {points.length === 0 ? t('progress.bodyWeight.empty') : t('progress.noData')}
        </p>
      )}

      <Button className="w-full" onClick={() => setDialogOpen(true)}>
        {t('progress.bodyWeight.log')}
      </Button>

      <BodyWeightDialog
        open={dialogOpen}
        latestKg={latest?.value}
        onSubmit={save}
        onCancel={() => setDialogOpen(false)}
      />
      <BodyWeightDialog
        open={editing !== null}
        entry={editing ? { weightKg: editing.value, measuredAt: editing.at } : undefined}
        latestKg={latest?.value}
        onSubmit={saveEdit}
        onCancel={() => setEditing(null)}
      />
      <BodyWeightPointDrawer
        open={entries.length > 0}
        onClose={() => setActionPoint(null)}
        entries={entries}
        grouping={grouping}
        onEdit={setEditing}
        onDelete={(id) => void deleteBodyWeightEntry(id)}
      />
    </section>
  )
}
