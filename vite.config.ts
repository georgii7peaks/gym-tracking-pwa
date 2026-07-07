import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a waiting SW does NOT take over silently — the app decides
      // when, via useRegisterSW()'s onNeedRefresh + updateServiceWorker()
      // (see UpdateBanner.tsx), so users see a "new version, reload" toast
      // instead of an unannounced reload/state loss mid-session.
      registerType: 'prompt',
      injectRegister: 'auto',
      // The whole app shell is precached so it launches with zero network
      // (ADR-0002: 100% functional offline after first load).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: 'index.html',
        // Firebase Hosting's reserved namespace must reach the network: the
        // OAuth redirect returns via /__/auth/handler, and serving the app
        // shell there instead kills sign-in on any origin where this SW is
        // installed.
        navigateFallbackDenylist: [/^\/__\//],
        cleanupOutdatedCaches: true,
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gym Tracking',
        short_name: 'Gym',
        description: 'Track your strength-training workouts. Works fully offline.',
        lang: 'ru',
        theme_color: '#ffc53d',
        background_color: '#fbf7ec',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        // Enable the service worker in `vite dev` so offline can be verified early.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
