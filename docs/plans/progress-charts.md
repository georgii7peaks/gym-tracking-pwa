# Plan: Per-Exercise Progress Charts (Progress tab)

Status: **implemented** (2026-07-07).
Date: 2026-07-07

## 1. Goal

Answer the question **"am I getting stronger at exercise X?"** A new bottom-bar
**Progress** tab lists every exercise the user has ever performed; tapping one
opens a line chart of that exercise's result per workout session over time.

## 2. Decisions agreed in the interview

| Decision | Choice |
|---|---|
| Core content | Per-exercise progression (no overall dashboard) |
| Chart value (weightReps) | **Top weight** — max `weightKg` across *done* sets in a session |
| Chart value (duration) | **Longest duration** — max `durationSec` across *done* sets in a session |
| Duration exercises | Included in the picker, charted in M:SS |
| Placement | New 4th tab **Progress** in the bottom bar |
| Picker UX | List → detail: `/progress` (exercise list) → `/progress/:exerciseName` (chart) |
| Time range | Filter chips **1M / 3M / 6M / All**, default **All** |
| Rendering | Hand-rolled SVG chart component, **no new dependencies** |
| Screen extras | **Chart only** (+ range chips). No stats row, no history list |

## 3. Stated assumptions (low-risk, decided from the codebase)

- **Only `done: true` sets count** — consistent with the existing volume/"sets
  done" stats. A session with no done sets of an exercise contributes no point.
- **Exercise identity = exact `ExerciseLog.name` string.** The model has no
  exercise entity ID; renaming an exercise in a routine starts a new history
  line. Accepted limitation, documented in the plan's Risks.
- **Same name, mixed metrics** (exercise recreated with a different metric):
  the metric of the *most recently trained* log wins; logs with the other
  metric are excluded from the series.
- **Multiple logs of the same name in one session**: aggregated together
  (max across all their done sets).
- **X-axis position** = `WorkoutSession.startedAt`. Soft-deleted records are
  already filtered by the repository layer.
- **Weight display unit**: the `weightUnit` of the most recent log of that
  exercise (converted from canonical kg via `kgToDisplay`); durations format
  with the existing `formatDuration` (M:SS).
- **Point inspection**: tapping a point highlights it and shows its value +
  date as a caption. This is part of "chart only" — mobile has no hover, so a
  chart without tap readout is unusable.

## 4. Approach & steps

### Step 1 — Domain: pure series builder
**New** `src/domain/progress.ts` (+ `progress.test.ts`)

Pure, framework-free functions (matches the existing domain-layer style):

- `buildExerciseIndex(logs, sets, sessions)` → distinct tracked exercises:
  `{ name, metric, weightUnit, lastTrainedAt, sessionCount }`, sorted by
  `lastTrainedAt` desc. Excludes exercises with zero done sets.
- `buildProgressSeries(name, logs, sets, sessions)` →
  `{ metric, weightUnit, points: Array<{ sessionId, startedAt, value }> }`
  where `value` is max done `weightKg` or max done `durationSec` per session,
  sorted by `startedAt` asc.
- `filterByRange(points, range: '1m'|'3m'|'6m'|'all', nowMs)` — range-chip
  filtering, kept pure for testability.

### Step 2 — Data: composite queries
**Modify** `src/data/queries.ts`

- `listTrackedExercises()` — loads all logs (`repo.exerciseLogs.list()`),
  sessions, and each log's sets, delegates to `buildExerciseIndex`.
- `getExerciseProgress(name)` — same sources filtered by name, delegates to
  `buildProgressSeries`.

POC-scale data (hundreds of sets), so full-table reads composed in JS match
the existing query style (`listWorkoutSummaries` does the same).

### Step 3 — i18n strings
**Modify** `src/i18n/strings.ts` — RU + EN for:
`tab.progress`, `progress.title`, `progress.empty.title`, `progress.empty.hint`,
`progress.range.1m/.3m/.6m/.all`, `progress.lastTrained`,
`progress.noData` (exercise has no points in the selected range),
`progress.chartLabel` (aria-label).

### Step 4 — Chart component
**New** `src/components/ProgressChart.tsx`

- Pure SVG line chart: props `{ points, formatValue, formatDate }`.
- Retro styling from existing design tokens (border-2, hard shadows, mono
  labels, `--radius-retro`, primary accent) — works in both Classic RetroUI
  (light) and Neon Night (dark).
- Y-axis: ~4 rounded ticks in the display unit; X-axis: first/last date labels.
- Tap/click a point → highlight + value/date caption. Single point renders as
  a dot. Dense series (>~40 points) drop point markers, keep the line.
- `role="img"` + localized `aria-label`.
- **Before writing this component, the `dataviz` skill must be loaded** (its
  trigger requires reading it before any chart code); apply its guidance using
  the app's existing token palette.

### Step 5 — Screens, routes, tab
- **New** `src/app/routes/ProgressListPage.tsx` — `Screen` + card rows
  (name, metric short label, last-trained date via `src/lib/datetime.ts`),
  `EmptyState` when nothing tracked yet, `useLiveData` for reads.
- **New** `src/app/routes/ExerciseProgressPage.tsx` — `Screen` with back
  chevron, title = exercise name (`decodeURIComponent` of the route param),
  range chips (local `useState`, default `all`), `ProgressChart`.
- **Modify** `src/app/router.tsx` — add `progress` and
  `progress/:exerciseName` routes.
- **Modify** `src/app/layout/TabBar.tsx` — 4th tab
  `{ to: '/progress', labelKey: 'tab.progress', icon: ChartLine }`
  (lucide `ChartLine`; the existing `flex-1` layout accommodates 4 tabs).

### Step 6 — Verification
`npm run typecheck && npm run lint && npm test`, then run the app and drive
the flow (log a workout → open Progress → check chart, range chips, RU/EN,
light/dark).

## 5. Files summary

| File | Change |
|---|---|
| `src/domain/progress.ts` | **new** — pure aggregation |
| `src/domain/progress.test.ts` | **new** — unit tests |
| `src/data/queries.ts` | modify — two composite queries |
| `src/i18n/strings.ts` | modify — new keys RU/EN |
| `src/components/ProgressChart.tsx` | **new** — SVG chart |
| `src/app/routes/ProgressListPage.tsx` | **new** |
| `src/app/routes/ExerciseProgressPage.tsx` | **new** |
| `src/app/router.tsx` | modify — 2 routes |
| `src/app/layout/TabBar.tsx` | modify — 4th tab |
| `src/app/progress.test.tsx` | **new** — flow test |

## 6. Acceptance criteria → steps

| # | Criterion | Step |
|---|---|---|
| AC1 | Progress tab appears in the bottom bar, labelled in RU/EN | 3, 5 |
| AC2 | Tab lists every exercise with ≥1 done set, most recently trained first | 1, 2, 5 |
| AC3 | Tapping an exercise shows a line chart: top weight (or longest duration) per session over time | 1, 4, 5 |
| AC4 | Range chips 1M/3M/6M/All filter the chart; default All | 1, 5 |
| AC5 | Weights display in the exercise's preferred unit; durations as M:SS | 1, 4 |
| AC6 | Works offline, updates live after logging sets, adds no dependencies | 2, 4 |
| AC7 | Sensible empty states (no history at all; no points in range) | 5 |

## 7. Risks & edge cases

- **Renamed exercises split history** — inherent to name-based identity;
  out of scope to fix (would need an exercise entity + migration).
- **Same name with both metrics** — latest-metric-wins rule (see assumptions).
- **URL-unsafe names** (spaces, `/`, Cyrillic) — `encodeURIComponent` on link,
  decode in the page; react-router handles encoded segments.
- **Sparse data** (1 point) — dot without line; **dense data** — markers
  dropped past ~40 points, range chips mitigate.
- **Direct URL to unknown exercise** — render EmptyState, no crash.
- **lb rounding** — reuse `formatWeightValue` so chart captions match the rest
  of the app.

## 8. Test strategy

- **Unit (domain)**: `progress.test.ts` — done-only filtering; max-per-session
  for weight and duration; mixed-metric exclusion; multi-log aggregation;
  sorting; range filtering boundaries.
- **Flow (component)**: `progress.test.tsx` following `flow.test.tsx` patterns
  (memory router + fake-indexeddb): empty state → seed data → list shows
  exercise → navigate → chart renders points (assert via aria-label/SVG
  structure) → range chip narrows points → RU/EN labels.
- **Regression**: full existing suite must stay green (`npm test`).
