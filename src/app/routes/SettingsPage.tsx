// Settings tab. Phase 0 wires the language + theme contexts end-to-end (proving
// the runtime switch works); weight units and the sync section land in later
// phases (APP_SPECIFICATION.md §5.8).
import { Screen } from '@/components/Screen'
import { Card, CardBody } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useI18n } from '@/i18n/I18nProvider'
import { useTheme } from '@/theme/ThemeProvider'
import type { Language, ThemePreference } from '@/prefs/preferences'

export function SettingsPage() {
  const { t, language, setLanguage } = useI18n()
  const { theme, setTheme } = useTheme()

  return (
    <Screen title={t('settings.title')}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t('settings.language')}
          </h2>
          <Card>
            <CardBody>
              <SegmentedControl<Language>
                ariaLabel={t('settings.language')}
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'ru', label: 'Русский' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </CardBody>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t('settings.appearance')}
          </h2>
          <Card>
            <CardBody>
              <SegmentedControl<ThemePreference>
                ariaLabel={t('settings.theme')}
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'system', label: t('theme.system') },
                  { value: 'light', label: t('theme.light') },
                  { value: 'dark', label: t('theme.dark') },
                ]}
              />
            </CardBody>
          </Card>
        </section>

        <p className="text-sm text-muted-foreground">{t('settings.morePhase2')}</p>
      </div>
    </Screen>
  )
}
