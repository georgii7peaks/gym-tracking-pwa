// Per-row edit affordances shown in a list's edit mode: move up/down (reorder,
// §3.3) and delete (trash). Reorder uses buttons rather than drag-and-drop for
// reliable touch + keyboard behaviour on the web.
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { haptics } from '@/lib/haptics'

interface RowEditControlsProps {
  index: number
  count: number
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  deleteLabel: string
}

const BTN =
  'flex h-9 w-9 items-center justify-center border-2 border-border bg-card shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function RowEditControls({
  index,
  count,
  onMoveUp,
  onMoveDown,
  onDelete,
  deleteLabel,
}: RowEditControlsProps) {
  const { t } = useI18n()
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label={t('edit.moveUp')}
        disabled={index === 0}
        onClick={() => {
          haptics.selection()
          onMoveUp()
        }}
        className={BTN}
      >
        <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label={t('edit.moveDown')}
        disabled={index === count - 1}
        onClick={() => {
          haptics.selection()
          onMoveDown()
        }}
        className={BTN}
      >
        <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label={deleteLabel}
        onClick={onDelete}
        className="flex h-9 w-9 items-center justify-center border-2 border-border bg-destructive text-destructive-foreground shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  )
}
