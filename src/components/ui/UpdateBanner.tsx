// Service-worker update banner (Phase 3 — PWA hardening). Mounted once at the
// app root. `registerType: 'prompt'` (vite.config.ts) means a waiting SW never
// takes over on its own — onNeedRefresh fires instead, and this banner is the
// only way updateServiceWorker() gets called.
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './Button'
import { useI18n } from '@/i18n/I18nProvider'

export function UpdateBanner() {
  const { t } = useI18n()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-24 z-30 flex items-center justify-between gap-3 border-2 border-border bg-card p-3 shadow-retro-lg"
    >
      <span className="text-sm font-semibold">{t('update.available')}</span>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        {t('update.reload')}
      </Button>
    </div>
  )
}
