// Settings tab (APP_SPECIFICATION.md §5.8).
import { useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAuth } from '@/auth/AuthProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { useTheme } from '@/theme/ThemeProvider'
import { useLiveData } from '@/data/useLiveData'
import { formatRelativeTime } from '@/lib/datetime'
import { getPreference, setPreference } from '@/prefs/preferences'
import type { Language, ThemePreference, WeightUnit } from '@/prefs/preferences'
import { isIOS, isStandalone, promptInstall, useCanInstall } from '@/lib/installPrompt'
import { useSyncStatus } from '@/sync/syncStatus'

export function SettingsPage() {
  const { t, language, setLanguage } = useI18n()
  const { theme, setTheme } = useTheme()
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>(() => getPreference('weightUnit'))
  const canInstall = useCanInstall()
  const showIOSInstallHint = !canInstall && isIOS() && !isStandalone()
  const { user, ready, authError, signInWithGoogle, signOutUser } = useAuth()
  const syncStatus = useSyncStatus()
  const { data: lastSyncedAt } = useLiveData(async () => getPreference('lastSyncedAt'), [])

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

        {(canInstall || showIOSInstallHint) && (
          <section className="flex flex-col gap-2">
            <h2 className="kicker">{t('settings.install')}</h2>
            <Card>
              <CardBody>
                {canInstall ? (
                  <Button className="w-full" onClick={() => promptInstall()}>
                    {t('settings.install.action')}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('settings.install.iosHint')}</p>
                )}
              </CardBody>
            </Card>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="kicker">{t('settings.sync')}</h2>
          <Card>
            <CardBody className="flex flex-col gap-3">
              {ready && user ? (
                <>
                  <div className="flex items-center gap-3">
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt=""
                        className="h-10 w-10 rounded-full border-2 border-border"
                      />
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">
                        {user.displayName ?? user.email}
                      </span>
                      {user.email && user.displayName && (
                        <span className="truncate text-sm text-muted-foreground">
                          {user.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {syncStatus.state === 'syncing' && t('settings.sync.status.syncing')}
                    {syncStatus.state === 'error' && t('settings.sync.status.error')}
                    {syncStatus.state === 'idle' &&
                      (lastSyncedAt
                        ? t('settings.sync.status.idle', {
                            relativeTime: formatRelativeTime(lastSyncedAt, language, Date.now()),
                          })
                        : t('settings.sync.neverSynced'))}
                  </p>
                  <Button variant="secondary" className="w-full" onClick={() => signOutUser()}>
                    {t('settings.sync.signOut')}
                  </Button>
                </>
              ) : (
                <>
                  <Button className="w-full" onClick={() => signInWithGoogle()}>
                    {t('settings.sync.signIn')}
                  </Button>
                  <p className="text-sm text-muted-foreground">{t('settings.sync.footer')}</p>
                </>
              )}
              {authError && <p className="text-sm text-destructive">{authError}</p>}
            </CardBody>
          </Card>
        </section>
      </div>
    </Screen>
  )
}
