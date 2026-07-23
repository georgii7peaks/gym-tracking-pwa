# Plan: Total-Volume Progress tab (replaces per-exercise charts)

Status: **proposed**
Date: 2026-07-22

## 1. Goal

Change the Progress tab from **"am I getting stronger at exercise X?"** (a list
of exercises → a per-exercise top-weight chart) to **"how is my total training
output trending?"** The tab leads with two whole-body totals over time — **Total
Volume** and **Total Duration** — with an optional filter down to a single
exercise. This supersedes `docs/plans/progress-charts.md`.

## 2. Decisions agreed in the interview

| Decision | Choice |
|---|---|
| Page shape | **One screen**: total charts + exercise filter. The old list page and `/progress/:exerciseName` detail route/page are **removed**. |
| Charts | **Two**: Total Volume (weightReps sets) and Total Duration (duration sets) |
| Total Volume value | Per session, `Σ (weightKg × reps)` over **done** weightReps sets — aggregated canonically in kg, **displayed in the Settings weight unit (kg or lb)** via `kgToDisplay` |
| Total Duration value | Per session, `Σ durationSec` over **done** duration sets |
| Filter control | **Drawer picker** (tap a button → bottom Drawer with a list) — reuses the existing `Drawer` primitive; scales to many exercises |
| Filter default | **"All exercises"** |
| Filter → charts | "All exercises" shows **both** charts. Selecting a specific exercise shows **only the one chart matching its metric** (weightReps → Volume of that exercise; duration → Duration of that exercise); the other is hidden. |
| Time range | Filter chips **1M / 3M / 6M / All**, default **All** (reused from today) |
| Rendering | Reuse the existing hand-rolled `ProgressChart` SVG component **unchanged** — no new dependencies |

## 3. Stated assumptions (low-risk, decided from the codebase — veto any before approval)

- **X-axis = one point per Workout Session** at `WorkoutSession.startedAt`,
  matching the existing chart and domain model (no weekly/daily bucketing).
- **Volume respects the global Settings weight unit (kg/lb).** The domain series
  stays canonical (`value` = `Σ weightKg × reps`, in kg); only the chart display
  converts via `kgToDisplay(value, unit)`, with `unit`/`unitLabel` from the
  existing `useWeightUnit()` hook. This follows the app's "store kg, convert at
  display" rule and keeps the domain unit-agnostic (tests stay in kg). The unit
  is read on render, so it's picked up when navigating to the tab — matching how
  the rest of the app reads the preference (e.g. `SetRow`); a change made in
  Settings while Progress is already mounted applies on the next visit. The
  chart title carries the localized unit (e.g. "Total volume, lb").
- **Total Duration reuses `formatDuration` (M:SS).** A summed session duration
  can exceed 60 min, so minutes may exceed 59 (e.g. "75:00"). Hours-aware
  formatting is **out of scope** unless requested (see Risks).
- **"All exercises" view renders a chart only if it has ≥1 point in range.** A
  user who only logs weightReps sees just the Volume chart (Duration omitted),
  and vice-versa. If *both* are empty → the `progress.noData` state.
- **Filter list = `buildExerciseIndex` ordering** (every exercise with ≥1 done
  set, most-recently-trained first). Each row shows name + metric short label;
  an **"All exercises"** entry is pinned on top; the current selection gets a
  checkmark. `progress.lastTrained` is reused as a per-row hint.
- **`done: true` sets only** contribute — consistent with today's aggregation.
- **Exercise identity = exact `ExerciseLog.name`** (unchanged limitation;
  renames split history).
- **Mixed metrics under one name**: an exercise's metric in the filter list is
  resolved by "most recently trained log wins" (existing `buildExerciseIndex`
  rule). Its Volume series only sums weightReps done sets; its Duration series
  only sums duration done sets — so a mixed-history name simply contributes to
  whichever total each of its sets belongs to.
- **Filter state is local `useState`, default `'all'`**; it resets to "All" on
  remount (acceptable — no persistence requirement).

## 4. Approach & steps

### Step 1 — Domain: total-series builders
**Modify** `src/domain/progress.ts` (+ `progress.test.ts`)

- **Add** `buildVolumeSeries(logs, sets, sessions, exerciseName?)` →
  `ProgressSeries` with `metric: 'weightReps'`: per session, value =
  `Σ (weightKg × reps)` over done sets whose log metric is `weightReps`
  (filtered to `exerciseName` when provided). Sessions with no such done sets
  contribute no point. Sorted by `startedAt` asc.
- **Add** `buildDurationSeries(logs, sets, sessions, exerciseName?)` →
  `ProgressSeries` with `metric: 'duration'`: per session, value =
  `Σ durationSec` over done sets whose log metric is `duration`. Same shape.
- **Keep** `buildExerciseIndex` (filter list) and `filterByRange` (range chips)
  as-is; keep the `ProgressPoint` / `ProgressSeries` / `TrackedExercise` /
  `ProgressRange` types.
- **Remove** `buildProgressSeries` (old top-weight-per-session) and the now-unused
  `resolveTrainedEntries`/`setValue` helpers *only if* they become dead after
  the query change — `buildExerciseIndex` still uses `resolveTrainedEntries`, so
  that helper stays; only `buildProgressSeries` + `setValue` are removed.

Both new builders share a small internal helper that groups done sets by session
and sums a per-set contribution — mirrors the existing `bySession` map style.

### Step 2 — Data: composite query
**Modify** `src/data/queries.ts`

- **Add** `getProgressSeries(exerciseName?)` →
  `{ volume: ProgressSeries; duration: ProgressSeries }`. Loads logs (filtered by
  name when given), all sessions, and each log's sets (reusing `loadSetsForLogs`),
  then delegates to the two builders.
- **Keep** `listTrackedExercises()` (drives the filter list).
- **Remove** `getExerciseProgress(name)` (no longer referenced).

POC-scale full-table reads, same style as `listWorkoutSummaries`.

### Step 3 — i18n strings
**Modify** `src/i18n/strings.ts` — add RU/EN keys:
`progress.filter.all` ("Все упражнения" / "All exercises"),
`progress.filter.button` (button/aria for opening the picker, e.g. "Упражнение"),
`progress.volume.title` ("Общий объём, {unit}" / "Total volume, {unit}"),
`progress.volume.titleFor` ("Объём: {name}, {unit}" / "Volume: {name}, {unit}"),
`progress.duration.title` ("Общее время" / "Total duration"),
`progress.duration.titleFor` ("Время: {name}" / "Duration: {name}"),
plus per-chart aria labels (`progress.volume.chartLabel`,
`progress.duration.chartLabel`, each taking `{title}`).
**Keep** `tab.progress`, `progress.title`, `progress.empty.*`, `progress.noData`,
`progress.range.*`, `progress.lastTrained`, `metric.*.short`.
**Remove** `progress.chartLabel` (per-exercise, superseded).

### Step 4 — Screen: single Progress page
**Rename** `src/app/routes/ProgressListPage.tsx` → `ProgressPage.tsx`, rewritten:

- `useLiveData(() => listTrackedExercises(), [])` → filter list (+ empty check).
- Local `const [selected, setSelected] = useState<string | 'all'>('all')`.
- `useLiveData(() => getProgressSeries(selected === 'all' ? undefined : selected), [selected])`
  → `{ volume, duration }`.
- Local `range` state (default `'all'`), a `SegmentedControl` (reused).
- **Filter button** showing the current selection → opens a `Drawer` listing
  "All exercises" + each tracked exercise (name, metric short label, checkmark on
  the active one). Picking one sets `selected` and closes the Drawer.
- **Which charts to show:**
  - `selected === 'all'`: render the Volume chart if `volume` has points in
    range, and the Duration chart if `duration` has points in range.
  - specific exercise: look up its `metric` in the index; render only the Volume
    chart (weightReps) or only the Duration chart (duration).
  - `const { unit, unitLabel } = useWeightUnit()` for the Volume chart.
  - Each shown chart is a `ProgressChart` fed `filterByRange(series.points, range, Date.now())`,
    with `formatValue` = `Math.round(kgToDisplay(v, unit)).toLocaleString()` for
    Volume (title includes `unitLabel`) or `formatDuration` for Duration, and a
    title heading above it.
- **Empty states:** index empty → `EmptyState` (`progress.empty.*`); a selection
  with no points in range → `progress.noData`.

**Delete** `src/app/routes/ExerciseProgressPage.tsx`.

### Step 5 — Router
**Modify** `src/app/router.tsx`

- Point `progress` at `ProgressPage`.
- **Remove** the `progress/:exerciseName` route and the `ExerciseProgressPage`
  import.

### Step 6 — Verification
`npm run typecheck && npm run lint && npm test`, then `npm run dev` and drive it:
log weightReps + duration sessions → open Progress → both charts show → open the
filter Drawer → pick a weightReps exercise (only Volume shows) → pick a duration
exercise (only Duration shows) → range chips narrow points → RU/EN, light/dark.

## 5. Files summary

| File | Change |
|---|---|
| `src/domain/progress.ts` | modify — add `buildVolumeSeries`/`buildDurationSeries`; drop `buildProgressSeries`/`setValue` |
| `src/domain/progress.test.ts` | modify — new series tests; drop old top-weight tests |
| `src/data/queries.ts` | modify — add `getProgressSeries`; drop `getExerciseProgress` |
| `src/app/routes/ProgressPage.tsx` | **new** (renamed from `ProgressListPage.tsx`) — single screen |
| `src/app/routes/ProgressListPage.tsx` | **removed** (renamed) |
| `src/app/routes/ExerciseProgressPage.tsx` | **removed** |
| `src/app/router.tsx` | modify — one `progress` route, drop detail route |
| `src/i18n/strings.ts` | modify — add filter/title/aria keys; drop `progress.chartLabel` |
| `src/app/progress.test.tsx` | modify — rewrite flow tests for the new screen |
| `src/components/ProgressChart.tsx` | **unchanged** (reused as-is) |
| `src/components/ui/Drawer.tsx` | **unchanged** (reused) |

## 6. Acceptance criteria → steps

| # | Criterion | Step |
|---|---|---|
| AC1 | Progress tab shows a **Total Volume** chart (Σ weight×reps of done sets per session, shown in the Settings unit kg/lb) across all exercises by default | 1, 2, 4 |
| AC2 | Progress tab shows a **Total Duration** chart (Σ durationSec of done sets per session) across all duration exercises by default | 1, 2, 4 |
| AC3 | A Drawer filter lists "All exercises" + every tracked exercise (most-recently-trained first); default "All exercises" | 3, 4 |
| AC4 | Selecting a weightReps exercise shows **only** its Volume chart; selecting a duration exercise shows **only** its Duration chart | 1, 4 |
| AC5 | Range chips 1M/3M/6M/All filter the visible chart(s); default All | 4 |
| AC6 | Old list→detail flow gone: no `/progress/:exerciseName`, no dead code, **no new dependencies** | 1, 2, 4, 5 |
| AC7 | Empty states: no history at all → EmptyState; selection with no points in range → noData | 4 |
| AC8 | RU/EN + light/dark, works offline, live-updates after logging sets | 3, 4 |

## 7. Risks & edge cases

- **Summed duration > 60 min** renders as `M:SS` with minutes >59 (e.g.
  "75:00"). Accepted for the POC; flagged for a future hours-aware formatter.
- **Volume unit change while mounted** — the unit is read on render, so a switch
  in Settings applies on the next navigation to Progress, not live. Consistent
  with the rest of the app; accepted. (Aggregation stays in kg for precision;
  only display converts, so no rounding drift accumulates.)
- **Only duration exercises logged** → Volume chart omitted in "All" view (and
  vice-versa); both empty → `progress.noData`. Covered by tests.
- **Renamed exercises split history** — inherent to name-based identity; out of
  scope (unchanged from the prior plan).
- **Mixed-metric name** — its sets flow into whichever total they belong to; the
  filter row's metric comes from `buildExerciseIndex` (latest-log-wins).
- **Live update** — writes already call `notifyDataChanged()`; `useLiveData`
  re-runs both reads, so logging a set refreshes the charts with no extra wiring.
- **Stale/removed routes** — a bookmarked `/progress/<name>` now falls through to
  the `*` → `/workouts` redirect; no crash.

## 8. Test strategy

- **Unit (domain)** `progress.test.ts`: `buildVolumeSeries` sums weight×reps over
  done sets per session (done-only, multi-log, per-session boundaries, name
  filter, weightReps-only); `buildDurationSeries` sums durationSec similarly;
  empty-series when no matching sets; sort order; `filterByRange` boundaries
  (retained).
- **Flow (component)** `progress.test.tsx` (rewritten, mirrors `flow.test.tsx`,
  memory router + fake-indexeddb):
  - empty state when nothing trained;
  - seed weightReps + duration sessions → both charts render (assert via each
    chart's `role="img"` aria-label / point count);
  - open the filter Drawer → pick a weightReps exercise → only the Volume chart;
    pick a duration exercise → only the Duration chart;
  - range chip narrows the visible chart's point count;
  - **weight unit**: with `weightUnit` = 'lb' (via `setPreference`), the Volume
    chart title shows the lb label and the readout reflects the converted value;
  - RU + EN headings/labels.
- **Regression**: full suite stays green (`npm test`). Note the pre-existing
  flakiness in `flow.test.tsx` / `SettingsPage.test.tsx` — re-run, not a
  regression.
