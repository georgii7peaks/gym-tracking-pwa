// Runtime language switching without reload (APP_SPECIFICATION.md §9): an
// in-memory locale in React state re-renders the whole tree on change.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Language } from '@/prefs/preferences'
import { getPreference, setPreference } from '@/prefs/preferences'
import { translate, type StringKey } from './strings'

type Translate = (key: StringKey, params?: Record<string, string | number>) => string

interface I18nContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translate
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getPreference('language'))

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    setPreference('language', lang)
    if (typeof document !== 'undefined') document.documentElement.lang = lang
  }, [])

  const t = useCallback<Translate>((key, params) => translate(language, key, params), [language])

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}
