# Gym Tracking — Web / PWA

Offline-first PWA rebuild of the Gym Tracking iOS app. See
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for the phased plan,
[`CONTEXT.md`](CONTEXT.md) for the domain language, and
[`APP_SPECIFICATION.md`](APP_SPECIFICATION.md) for the full behaviour spec.

## Stack

- **React 19 + Vite 6 + TypeScript** (strict)
- **Tailwind CSS v4**, neo-brutalist tokens imported from the `Gym Tracker`
  design reference (claude.ai/design): Light = "Classic RetroUI" (cream + amber),
  Dark = "Neon Night" (near-black + electric lime). Self-hosted fonts (Archivo
  Black / Space Grotesk / Space Mono, with Manrope + JetBrains Mono as
  Cyrillic-capable fallbacks) — bundled for offline, no CDN.
- **React Router v7** — three tabs, each its own stack
- **Dexie / IndexedDB** — the single local source of truth (ADR-0002)
- **Zustand** — UI/session state (wired in Phase 1)
- **vite-plugin-pwa (Workbox)** — installable, precached app shell, offline navigation
- **Vitest + Testing Library** — unit + component tests

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server (service worker enabled)           |
| `npm run build`     | Typecheck + production build (+ PWA assets)   |
| `npm run preview`   | Serve the production build locally            |
| `npm test`          | Run the test suite once                       |
| `npm run test:watch`| Watch mode                                    |
| `npm run lint`      | ESLint                                        |
| `npm run format`    | Prettier write                                |
| `npm run typecheck` | `tsc` project typecheck                       |
| `npm run gen:icons` | Regenerate the branded PWA icons into `public/` |

## Architecture

```
src/
  domain/      Pure TS model + rules (start-session, previous-set, prefill,
               ordering, validation, weight kg↔display, duration) — all unit-tested
  data/        Dexie schema · repository PORT · Dexie impl · operations (the sole
               write path) · composite queries · change bus + useLiveData hook
  prefs/       Local, un-synced preferences (weight unit, theme, language, seed flag)
  i18n/        RU/EN string catalog + runtime-switch provider (default RU)
  theme/       System/Light/Dark provider (class-based dark mode)
  lib/         Haptics · cn() · locale date/time formatting
  components/  Screen, EmptyState, RetroUI primitives (Button, Card, TextField,
               SegmentedControl, Stepper, Modal, ConfirmDialog, PromptDialog, …)
  app/         Router + layout (bottom tab bar) + tab pages and detail screens
  test/        Vitest setup + render helpers
```

The domain depends only on the **repository port** (`src/data/repository.ts`).
The UI reads through `useLiveData` + composite queries and writes through the
**operations** layer, which validates via the domain and broadcasts changes so
reads refresh. Dexie is the sole implementation today; the Phase 4 Firestore
sync adapter will sit beside it, never on the UI path — guest mode loads no
network code.

## Status

### ✅ Done

- **Phase 0 — Scaffolding & foundations.** Installable 3-tab PWA shell, offline
  app shell, data/domain skeleton (Dexie + repository port), i18n (RU/EN, live
  switch) + theme (System/Light/Dark), haptics.
- **Phase 1 — Local core (strength-tracking loop, 100% offline).** Routines
  (days + exercises: add/rename/delete/reorder, inline metric picker), Start a
  Session (snapshot copy), set logging, Previous Set + pre-fill (default **12
  reps**), validation, ordering. Domain rules unit-tested.
- **Per-exercise weight unit (kg / lb).** Chosen on the exercise; stored
  canonically in kg, entered/stepped in the chosen unit; pounds are flagged on
  the workout screen (note + weight-column header). Volume normalizes to kg.
- **Design re-skin from the `Gym Tracker` reference.** Light = "Classic RetroUI",
  Dark = "Neon Night"; self-hosted fonts (Archivo Black / Space Grotesk / Space
  Mono + Cyrillic fallbacks Manrope / JetBrains Mono), neo-brutalist tokens.
- **Inline Workout screen (design).** `/workouts` = history list (add-workout
  button as the last item); `/workouts/:id` = one active session inline: stats
  bar (time / kg volume / sets done), Finish button under the stats, exercise
  cards with inline set steppers + done checkmark, rest timer (auto-starts on
  completing a set), toast. Finish opens a bottom **Drawer** to confirm → back to
  the list. Starting a workout **auto-fills sets from the previous workout of the
  same type**. Bottom tab bar matches the template (active tab = accent block).
- **Phase 2 — Settings, seeding & string parity.** Settings: weight unit
  (kg/lb, display-only conversion), theme and language pickers. Starter
  Program prompt (three programs, Appendix B) gated by the sticky
  `didCompleteInitialSeed` flag; program names written in the current language
  at apply time. Full RU/EN string-catalog audit.
- **Phase 3 — PWA hardening.** Service-worker update banner with an active
  update check on app foreground (not just at registration), install button +
  iOS install hint, maskable icon, precache fix. Deployed to Firebase Hosting.
- **Phase 4 — Google auth + Firestore sync (Account Mode).** Google sign-in
  (`src/auth/`), explicit push/pull delta sync with per-doc LWW and tombstones
  (`src/sync/syncEngine.ts`), smart-union merge on first sign-in
  (`src/sync/signInMerge.ts`), sync status + last-sync row in Settings,
  Firestore rules locked to `users/{uid}/**`. In Account Mode the starter
  prompt waits for the first pull to settle before deciding.
- **Settings — Workout section.** Rest-timer default (M:SS stepper, 15 s
  steps), auto-rest toggle (start the rest timer on checking a set done), and
  a vibration/haptics toggle — all backed by the existing local prefs.
- **Branded icons.** `npm run gen:icons` now renders the design-reference
  RetroUI artwork (cream canvas, amber card with ink border + hard offset
  shadow, double-plate dumbbell; maskable + apple-touch are full-bleed amber
  with the glyph inside the safe zone). Same script, no external deps.
- **Lighthouse pass (2026-07-06, production build via `vite preview`,
  headless Chrome):** Performance **88**, Accessibility **100**, Best
  Practices **100**, SEO 63. The SEO score is the deliberate
  `robots.txt: Disallow /` (personal app, not meant to be indexed). Firebase
  ships as a separate lazy chunk — Guest Mode loads no network code. Manifest
  + SW verified installable (Lighthouse v12 dropped the PWA category).

### 🚫 Descoped (explicitly declined 2026-07-01)

- **Routines tab mockup extras:** the persistent program-template carousel and
  full-screen builder with an exercise library — the one-time Starter Program
  sheet and the PromptDialog → Day Editor flow stay instead.
- **Settings Data section** (export / restore / about rows). Profile card and
  Notifications also remain deferred.
