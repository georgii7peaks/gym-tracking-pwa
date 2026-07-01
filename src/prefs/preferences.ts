// Local, un-synced UI preferences + sticky flags (APP_SPECIFICATION.md §11.1,
// Appendix C). These intentionally live in localStorage and never sync.

export type WeightUnit = 'kg' | 'lb'
export type ThemePreference = 'system' | 'light' | 'dark'
export type Language = 'ru' | 'en'

export interface Preferences {
  weightUnit: WeightUnit
  theme: ThemePreference
  language: Language
  /** Sticky: the starter-program decision has been made (§10). */
  didCompleteInitialSeed: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  weightUnit: 'kg',
  theme: 'system',
  language: 'ru',
  didCompleteInitialSeed: false,
}

// Storage keys mirror the iOS build (Appendix C) where meaningful.
const KEYS: Record<keyof Preferences, string> = {
  weightUnit: 'weightUnit',
  theme: 'appearancePreference',
  language: 'appLanguage',
  didCompleteInitialSeed: 'didCompleteInitialSeed',
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null // private-mode / SSR safety
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore quota / unavailable storage */
  }
}

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  const raw = safeGet(KEYS[key])
  if (raw === null) return DEFAULT_PREFERENCES[key]
  if (key === 'didCompleteInitialSeed') return (raw === 'true') as Preferences[K]
  return raw as Preferences[K]
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  safeSet(KEYS[key], String(value))
}

export function getAllPreferences(): Preferences {
  return {
    weightUnit: getPreference('weightUnit'),
    theme: getPreference('theme'),
    language: getPreference('language'),
    didCompleteInitialSeed: getPreference('didCompleteInitialSeed'),
  }
}
