// Bottom tab bar (APP_SPECIFICATION.md §4). Persists across navigation because
// it lives in the layout route, so each tab keeps its own stack. Labels update
// live when the language changes (they read from i18n).
import { NavLink } from 'react-router-dom'
import { Dumbbell, ClipboardList, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import type { StringKey } from '@/i18n/strings'
import { cn } from '@/lib/cn'
import { haptics } from '@/lib/haptics'

interface TabDef {
  to: string
  labelKey: StringKey
  icon: LucideIcon
}

const TABS: TabDef[] = [
  { to: '/workouts', labelKey: 'tab.workouts', icon: Dumbbell },
  { to: '/routines', labelKey: 'tab.routines', icon: ClipboardList },
  { to: '/settings', labelKey: 'tab.settings', icon: Settings },
]

export function TabBar() {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('tab.workouts')}
      className="border-t-2 border-border bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ to, labelKey, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              onClick={() => haptics.selection()}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-xs font-semibold',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-9 w-14 items-center justify-center rounded-[var(--radius-retro)] border-2',
                      isActive
                        ? 'border-border bg-primary text-primary-foreground shadow-retro-sm'
                        : 'border-transparent'
                    )}
                  >
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={2.25} />
                  </span>
                  {t(labelKey)}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
