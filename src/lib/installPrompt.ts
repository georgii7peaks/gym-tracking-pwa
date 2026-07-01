// Install-affordance plumbing (Phase 3 — PWA hardening). Chrome/Edge/Android
// fire `beforeinstallprompt` as soon as installability criteria are met —
// possibly before any component mounts — so the listener is attached once at
// module load (imported eagerly from main.tsx) and the captured event is read
// via a tiny external store. iOS Safari never fires this event; there is no
// programmatic install API there, only the manual Share -> Add to Home Screen
// flow, which SettingsPage links to via isIOS()/isStandalone() instead.
import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredEvent = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredEvent = null
    notify()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True once Chrome/Edge/Android has offered an installable-app prompt to capture. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferredEvent !== null)
}

/** Shows the captured native install prompt; no-op if none is available. */
export async function promptInstall(): Promise<void> {
  if (!deferredEvent) return
  const event = deferredEvent
  deferredEvent = null
  notify()
  await event.prompt()
  await event.userChoice
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIPhoneOrIPad = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ reports as "MacIntel" but, unlike a real Mac, exposes touch points.
  const isIPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isIPhoneOrIPad || isIPadOS13Plus
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as { standalone?: boolean }).standalone
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true
}
