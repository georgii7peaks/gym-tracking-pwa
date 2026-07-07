// Bottom tab bar (design). Persists across navigation (lives in the layout
// route), so each tab keeps its own stack. The ACTIVE tab is a solid accent
// block — bold border + hard offset shadow — with icon + mono uppercase label;
// inactive tabs are transparent/muted. Labels read from i18n (live language).
import { NavLink } from 'react-router-dom'
import { ChartLine, Dumbbell, Rows2, SlidersHorizontal } from 'lucide-react'
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
  { to: '/routines', labelKey: 'tab.routines', icon: Rows2 },
  { to: '/progress', labelKey: 'tab.progress', icon: ChartLine },
  { to: '/settings', labelKey: 'tab.settings', icon: SlidersHorizontal },
]

export function TabBar() {
  const { t } = useI18n()
  return (
    <nav
      className="border-t-2 border-border bg-card"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <ul className="mx-auto flex max-w-2xl gap-2 px-3.5 pt-2.5">
        {TABS.map(({ to, labelKey, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              onClick={() => haptics.selection()}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-retro)] border-2 py-2.5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  isActive
                    ? 'border-border bg-primary text-primary-foreground shadow-retro-sm'
                    : 'border-transparent text-muted-foreground'
                )
              }
            >
              <Icon aria-hidden className="h-6 w-6" strokeWidth={2.25} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                {t(labelKey)}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
