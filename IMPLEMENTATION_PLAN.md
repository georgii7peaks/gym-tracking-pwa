# Gym Tracking — Web/PWA Implementation Plan

> Rebuild of the iOS Gym Tracking app (`APP_SPECIFICATION.md`) as an installable, offline-first **PWA**,
> replacing implicit iCloud identity with **optional Google sign-in**. Domain language and decisions:
> `CONTEXT.md` and `docs/adr/`.

## 1. Decisions locked in (from the grilling session)

| # | Decision | Source |
|---|---|---|
| 1 | **Guest-first identity**, optional **Google** sign-in enables cloud sync (no forced sign-up) | [ADR-0001](docs/adr/0001-guest-first-optional-google-identity.md) |
| 2 | **Local-first**: Dexie/IndexedDB is the sole working store; app is 100% offline-capable after first load | [ADR-0002](docs/adr/0002-local-first-indexeddb-firestore-online-sync.md) |
| 3 | **Firebase** (Auth + Firestore + Hosting); Firestore is **online-only explicit push/pull** sync, offline cache disabled | ADR-0002 |
| 4 | **LWW per-document** conflict resolution; **smart-union** sign-in merge | ADR-0002 |
| 5 | **React + Vite + TypeScript**; PWA via `vite-plugin-pwa`; **Zustand** state; **React Router** | grilling |
| 6 | **RetroUI** component kit on **Tailwind CSS**; Radix primitives where a11y needs it | grilling |
| 7 | **§13 fixes adopted:** canonical weight in **kg** (convert at display); explicit **`order`** on Set | grilling |
| 8 | **§13 optional changes NOT adopted:** workout name stays fixed after start; empty sessions persist | grilling |
| 9 | Full **feature parity**, delivered as **vertical-slice phases** | grilling |
| 10 | RU/EN runtime switch (default RU); System/Light/Dark theme; `navigator.vibrate` haptics (no-op where unsupported); mobile-first responsive; Vitest + Testing Library | grilling |

## 2. Architecture overview

```
            ┌──────────────────────────── React UI (RetroUI + Tailwind) ────────────────────────────┐
            │  Workouts tab     Routines tab     Settings tab        (React Router stacks)            │
            └───────────────┬───────────────────────────────────────────────┬───────────────────────┘
                            │ Zustand stores (session UI, prefs)             │ i18n + theme contexts
            ┌───────────────▼───────────────────────────────────────────────▼───────────────────────┐
            │                         Domain layer (pure TS, framework-free)                          │
            │   startSession() · previousSet() · prefill defaults · validation · weight conversion    │
            │   ordering · sign-in merge (smart union)                                                │
            └───────────────────────────────┬─────────────────────────────────────────────────────────┘
                                             │ Repository PORT (interface)
                       ┌─────────────────────▼─────────────────────┐
                       │      Dexie repository (IndexedDB)          │  ◄── SINGLE source of truth, always offline
                       └─────────────────────┬─────────────────────┘
                                             │ (Account Mode only, online only)
                       ┌─────────────────────▼─────────────────────┐
                       │   Sync adapter: explicit push/pull (LWW)   │ ──► Firebase Auth + Firestore
                       └────────────────────────────────────────────┘
```

**Key rule:** the domain depends only on the repository port. Dexie is always present; the Firestore
sync adapter is optional and online-only. Guest Mode never loads network code.

## 3. Domain model (TypeScript, local schema)

All ids are UUIDs. Every record carries `updatedAt: number` (ms) and `deleted?: boolean` (tombstone)
for sync. Weight is canonical **kg**.

```ts
type Metric = 'weightReps' | 'duration';

interface RoutineDay      { id; name: string; order: number; updatedAt; deleted? }
interface RoutineExercise { id; dayId; name: string; order: number; metric: Metric; updatedAt; deleted? }

interface WorkoutSession  { id; name: string; startedAt: number; updatedAt; deleted? }
interface ExerciseLog     { id; sessionId; name: string; order: number; metric: Metric; updatedAt; deleted? }
interface SetEntry {
  id; exerciseLogId;
  weightKg: number;      // canonical kg (§13 fix); display converts to kg/lb
  reps: number;
  durationSec: number;
  order: number;         // explicit order (§13 fix), replaces timestamp-swap reorder
  exerciseName: string;  // denormalised → powers Previous Set without joins
  createdAt: number;     // kept for Previous Set comparison & record-keeping
  updatedAt; deleted?
}
```

Dexie tables mirror these 1:1. Preferences (weight unit, theme, language) and the seed-decision flag
live in a separate local key-value store (`localStorage`/Dexie meta table) and are **not synced**.

### Domain rules to port verbatim (with tests)

- **Start a Session** (§6.1): copy day name + ordered exercises (name, metric) into a new session; no
  link stored; persist immediately; navigate in.
- **Previous Set** (§6.2): most recent `SetEntry` where `exerciseName == log.name` and
  `createdAt < currentSession.startedAt`, ordered by `createdAt` desc, take 1. Rename-safe; excludes
  current-session sets.
- **Pre-fill defaults** (§6.3): last set in this log → else Previous Set → else cold defaults
  (weight 0, reps 8, 0:30).
- **Validation** (§3.4): trim names, reject blank; reject duration ≤ 0; allow weight 0; reps ≥ 1.
- **Ordering** (§3.3): contiguous `0..n-1` after reorder; new items append at max+1. (Sets now use the
  explicit `order` field — no timestamp swapping.)
- **Weight** (§7 + §13 fix): store kg; convert to display unit at render/edit; steps/maxes per unit
  (kg: 2.5/500, lb: 5/1100); whole vs one-decimal formatting. **No bulk DB conversion on unit change.**

## 4. Phases (vertical slices)

Each phase is independently runnable and testable. Acceptance criteria reference `APP_SPECIFICATION.md` §14.

### Phase 0 — Scaffolding & foundations
**Goal:** an installable 3-tab shell that works offline, with the data/domain skeleton in place.
- Vite + React + TS project; ESLint/Prettier; Vitest + Testing Library setup.
- Tailwind + RetroUI configured; base theme tokens; mobile-first layout with bottom tab bar.
- `vite-plugin-pwa`: manifest (name, icons, `display: standalone`, theme color), Workbox precache of
  the app shell, basic offline fallback.
- React Router: three tabs (Workouts / Routines / Settings), each its own stack.
- Dexie schema + migrations; domain TS types; **repository port** interface + Dexie implementation.
- i18n context (RU/EN, default RU, runtime switch) and theme context (System/Light/Dark) — wired but
  strings filled in Phase 2.
- Haptics wrapper (`navigator.vibrate`, no-op fallback).
**Acceptance:** app installs, loads offline (airplane mode) showing empty tabs; `npm test` runs.

### Phase 1 — Local core (the tracer bullet through the domain)
**Goal:** the full strength-tracking loop, 100% local/offline. This delivers the core value.
- **Routines:** list days, add/rename/delete/reorder days; Day editor with inline exercise
  name + metric segmented picker; add/delete/reorder exercises (§5.6, §5.7).
- **Workouts:** list (newest first, summary line), delete with confirm + warning haptic (§5.1);
  **Start Workout sheet** → **Start a Session** → navigate into Session detail (§5.2, §6.1).
- **Session detail:** editable `startedAt`, exercise rows with status line + checkmark, swipe-delete
  exercise, add one-off exercise sheet, delete-workout with confirm (§5.3, §5.4).
- **Exercise tracking:** metric-adaptive inputs (weight stepper/reps vs minutes/seconds), Previous Set
  reference, pre-fill defaults, add set (success haptic), set list with delete/reorder, all on Dexie
  (§5.5, §6.2–§6.4).
- Domain unit tests: Start a Session, Previous Set (all properties), pre-fill, validation, ordering.
**Acceptance:** §14 items on aggregates, snapshot independence, Previous Set, pre-fill, metric,
ordering, validation — all pass, fully offline.

### Phase 2 — Settings, seeding & string/UX parity
**Goal:** feature parity for preferences, localization, and onboarding.
- **Settings** (§5.8): weight unit (kg/lb) using **canonical-kg display conversion** (no data
  mutation); theme picker (System/Light/Dark); language picker (RU/EN, live, no reload).
- **Starter Program prompt** (§5.9) + the **three programs** (Appendix B), names written in current
  language at apply time, not retranslated. Prompt timing: Guest → shown immediately when routines
  empty & not-yet-asked; sticky local `didCompleteInitialSeed` flag.
- Full **string catalog** (Appendix A) RU/EN; metric labels; relative date/time + `M:SS` formatting.
- Accessibility semantics (combined row labels, hints, hidden decorative icons); SF Symbols →
  `lucide-react` icon mapping.
**Acceptance:** §14 items on weight units, theme/language, seeded-names-don't-retranslate, starter
prompt rules (Guest path), confirmed deletes — all pass.

### Phase 3 — PWA hardening
**Goal:** a polished, verifiably-offline installable app.
- App icons + maskable icons + splash; install affordance; standalone display verified on iOS Safari
  and Android Chrome.
- Service-worker update flow (toast: "new version, reload"); precache correctness; offline smoke pass
  in airplane mode (create routine, start session, log sets, reopen — all work).
- Lighthouse PWA + performance/accessibility pass; fix regressions.
**Acceptance:** Lighthouse PWA installable; full flow works offline after first load with no network.

### Phase 4 — Google auth + cloud sync (Account Mode)
**Goal:** optional Google sign-in with cross-device sync, without compromising offline.
- Firebase project: Auth (Google provider), Firestore, Hosting; OAuth consent screen + authorized
  domains; security rules (a user reads/writes only `users/{uid}/**`).
- **Auth UI:** sign-in (Google) / sign-out; Account Mode indicator. The Settings **Sync** section
  replaces the iCloud status row with a Google account + sync-status row (§5.8, §11.4 analog:
  signed-in / online / last-sync / error).
- **Firestore layout:** `users/{uid}/{routineDays|routineExercises|workoutSessions|exerciseLogs|sets}/{id}`,
  each doc mirroring the local record + `updatedAt` + tombstone.
- **Sync engine:** explicit push/pull delta sync (online only): push locally-changed docs, pull
  remote-changed docs, resolve per-doc **LWW** by `updatedAt`, propagate deletes via tombstones.
  Triggered on sign-in, on app foreground while online, and after local writes (debounced).
- **Sign-in merge:** smart union (union by UUID; LWW on overlaps; guest Routine Days re-based to
  append after max cloud `order`).
- **Seeding timing in Account Mode:** evaluate the starter prompt only **after the first pull settles**
  (so a routine synced from another device suppresses the prompt) — mirrors iOS sync-on behavior (§10).
- Deploy to Firebase Hosting.
**Acceptance:** §14 items on identity/sync analog (optional sign-in, private per-user data, graceful
offline, live status), starter prompt Account-path timing; sign in on a 2nd device → data appears;
sign out → still fully usable in Guest/local mode.

## 5. Cross-cutting concerns

- **Offline guarantee (non-negotiable):** never `await` Firestore on a UI path; all UI reads/writes go
  to Dexie; sync is background and online-only.
- **Auth on installed PWA:** prefer `signInWithRedirect` (popups are unreliable in standalone PWAs);
  verify the OAuth redirect domain matches the Hosting domain.
- **Security rules:** lock Firestore to the authenticated user's own subtree.
- **Clock skew:** LWW uses client `updatedAt`; documented risk (ADR-0002), optional server-timestamp
  hardening later.
- **Org/compliance:** no secrets in the repo (Firebase web config is public by design, but keep API
  restrictions + security rules); no analytics/third-party SDKs beyond Firebase (matches §12).

## 6. Testing strategy

- **Domain unit tests (Vitest):** Start a Session, Previous Set (no-history / most-recent / rename-safe
  / excludes-current), pre-fill cascade, validation, ordering, weight kg↔display conversion, sign-in
  merge union.
- **Component tests (Testing Library):** metric-adaptive tracking screen, confirm-dialog flows,
  language switch re-render, theme switch.
- **Offline test:** scripted airplane-mode pass (Phase 3) — optionally Playwright e2e (out of POC scope).

## 7. Risks & open items (track, not blockers)

- LWW field-loss under rare concurrent multi-device edits (accepted; append-only history mitigates).
- PWA auth redirect quirks on iOS Safari standalone — validate early in Phase 4.
- Tombstone growth over time — fine for POC; add GC if needed.
- RetroUI a11y coverage for dialogs/segmented controls — supplement with Radix where lacking.

## 8. Out of scope (POC)

- Multi-user/sharing, social, analytics, notifications, ads.
- Real-time live sync UI (we do explicit push/pull, not live listeners).
- Server-side rendering (pure client PWA).
