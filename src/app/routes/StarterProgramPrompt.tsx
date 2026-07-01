// Starter Program prompt (APP_SPECIFICATION.md §5.9, §10): offered once, when
// Routines is empty and the seeding decision hasn't been made yet. Mounted once
// at the app root (AppLayout) so the check runs on launch regardless of tab.
// Guest Mode never has cloud sync, so — per §10 — the check runs immediately
// rather than waiting for a first import to settle.
import { useEffect, useState } from 'react'
import { ChevronRight, Dumbbell, Flame, Zap, type LucideIcon } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/i18n/I18nProvider'
import { STARTER_PROGRAMS, type StarterProgram, type StarterProgramIcon } from '@/domain/starterPrograms'
import { applyStarterProgram } from '@/data/operations'
import { repository as repo } from '@/data/dexie-repository'
import { getPreference, setPreference } from '@/prefs/preferences'
import { haptics } from '@/lib/haptics'

const ICONS: Record<StarterProgramIcon, LucideIcon> = {
  flame: Flame,
  dumbbell: Dumbbell,
  bolt: Zap,
}

export function StarterProgramPrompt() {
  const { t, language } = useI18n()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    if (getPreference('didCompleteInitialSeed')) return
    repo.routineDays.list().then((days) => {
      if (!active) return
      if (days.length > 0) {
        // Data already exists — record the decision silently, no prompt (§10).
        setPreference('didCompleteInitialSeed', true)
        return
      }
      setOpen(true)
    })
    return () => {
      active = false
    }
  }, [])

  const decide = () => {
    setPreference('didCompleteInitialSeed', true)
    setOpen(false)
  }

  const choose = async (program: StarterProgram) => {
    haptics.success()
    await applyStarterProgram(program, language)
    decide()
  }

  return (
    <Drawer
      open={open}
      onClose={decide}
      title={t('starterPrompt.title')}
      footer={
        <Button variant="secondary" className="w-full" onClick={decide}>
          {t('starterPrompt.skip')}
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">{t('starterPrompt.body')}</p>
      <ul className="flex flex-col gap-3">
        {STARTER_PROGRAMS.map((program) => {
          const Icon = ICONS[program.icon]
          return (
            <li key={program.id}>
              <button
                type="button"
                onClick={() => choose(program)}
                className="flex w-full items-center gap-3 border-2 border-border bg-background p-3 text-left shadow-retro-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-border bg-primary text-primary-foreground">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="display text-base">{program.title[language]}</span>
                  <span className="text-sm text-muted-foreground">{program.subtitle[language]}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {t('starterPrompt.daysCount', { n: program.days.length })}
                  </span>
                </span>
                <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          )
        })}
      </ul>
    </Drawer>
  )
}
