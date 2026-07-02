// No UI — wires the three sync moments from IMPLEMENTATION_PLAN.md Phase 4:
// on sign-in, on foreground while online, and after local writes (debounced).
// Mounted once at the app root (AppLayout), like StarterProgramPrompt/UpdateBanner,
// so it renders for Guest Mode too — the sync modules are only ever reached via
// dynamic import() (never called unless `uid` is set) so Guest Mode still loads
// zero Firestore/Firebase code (§5).
import { useEffect, useRef } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { subscribeToDataChanges } from '@/data/changes'
import { getPreference } from '@/prefs/preferences'

const DEBOUNCE_MS = 4000

async function syncNow(uid: string): Promise<void> {
  if (!navigator.onLine) return
  if (getPreference('lastSyncedAt') === 0) {
    const { mergeOnFirstSignIn } = await import('./signInMerge')
    await mergeOnFirstSignIn(uid)
  } else {
    const { runSync } = await import('./syncEngine')
    await runSync(uid)
  }
}

export function SyncTrigger() {
  const { user } = useAuth()
  const uid = user?.uid
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // On sign-in (uid just became available).
  useEffect(() => {
    if (uid) void syncNow(uid)
  }, [uid])

  // On foreground while online.
  useEffect(() => {
    if (!uid) return
    const onForeground = () => {
      if (document.visibilityState === 'visible') void syncNow(uid)
    }
    document.addEventListener('visibilitychange', onForeground)
    window.addEventListener('online', onForeground)
    return () => {
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('online', onForeground)
    }
  }, [uid])

  // After local writes, debounced.
  useEffect(() => {
    if (!uid) return
    const unsubscribe = subscribeToDataChanges(() => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void syncNow(uid), DEBOUNCE_MS)
    })
    return () => {
      clearTimeout(debounceRef.current)
      unsubscribe()
    }
  }, [uid])

  return null
}
