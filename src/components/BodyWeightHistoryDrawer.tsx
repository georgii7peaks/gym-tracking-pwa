// Body Weight history (docs/plans/body-weight-progress.md step 7) — how a wrong
// weigh-in gets fixed. Always lists RAW entries newest-first, whatever grouping
// the card is showing: deleting needs real entry ids, and an averaged bucket has
// none.
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Drawer } from './ui/Drawer'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useI18n } from '@/i18n/I18nProvider'
import { useWeightUnit } from '@/prefs/useWeightUnit'
import { formatWeightValue } from '@/domain/weight'
import { formatSessionDate } from '@/lib/datetime'
import { deleteBodyWeightEntry } from '@/data/operations'
import type { ProgressPoint } from '@/domain/progress'

interface BodyWeightHistoryDrawerProps {
  open: boolean
  onClose: () => void
  /** Raw entry points, oldest-first (the drawer reverses them for display). */
  points: ProgressPoint[]
}

export function BodyWeightHistoryDrawer({ open, onClose, points }: BodyWeightHistoryDrawerProps) {
  const { t, language } = useI18n()
  const { unit, unitLabel } = useWeightUnit()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const newestFirst = [...points].reverse()

  const confirmDelete = async () => {
    if (pendingId) await deleteBodyWeightEntry(pendingId)
    setPendingId(null)
  }

  return (
    <>
      <Drawer open={open} onClose={onClose} title={t('progress.bodyWeight.historyTitle')}>
        {newestFirst.length === 0 ? (
          <p className="pb-2 text-base text-muted-foreground">
            {t('progress.bodyWeight.historyEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 pb-2">
            {newestFirst.map((point) => (
              <li
                key={point.id}
                className="flex items-center gap-3 border-2 border-border bg-background p-3"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="display text-base">
                    {formatWeightValue(point.value, unit)} {unitLabel}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatSessionDate(point.at, language)}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`${t('common.delete')}: ${formatWeightValue(point.value, unit)} ${unitLabel}`}
                  onClick={() => setPendingId(point.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-border bg-destructive text-destructive-foreground shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
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
