/* eslint-disable react-refresh/only-export-components -- test-only helper, fast refresh N/A */
// Test helper: mount the real route tree under the app providers. Tests use the
// classic <MemoryRouter> + useRoutes API (rather than the data router used in
// production) so navigation goes through history — the data router builds
// fetch Requests whose AbortSignal trips undici under jsdom.
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { I18nProvider } from '@/i18n/I18nProvider'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { routes } from '@/app/router'

function RoutedApp() {
  return useRoutes(routes)
}

export function renderApp(initialPath = '/workouts') {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <RoutedApp />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

/** Render an arbitrary element wrapped only in the app providers. */
export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>{ui}</AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
