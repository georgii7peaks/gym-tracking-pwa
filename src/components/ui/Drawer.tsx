// Bottom drawer (RetroUI: retroui.dev/docs/components/drawer) — a neo-brutalist
// sheet that slides up from the bottom with a grab handle, bold border, and hard
// shadow. Used for confirmations like finishing a workout. Closes on Escape or
// backdrop click.
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/i18n/I18nProvider'
import { cn } from '@/lib/cn'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Drawer({ open, onClose, title, children, footer, className }: DrawerProps) {
  const { t } = useI18n()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'animate-drawer relative z-10 flex max-h-[90vh] w-full max-w-md flex-col border-2 border-border bg-card text-card-foreground shadow-retro-lg outline-none',
          className
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border/40" aria-hidden />
        <header className="px-4 pb-3 pt-3">
          <h2 className="display text-lg">{title}</h2>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-2">{children}</div>
        {footer && <footer className="p-4">{footer}</footer>}
        <button className="sr-only" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>,
    document.body
  )
}
