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
| `npm run gen:icons` | Regenerate placeholder PWA icons into `public/` |

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

### ⏳ Not done yet

- **Routines tab (mockup layout):** program templates (Push/Pull/Leg…) +
  "my routines" + builder with an exercise-library.
- **Settings tab (mockup layout):** grouped cards, global kg/lb default,
  rest-timer default, sound / auto-rest toggles, data rows. (Profile card,
  Sign out and Notifications are deferred — no auth in guest mode.)
- **Phase 2 — Starter-program seeding** (Appendix B) + first-launch prompt.
- **Phase 3 — PWA hardening:** branded/maskable icons, service-worker update
  toast, Lighthouse pass.
- **Phase 4 — Google auth + Firestore sync** (Account Mode) — see
  `IMPLEMENTATION_PLAN.md`; the user already has a Firebase project.

### Note on icons

`public/*.png` are generated placeholders (a RetroUI-yellow dumbbell tile) so
the app is installable now. Branded/maskable artwork is a Phase 3 task.
