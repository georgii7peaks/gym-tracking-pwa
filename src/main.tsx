import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (offline-first, ADR-0002 — no CDN). The design's Latin fonts
// (Archivo Black display, Space Grotesk body, Space Mono numerals) lack Cyrillic,
// so Cyrillic-matching fallbacks (Manrope, JetBrains Mono) are layered in the
// font stacks for the RU-default UI. See index.css @theme font tokens.
import '@fontsource/archivo-black/400.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
// Eagerly attach the beforeinstallprompt listener before first paint — Chrome
// can fire it as soon as installability criteria are met (see installPrompt.ts).
import './lib/installPrompt'
import { App } from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
