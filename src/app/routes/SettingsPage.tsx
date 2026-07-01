// Settings tab (APP_SPECIFICATION.md §5.8). The sync section lands in Phase 4
// alongside Google auth.
import { useState } from 'react'
import { Screen } from '@/components/Screen'
import { Card, CardBody } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useI18n } from '@/i18n/I18nProvider'
import { useTheme } from '@/theme/ThemeProvider'
import { getPreference, setPreference } from '@/prefs/preferences'
import type { Language, ThemePreference, WeightUnit } from '@/prefs/preferences'

export function SettingsPage() {
  const { t, language, setLanguage } = useI18n()
  const { theme, setTheme } = useTheme()
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>(() => getPreference('weightUnit'))

  const setWeightUnit = (unit: WeightUnit) => {
    setWeightUnitState(unit)
    setPreference('weightUnit', unit)
  }

  return (
    <Screen title={t('settings.title')}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t('settings.weight')}</h2>
          <Card>
            <CardBody className="flex flex-col gap-3">
              <SegmentedControl<WeightUnit>
                ariaLabel={t('weightUnit.label')}
                value={weightUnit}
                onChange={setWeightUnit}
                options={[
                  { value: 'kg', label: t('unit.kg') },
                  { value: 'lb', label: t('unit.lb') },
                ]}
              />
              <p className="text-sm text-muted-foreground">{t('settings.weightUnit.footer')}</p>
            </CardBody>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t('settings.language')}</h2>
          <Card>
            <CardBody>
              <SegmentedControl<Language>
                ariaLabel={t('settings.languagePicker')}
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'ru', label: t('language.ru') },
                  { value: 'en', label: t('language.en') },
                ]}
              />
            </CardBody>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t('settings.appearance')}</h2>
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
