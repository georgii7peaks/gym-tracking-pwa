// Vitest global setup.
import '@testing-library/jest-dom/vitest'
// Provide an in-memory IndexedDB for the data layer under jsdom.
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { db } from '@/data/db'

// Parallel test files contend for CPU (jsdom + fake-indexeddb), so the default
// 1s findBy*/waitFor timeout is flaky under a full-suite run.
configure({ asyncUtilTimeout: 4000 })

afterEach(async () => {
  cleanup()
  // Keep preference-driven state (language/theme) isolated between tests.
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
  document.documentElement.classList.remove('dark')
  // Reset the shared Dexie singleton so tests using the operations layer (which
  // binds to it) don't leak data into one another.
  try {
    await Promise.all(db.tables.map((table) => table.clear()))
  } catch {
    /* ignore */
  }
})

// jsdom has no matchMedia; stub a light-scheme default so ThemeProvider runs.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
