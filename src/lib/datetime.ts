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

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

/** "3 minutes ago" / "3 минуты назад" — used for the sync status row (§5.8). */
export function formatRelativeTime(ms: number, lang: Language, nowMs: number): string {
  const diffSec = Math.round((ms - nowMs) / 1000)
  const rtf = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' })
  if (Math.abs(diffSec) < 60) return rtf.format(0, 'second')
  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(diffSec) >= secondsInUnit) {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit)
    }
  }
  return rtf.format(Math.round(diffSec / 60), 'minute')
}
