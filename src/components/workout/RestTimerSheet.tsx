// Rest-timer overlay (design): shown while a rest countdown is active. Pinned
// above the tab bar; ±15s and skip controls. State lives in the WorkoutScreen.
import { useI18n } from '@/i18n/I18nProvider'
import { formatDuration } from '@/domain/duration'

interface RestTimerSheetProps {
  remaining: number
  total: number
  onSkip: () => void
  onAdd: (delta: number) => void
}

export function RestTimerSheet({ remaining, total, onSkip, onAdd }: RestTimerSheetProps) {
  const { t } = useI18n()
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0
  return (
    <div className="fixed inset-x-3 bottom-24 z-30 border-2 border-border bg-card p-4 shadow-retro-lg">
      <div className="flex items-center justify-between">
        <span className="kicker">{t('rest.title')}</span>
        <button
          type="button"
          onClick={onSkip}
          className="border-2 border-border bg-transparent px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('rest.skip')}
        </button>
      </div>
      <div className="my-3 text-center font-mono text-5xl font-bold tabular-nums">
        {formatDuration(remaining)}
      </div>
      <div className="h-3.5 overflow-hidden border-2 border-border bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={() => onAdd(-15)}
          className="flex-1 border-2 border-border bg-muted py-2.5 font-mono text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          − 15s
        </button>
        <button
          type="button"
          onClick={() => onAdd(15)}
          className="flex-1 border-2 border-border bg-muted py-2.5 font-mono text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + 15s
        </button>
      </div>
    </div>
  )
}
