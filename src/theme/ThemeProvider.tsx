// Theme: System / Light / Dark (APP_SPECIFICATION.md §8), applied app-wide by
// toggling a `dark` class on <html>. `system` follows the OS via matchMedia.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ThemePreference } from '@/prefs/preferences'
import { getPreference, setPreference } from '@/prefs/preferences'

type EffectiveTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: ThemePreference
  /** The resolved light/dark actually applied (after resolving `system`). */
  effectiveTheme: EffectiveTheme
  setTheme: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(DARK_QUERY).matches
}

function resolve(theme: ThemePreference, systemDark: boolean): EffectiveTheme {
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => getPreference('theme'))
  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark())

  // Track the OS scheme so `system` reacts live.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const effectiveTheme = resolve(theme, systemDark)

  // Reflect the effective theme onto <html>.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', effectiveTheme === 'dark')
    document.documentElement.style.colorScheme = effectiveTheme
  }, [effectiveTheme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    setPreference('theme', next)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, effectiveTheme, setTheme }),
    [theme, effectiveTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
