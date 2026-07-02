// Service-worker update banner (Phase 3 — PWA hardening). Mounted once at the
// app root. `registerType: 'prompt'` (vite.config.ts) means a waiting SW never
// takes over on its own — onNeedRefresh fires instead, and this banner is the
// only way updateServiceWorker() gets called.
//
// vite-plugin-pwa only checks for a new sw.js once, at registration time — the
// browser's own periodic re-check can be many hours away, and on a phone the
// PWA is usually just backgrounded/foregrounded rather than fully reloaded, so
// that check may never happen at all. registration.update() is called here on
// every foreground and on an interval so a deployed update is actually noticed.
import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './Button'
import { useI18n } from '@/i18n/I18nProvider'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export function UpdateBanner() {
  const { t } = useI18n()
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration
    },
  })

  useEffect(() => {
    const checkForUpdate = () => void registrationRef.current?.update()
    const onForeground = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }
    document.addEventListener('visibilitychange', onForeground)
    window.addEventListener('online', checkForUpdate)
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('online', checkForUpdate)
      clearInterval(interval)
    }
  }, [])

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
