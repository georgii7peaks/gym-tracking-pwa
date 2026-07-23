# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project docs

Read these before making non-trivial changes — this file only covers what's needed to navigate and run the code day to day:

- `CONTEXT.md` — canonical domain language (Routine Day vs Workout Session, Start a Session, Previous Set). Terms here are load-bearing; don't rename them casually.
- `APP_SPECIFICATION.md` — full behavior spec (ported from the original iOS app).
- `IMPLEMENTATION_PLAN.md` — phased delivery plan; `README.md` tracks what's done/descoped per phase.
- `docs/adr/` — architecture decisions (0001: guest-first optional Google identity; 0002: IndexedDB as sole store, Firestore as online-only sync target). Read these before touching auth or sync.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (service worker enabled) |
| `npm run build` | `tsc -b` typecheck + production build (+ PWA assets) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the full test suite once (Vitest) |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run gen:icons` | Regenerate branded PWA icons into `public/` (`scripts/gen-icons.mjs`) |

Run a single test file: `npx vitest run src/domain/session.test.ts`. Filter by name: `npx vitest run -t "some test name"`.

Path alias `@/*` → `src/*` (defined in both `vite.config.ts` and `tsconfig.app.json` — keep them in sync if it ever changes).

## Architecture

```
src/
  domain/      Pure TS model + rules (session start, previous-set, prefill,
               ordering, validation, weight kg↔display, duration) — framework-free, unit-tested
  data/        Dexie schema (db.ts) · repository PORT (repository.ts) · Dexie impl
               (dexie-repository.ts) · operations (operations.ts, the sole write path) ·
               composite queries (queries.ts) · change bus (changes.ts) + useLiveData hook
  prefs/       Local, un-synced preferences (weight unit, theme, language, seed flag)
  i18n/        RU/EN string catalog + runtime-switch provider (default RU)
  theme/       System/Light/Dark provider (class-based dark mode)
  auth/        Google sign-in (Account Mode)
  sync/        Explicit push/pull sync engine + sign-in merge (Account Mode only)
  lib/         Haptics · cn() · locale date/time formatting · install prompt
  components/  Screen, EmptyState, RetroUI primitives (ui/) + workout-specific pieces (workout/)
  app/         Router + layout (bottom tab bar) + tab pages and detail screens
  test/        Vitest setup + render helpers
```

### Data flow — the one path to remember

The domain layer depends only on the **repository port** (`src/data/repository.ts`), never on Dexie
or Firestore directly. Concretely:

- **Writes** go through `src/data/operations.ts` — the *only* write path from the UI. Every mutation
  validates via `domain/`, persists via the repository, then calls `notifyDataChanged()`.
- **Reads** go through `useLiveData` (`src/data/useLiveData.ts`), which re-runs the given read on
  mount and again whenever `notifyDataChanged()` fires. There is no other change-notification
  mechanism — if a write doesn't call it, the UI won't refresh.
- **Dexie is the sole implementation today.** The Firestore sync adapter (`src/sync/`) sits beside
  it, not on the UI's read/write path — Guest Mode loads no network code at all.

### Domain model — two aggregates, one bridge

- **Routine** (editable template: Routine Day → Routine Exercise) vs **Workout** (append-only log:
  Workout Session → Exercise Log → Set). These must never be conflated — editing a Routine later never
  changes a past Workout Session, because **Start a Session** copies (snapshots) the Routine Exercises
  into new Exercise Logs at creation time with no link stored back. Use the canonical full names
  ("Routine Day", "Workout Session", etc.) — see `CONTEXT.md` for the full glossary and what to avoid.
- **Previous Set** pre-fill matches by denormalized exercise *name*, not by foreign key — this makes it
  rename-safe and is why `SetEntry.exerciseName` exists.
- Weight is always stored canonically in **kg** on the record; `weightUnit` only controls entry/display
  conversion (`domain/weight.ts`).
- Soft deletes: `remove()` sets a `deleted` tombstone and bumps `updatedAt` instead of hard-deleting, so
  deletions can propagate through sync. `EntityStore.list()`/`get()` filter tombstones automatically —
  the UI never sees them.

### Identity & sync (Guest Mode vs Account Mode)

- **Guest Mode** (default): no account, no network, IndexedDB only.
- **Account Mode**: after Google sign-in (`src/auth/`); adds explicit push/pull delta sync
  (`src/sync/syncEngine.ts`) with per-doc last-write-wins + tombstones, and a one-time smart-union
  merge on first sign-in (`src/sync/signInMerge.ts`).
- **Hard invariant:** the app must be 100% functional offline in both modes — Firestore is never on the
  critical path, only an explicit sync target reached when online and signed in. Don't add code that
  makes a read/write/launch path depend on network or Firestore being reachable.
- Local Firebase config lives at `src/config/firebase.config.ts`, gitignored; copy
  `src/config/firebase.config.example.ts` to create it. It's a client-side web config (safe to expose
  per Firebase's own docs — access control is via Firestore rules, not secrecy), but the repo still
  keeps it out of git by convention.

### PWA gotcha

`vite.config.ts`'s Workbox `navigateFallbackDenylist` excludes `/__/*` — Firebase Hosting's reserved
namespace, used by the Google OAuth redirect (`/__/auth/handler`). If the service worker's navigate
fallback ever covers that path, sign-in breaks silently on any origin where the SW is installed. Don't
narrow or remove that denylist without checking sign-in still works.

## Testing conventions

- Vitest + Testing Library, jsdom environment, `fake-indexeddb` standing in for IndexedDB
  (`src/test/setup.ts`).
- `afterEach` clears all Dexie tables on the shared `db` singleton and clears `localStorage` — tests
  using the operations layer share that singleton, so leaking state between tests means an incomplete
  cleanup, not an isolation bug elsewhere.
- `asyncUtilTimeout` is raised to 4000ms because parallel test files contend for CPU under a full-suite
  run — don't reintroduce the default 1s timeout in new tests.
