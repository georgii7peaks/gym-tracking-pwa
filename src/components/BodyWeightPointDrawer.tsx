// The entries behind a tapped chart point (docs/plans/body-weight-point-actions.md
// step 6) — how a wrong weigh-in gets fixed now that there is no History list.
// Always RAW entries, newest first: editing and deleting need real entry ids,
// and an averaged bucket has none.
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Drawer } from './ui/Drawer'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useI18n } from '@/i18n/I18nProvider'
import { useWeightUnit } from '@/prefs/useWeightUnit'
import { formatWeightValue } from '@/domain/weight'
import { formatSessionDate } from '@/lib/datetime'
import type { BodyWeightGrouping, ProgressPoint } from '@/domain/progress'

interface BodyWeightPointDrawerProps {
  open: boolean
  onClose: () => void
  /** Raw entries behind the selected point, newest first. */
  entries: ProgressPoint[]
  /** Drives the title: one weigh-in in 'raw', a whole day / week bucket otherwise. */
  grouping: BodyWeightGrouping
  onEdit: (entry: ProgressPoint) => void
  onDelete: (id: string) => void
}

const TITLE_KEY = {
  raw: 'progress.bodyWeight.pointTitle',
  day: 'progress.bodyWeight.pointTitleDay',
  week: 'progress.bodyWeight.pointTitleWeek',
} as const

const ICON_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center border-2 border-border shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function BodyWeightPointDrawer({
  open,
  onClose,
  entries,
  grouping,
  onEdit,
  onDelete,
}: BodyWeightPointDrawerProps) {
  const { t, language } = useI18n()
  const { unit, unitLabel } = useWeightUnit()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const confirmDelete = () => {
    if (pendingId) onDelete(pendingId)
    setPendingId(null)
  }

  return (
    <>
      <Drawer open={open} onClose={onClose} title={t(TITLE_KEY[grouping])}>
        <ul className="flex flex-col gap-2 pb-2">
          {entries.map((entry) => {
            const weight = `${formatWeightValue(entry.value, unit)} ${unitLabel}`
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 border-2 border-border bg-background p-3"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="display text-base">{weight}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatSessionDate(entry.at, language)}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`${t('common.edit')}: ${weight}`}
                  onClick={() => onEdit(entry)}
                  className={`${ICON_BUTTON} bg-card text-card-foreground`}
                >
                  <Pencil aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  aria-label={`${t('common.delete')}: ${weight}`}
                  onClick={() => setPendingId(entry.id)}
                  className={`${ICON_BUTTON} bg-destructive text-destructive-foreground`}
                >
                  <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </li>
            )
          })}
        </ul>
      </Drawer>

      <ConfirmDialog
        open={pendingId !== null}
        title={t('progress.bodyWeight.delete.title')}
        message={t('progress.bodyWeight.delete.message')}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingId(null)}
      />
    </>
  )
}
