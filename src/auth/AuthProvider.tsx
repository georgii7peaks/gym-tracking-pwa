// Google sign-in (Phase 4, ADR-0001: guest-first, optional Google identity).
// Firebase is loaded lazily via dynamic import() — a device that has never
// touched sign-in (`didUseGoogleSignIn` false) never downloads it, so pure
// Guest Mode stays 100% offline-capable with zero network code (§5).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { getPreference, setPreference } from '@/prefs/preferences'

export interface AuthUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  /** False only for the brief window while a returning Account-mode session restores. */
  ready: boolean
  /** Set if a sign-in redirect came back with an error (e.g. account conflict). */
  authError: string | null
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(!getPreference('didUseGoogleSignIn'))
  const [authError, setAuthError] = useState<string | null>(null)

  // Guest Mode (never signed in on this device): skip Firebase entirely.
  useEffect(() => {
    if (!getPreference('didUseGoogleSignIn')) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    import('@/lib/firebase').then((fb) => {
      if (cancelled) return
      fb.getRedirectResult(fb.auth).catch((error: unknown) => {
        if (!cancelled) setAuthError(error instanceof Error ? error.message : String(error))
      })
      unsubscribe = fb.onAuthStateChanged(fb.auth, (fbUser) => {
        setUser(fbUser ? toAuthUser(fbUser) : null)
        setReady(true)
      })
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null)
    setPreference('didUseGoogleSignIn', true)
    const fb = await import('@/lib/firebase')
    await fb.signInWithRedirect(fb.auth, fb.googleProvider)
  }, [])

  const signOutUser = useCallback(async () => {
    const fb = await import('@/lib/firebase')
    await fb.signOut(fb.auth)
    setPreference('didUseGoogleSignIn', false)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, authError, signInWithGoogle, signOutUser }),
    [user, ready, authError, signInWithGoogle, signOutUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
