# Gym Tracking — Web / PWA

Offline-first PWA rebuild of the Gym Tracking iOS app. See
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for the phased plan,
[`CONTEXT.md`](CONTEXT.md) for the domain language, and
[`APP_SPECIFICATION.md`](APP_SPECIFICATION.md) for the full behaviour spec.

## Stack

- **React 19 + Vite 6 + TypeScript** (strict)
- **Tailwind CSS v4** with a RetroUI-flavoured token set (bold borders, hard offset shadow)
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

## Phase status

- **Phase 0 — Scaffolding & foundations — ✅ done.** Installable 3-tab shell,
  offline-capable app shell, data/domain skeleton, i18n + theme wired, haptics.
- **Phase 1 — Local core — ✅ done.** The full strength-tracking loop, 100%
  offline: Routines (days + exercises, add/rename/delete/reorder, inline metric
  picker), Start a Session (snapshot copy), Session detail (editable date,
  exercise rows, one-off add, confirmed delete), Exercise tracking
  (metric-adaptive inputs, Previous Set, pre-fill, set list + reorder/delete).
  Domain rules unit-tested; a UI test drives the loop end-to-end.
- Phases 2–4: see `IMPLEMENTATION_PLAN.md`.

### Note on icons

`public/*.png` are generated placeholders (a RetroUI-yellow dumbbell tile) so
the app is installable now. Branded/maskable artwork is a Phase 3 task.
