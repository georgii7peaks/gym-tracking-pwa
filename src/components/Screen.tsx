// A titled, scrollable screen shell shared by the tab pages and detail screens.
// Keeps the header pinned while the body scrolls; content is width-capped and
// centred so the mobile-first layout also reads well on wider viewports.
import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { cn } from '@/lib/cn'

interface ScreenProps {
  title: string
  /** When set, a back chevron is shown in the header (detail screens). */
  onBack?: () => void
  /** Optional trailing control(s) in the header (e.g. Edit toggle, + button). */
  headerRight?: ReactNode
  children: ReactNode
  className?: string
}

export function Screen({ title, onBack, headerRight, children, className }: ScreenProps) {
  const { t } = useI18n()
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b-2 border-border bg-background/95 px-4 py-3 backdrop-blur"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('common.back')}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center border-2 border-border bg-card shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold tracking-tight">{title}</h1>
        {headerRight}
      </header>
      <div className={cn('flex flex-1 flex-col p-4', className)}>{children}</div>
    </div>
  )
}
