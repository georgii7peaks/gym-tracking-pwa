// Locale-aware date/time formatting (APP_SPECIFICATION.md §5.1, §12) plus
// helpers to bridge an epoch-ms value and an <input type="datetime-local">.
import type { Language } from '@/prefs/preferences'

const LOCALES: Record<Language, string> = { ru: 'ru-RU', en: 'en-US' }

/** Weekday, month, day, hour, minute — localized (Workouts list / session). */
export function formatSessionDate(ms: number, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Epoch ms -> "YYYY-MM-DDTHH:mm" in local time for a datetime-local input. */
export function toDateTimeLocalValue(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse a datetime-local input value back to epoch ms (local time). */
export function fromDateTimeLocalValue(value: string): number | null {
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}
