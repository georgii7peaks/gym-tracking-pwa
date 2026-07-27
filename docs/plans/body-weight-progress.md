# Plan: Body Weight tracking on the Progress tab

Status: **implemented**
Date: 2026-07-27

## 1. Goal

Let the user track **their own body weight** over time from the Progress tab:
a chart of body weight (so the gain/loss is actually visible), the **same**
1M/3M/6M/All range control the training charts use, a button to enter and save
the current weight, and the option to read the trend as **daily or weekly
averages** instead of raw weigh-ins. Complements
`docs/plans/progress-total-volume.md` (Total Volume / Total Duration) — it does
not replace anything.

## 2. Decisions agreed in the interview

| Decision | Choice |
|---|---|
| What is tracked | **Body Weight Entry** — the user's own body weight, stored canonically in **kg** |
| Placement | A **dedicated "Body weight" section at the top** of the Progress tab, above the exercise filter. Always visible, independent of the exercise filter, works even with zero workouts |
| Range control | **One shared** `SegmentedControl` (1M/3M/6M/All) **moved to the very top** of the screen; it drives the body-weight chart *and* the training charts |
| Storage | **Full first-class entity**: new Dexie table `bodyWeightEntries` (schema v2) with `SyncMeta`/tombstone, new `EntityStore` in the repository port, writes via `operations.ts`, **plus** Firestore sync and JSON export/import |
| Granularity | **Every save is a new point** — no per-day upsert, no date picker (`measuredAt` = the full save timestamp in ms, which is what makes day/week bucketing possible) |
| Averaging | **Explicit grouping switch inside the body-weight card**: `All entries / By day / By week`. `day`/`week` plot the **average** of the weigh-ins in each bucket. Applies to **body weight only** — the training charts keep "one point = one Workout Session" |
| Fixing mistakes | **"History" Drawer** listing entries (newest first) with a delete button + `ConfirmDialog` |
| Entry form | **Modal**: numeric `TextField` (`inputMode="decimal"`) **plus** ± buttons for fine tuning, **prefilled with the last saved weight** so nothing has to be typed |
| Validation | **Soft**: any finite positive number is accepted (no upper bound); Save disabled while the field is empty/invalid |
| Reading the trend | Chart Y axis **auto-scales** for body weight (new `baseline: 'zero' \| 'auto'` prop on `ProgressChart`; training charts keep `'zero'`), **plus** a numeric header: current weight + change over the selected range |
| Chart point type | `ProgressPoint` is renamed to neutral fields **`{ id, at, value }`** (was `{ sessionId, startedAt, value }`) so one point type serves volume, duration and body weight |

## 3. Stated assumptions (low-risk, decided from the codebase — veto any before approval)

- **Display unit follows Settings** (`useWeightUnit()`): storage is always kg
  (`domain/weight.ts` rule), entry and display convert via
  `displayToKg`/`kgToDisplay`. The ± step is **0.1 kg / 0.2 lb**; the stored kg
  value is rounded to 2 decimals to avoid lb→kg float drift.
- **"Current weight" = the latest raw entry overall** (never averaged, never
  range-filtered), shown with its date. **Delta = last − first of the points
  actually plotted** (so it follows the grouping and the range), hidden when
  fewer than 2 points are plotted.
- **Buckets are local-time** (`day` = local midnight-to-midnight, `week` = ISO
  weeks starting **Monday**, matching both RU and EN conventions here). A bucket
  is plotted at its **start** (`at` = local start of day / of Monday) and
  labelled with the existing `formatSessionDate`.
- **Order of operations: filter by range first, then group** the survivors — so
  a bucket never mixes in weigh-ins from outside the selected range.
- **Missing days/weeks are not gap-filled** — an empty week simply has no point;
  no interpolation, no zero-filling (a zero would be a lie about body weight).
- **Grouping default is `All entries`** (what you entered is what you see); the
  choice is local `useState`, not persisted.
- **The History Drawer always lists raw entries** regardless of the grouping —
  deleting needs real entry ids.
- **Delta is neutral in colour** — sign only (`+2.1` / `−2.1`), no green/red
  judgement: gaining can be the goal (bulking).
- **The section renders even with no entries**: card with a short hint and the
  "Log weight" button; the chart appears from the first entry.
- **The range chips are hidden only when the tab is completely empty** (no body
  weight entries *and* no tracked exercises) — otherwise they are always on top.
- **The current early `return` for "nothing trained yet"** in `ProgressPage`
  moves *below* the body-weight section: the workouts `EmptyState` becomes an
  inner block, so body weight is usable before the first workout.
- **Backup format stays `version: 1`**: `bodyWeightEntries` is an **optional**
  array in `parseBackup` (absent → `[]`), so existing backup files still import
  and no legacy branch is needed.
- **Sign-in merge needs no special case** — body weight entries have no `order`
  (unlike Routine Days), so plain push/pull union by `id` + LWW is correct.
- **Firestore rules need no change** — `firestore.rules` already matches
  `users/{uid}/{collection}/{docId}` with a wildcard collection.
- **No new dependencies**; `ProgressChart` stays hand-rolled SVG.
- **CONTEXT.md gains the canonical term** "Body Weight Entry" (CLAUDE.md says the
  glossary is load-bearing).

## 4. Approach & steps

### Step 1 — Domain: term, type, validation
**Modify** `src/domain/types.ts`, `src/domain/validation.ts` (+ `validation.test.ts`), `CONTEXT.md`

```ts
// types.ts
export interface BodyWeightEntry extends SyncMeta {
  id: string
  /** Canonical kilograms (same rule as SetEntry.weightKg). */
  weightKg: number
  /** When the weigh-in was recorded (ms). */
  measuredAt: number
}
```
- Add `BodyWeightEntry` to the `AnyEntity` union and `'bodyWeightEntries'` to
  `EntityName`.
- `validation.ts`: add `isValidBodyWeight(kg: number): boolean` → finite && > 0
  (deliberately *not* `clampWeightKg`, which allows 0 for bodyweight sets).
- `CONTEXT.md`: new subsection **"Body side (personal measurements)"** under
  *Language* — **Body Weight Entry** — a dated record of the user's own body
  weight, canonical kg; belongs to neither the Routine nor the Workout
  aggregate. _Avoid_: Weight (ambiguous with a Set's weight), Weigh-in, Measurement.

### Step 2 — Data: table, port, repository impl
**Modify** `src/data/db.ts`, `src/data/repository.ts`, `src/data/dexie-repository.ts` (+ `repository.test.ts`)

- `db.ts`: `bodyWeightEntries!: Table<BodyWeightEntry, string>` and
  ```ts
  this.version(2).stores({ bodyWeightEntries: 'id, measuredAt, updatedAt' })
  ```
  (Dexie merges schemas across versions — v1's five tables stay declared as-is.)
- `repository.ts`: new port member
  ```ts
  bodyWeightEntries: EntityStore<BodyWeightEntry> & {
    /** Live entries oldest-first (chart order). */
    listChronological(): Promise<BodyWeightEntry[]>
    /** Most recent live entry, or undefined — prefills the entry form. */
    latest(): Promise<BodyWeightEntry | undefined>
  }
  ```
- `dexie-repository.ts`: build it with the existing `makeStore` helper + sorting
  by `measuredAt` (same shape as `listNewestFirst`).

### Step 3 — Data: write path
**Modify** `src/data/operations.ts` (+ `operations.test.ts`)

```ts
export async function logBodyWeight(weightKg: number): Promise<BodyWeightEntry | null>
export async function deleteBodyWeightEntry(id: string): Promise<void>
```
- `logBodyWeight`: reject (`null`) when `!isValidBodyWeight`; otherwise create
  `{ id: newId(), weightKg: round2(weightKg), measuredAt: now(), updatedAt: now() }`,
  `put`, `notifyDataChanged()`. Returns the record (mirrors `createRoutineDay`).
- `deleteBodyWeightEntry`: `repo.bodyWeightEntries.remove(id)` (soft delete) +
  `notifyDataChanged()`.

### Step 4 — Domain: neutral point type + body-weight series & grouping
**Modify** `src/domain/progress.ts` (+ `progress.test.ts`)

- **Rename** `ProgressPoint.sessionId → id` and `startedAt → at`; update
  `buildTotalSeries`, `filterByRange` and their tests. Pure rename, no logic change.
- **Add** `buildBodyWeightSeries(entries: BodyWeightEntry[]): ProgressPoint[]` —
  map to `{ id, at: measuredAt, value: weightKg }`, sorted by `at` ascending.
  (Returns bare points, not `ProgressSeries`: `Metric` is `weightReps | duration`
  and body weight is neither.)
- **Add** the grouping:
  ```ts
  export type BodyWeightGrouping = 'raw' | 'day' | 'week'
  export function groupBodyWeightPoints(
    points: ProgressPoint[],
    grouping: BodyWeightGrouping
  ): ProgressPoint[]
  ```
  `'raw'` returns the input untouched. `'day'`/`'week'` bucket by **local**
  start-of-day / start-of-Monday-week, and emit one point per bucket:
  `at` = bucket start, `value` = **arithmetic mean** of the bucket's values
  (canonical kg — averaging before the display conversion keeps kg/lb
  consistent), `id` = `` `d-${bucketStart}` `` / `` `w-${bucketStart}` `` (stable
  React key + chart hit-target id; never collides with an entry UUID). Output
  sorted by `at` ascending. Two small pure helpers `startOfLocalDay(ms)` /
  `startOfLocalWeek(ms)` (Monday, via `(getDay() + 6) % 7`) keep it testable and
  DST-correct.
- **Add** `bodyWeightDelta(points: ProgressPoint[]): number | undefined` —
  `last.value − first.value`, `undefined` when fewer than 2 points. Called with
  the **plotted** (filtered + grouped) points.

`progress.ts` grows to ~250 lines and now hosts both training series and body
weight; it stays one module because both are "series over time" aggregation over
the same `ProgressPoint`/`filterByRange` vocabulary.

### Step 5 — Data: composite query
**Modify** `src/data/queries.ts`

- **Add** `getBodyWeightSeries(): Promise<ProgressPoint[]>` →
  `buildBodyWeightSeries(await repo.bodyWeightEntries.listChronological())`.
  One read serves all three consumers: chart, header (last point), History
  Drawer (points reversed) — the point's `id` is the entry id, so delete works
  straight off it.

### Step 6 — Chart: non-zero baseline
**Modify** `src/components/ProgressChart.tsx`

- New optional prop `baseline?: 'zero' | 'auto'` (default `'zero'` — training
  charts unchanged). `niceTicks` gains a `floorAtZero` flag; with `'auto'` the
  lower tick follows the data (`Math.floor(lo / step) * step`) instead of being
  clamped to 0, so a 78→76 kg trend fills the plot area.
- Existing `sessionId`/`startedAt` usages updated to `id`/`at` (Step 4 rename).

### Step 7 — UI: body-weight section, entry dialog, history drawer
**New** `src/components/BodyWeightSection.tsx`, `src/components/BodyWeightDialog.tsx`,
`src/components/BodyWeightHistoryDrawer.tsx`

- **`BodyWeightSection`** (retro card, matching `ProgressChart`'s shell):
  - header: current weight (`formatWeightValue` + `unitLabel`) and its date;
    to the right the delta of the plotted points (`+/−`, hidden when < 2);
  - **grouping `SegmentedControl`** (`All entries / By day / By week`), local
    `useState<BodyWeightGrouping>('raw')`;
  - `ProgressChart` with `baseline="auto"` and
    `points = groupBodyWeightPoints(filterByRange(points, range, Date.now()), grouping)`,
    `formatValue = (kg) => formatWeightValue(kg, unit)`, `formatDate = formatSessionDate`;
  - a small caption under the chart in grouped mode ("ср. за день" / "ср. за
    неделю") so an averaged point is never mistaken for a raw weigh-in;
  - buttons: **"Log weight"** (primary) and **"History"** (secondary);
  - no entries → hint text instead of the chart, button still present.
- **`BodyWeightDialog`** — `Modal` + `TextField` (`inputMode="decimal"`,
  `autoFocus`, unit suffix) + `−`/`+` buttons stepping the parsed value by
  0.1 kg / 0.2 lb; prefilled with the latest entry in the display unit (empty
  when there is none). Save is disabled while the parsed value is invalid;
  Enter submits; on save `logBodyWeight(displayToKg(value, unit))` and close.
- **`BodyWeightHistoryDrawer`** — `Drawer` listing points newest-first
  (date + weight) with a delete button per row → `ConfirmDialog` →
  `deleteBodyWeightEntry(id)`. Empty list → short hint.

### Step 8 — Screen: wire it into the Progress tab
**Modify** `src/app/routes/ProgressPage.tsx`

- `useLiveData(() => getBodyWeightSeries(), [])` alongside the existing reads.
- Layout order: **range `SegmentedControl` → `BodyWeightSection` → exercise
  filter button → training charts / `noData`**.
- Replace the early `return` for "nothing trained yet": when
  `exercises.length === 0` the workout part renders the existing `EmptyState`
  *below* the body-weight section; the range chips render only when there is at
  least one body-weight point or one tracked exercise.
- Point field rename applied (`chart.points` consumers).

### Step 9 — Sync + backup
**Modify** `src/sync/syncEngine.ts`, `src/data/exportImport.ts` (+ `exportImport.test.ts`)

- `syncEngine.ts`: one more `pushCollection<BodyWeightEntry>(…, 'bodyWeightEntries', localDb.bodyWeightEntries, sinceMs)`
  and the matching `pullCollection` in the `pulled` array.
- `exportImport.ts`: `BackupFile.bodyWeightEntries: BodyWeightEntry[]`; export
  filters tombstones like the rest; `parseBackup` reads the field **optionally**
  (missing → `[]`, so v1 files still parse) with a `readBodyWeightEntry`
  validator; `importBackup` adds the table to the transaction, calls
  `mergeInto` and includes the count in the total.

### Step 10 — i18n
**Modify** `src/i18n/strings.ts` — RU/EN keys:
`common.save` ("Сохранить"/"Save"),
`progress.bodyWeight.title` ("Вес тела"/"Body weight"),
`progress.bodyWeight.log` ("Записать вес"/"Log weight"),
`progress.bodyWeight.history` ("История"/"History"),
`progress.bodyWeight.historyTitle` ("История веса"/"Weight history"),
`progress.bodyWeight.historyEmpty`,
`progress.bodyWeight.empty` ("Запишите свой вес, чтобы видеть динамику"/"Log your weight to see the trend"),
`progress.bodyWeight.current` ("Текущий вес"/"Current weight"),
`progress.bodyWeight.change` ("Изменение за период"/"Change over period"),
`progress.bodyWeight.dialogTitle` ("Записать вес"/"Log weight"),
`progress.bodyWeight.field` (aria/label "Вес, {unit}"/"Weight, {unit}"),
`progress.bodyWeight.delete.title` / `.message`,
`progress.bodyWeight.chartTitle` ("Вес тела, {unit}"/"Body weight, {unit}" — feeds the reused `progress.chartLabel`),
`progress.bodyWeight.group.label` (aria "Группировка"/"Grouping"),
`progress.bodyWeight.group.raw` ("Все"/"All"),
`progress.bodyWeight.group.day` ("По дням"/"By day"),
`progress.bodyWeight.group.week` ("По неделям"/"By week"),
`progress.bodyWeight.avg.day` ("ср. за день"/"daily average"),
`progress.bodyWeight.avg.week` ("ср. за неделю"/"weekly average").

### Step 11 — Verification
`npm run typecheck && npm run lint && npm test`, then `npm run dev`: log a
weight → chart appears → log a second, different one → delta shows with the
right sign → log two in the same day and switch to **По дням** → they collapse
into one averaged point → **По неделям** → one point per week → range chips
narrow both the body-weight and the training charts → History → delete an entry
→ the point disappears → switch Settings to lb → the card shows lb and the form
prefills in lb → RU/EN, light/dark, offline (DevTools offline) → reload to
confirm the Dexie v2 upgrade of an existing database.

## 5. Files summary

| File | Change |
|---|---|
| `CONTEXT.md` | modify — canonical term **Body Weight Entry** |
| `src/domain/types.ts` | modify — `BodyWeightEntry`, `AnyEntity`, `EntityName` |
| `src/domain/validation.ts` (+ test) | modify — `isValidBodyWeight` |
| `src/domain/progress.ts` (+ test) | modify — point rename `{id, at}`, `buildBodyWeightSeries`, `groupBodyWeightPoints` (day/week averages), `bodyWeightDelta` |
| `src/data/db.ts` | modify — table + Dexie **version 2** |
| `src/data/repository.ts` | modify — `bodyWeightEntries` port member |
| `src/data/dexie-repository.ts` (+ test) | modify — implementation |
| `src/data/operations.ts` (+ test) | modify — `logBodyWeight`, `deleteBodyWeightEntry` |
| `src/data/queries.ts` | modify — `getBodyWeightSeries` |
| `src/data/exportImport.ts` (+ test) | modify — backup field, optional parse, merge |
| `src/sync/syncEngine.ts` | modify — push/pull the new collection |
| `src/components/ProgressChart.tsx` | modify — `baseline` prop, point rename |
| `src/components/BodyWeightSection.tsx` | **new** — card: header + chart + buttons |
| `src/components/BodyWeightDialog.tsx` | **new** — Modal: field + ± steps, prefilled |
| `src/components/BodyWeightHistoryDrawer.tsx` | **new** — list + delete |
| `src/app/routes/ProgressPage.tsx` | modify — shared chips on top, section, empty-state restructure |
| `src/i18n/strings.ts` | modify — new RU/EN keys |
| `src/app/progress.test.tsx` | modify — new acceptance flows |
| `firestore.rules`, `src/sync/signInMerge.ts` | **unchanged** (wildcard rule; no `order` to rebase) |

## 6. Acceptance criteria → steps

| # | Criterion | Step |
|---|---|---|
| AC1 | The Progress tab has a **Body weight** section at the top, visible even with no workouts | 7, 8 |
| AC2 | A **"Log weight"** button opens a form **prefilled with the last saved weight**, with ± fine tuning, and saves a new entry | 3, 7 |
| AC3 | Saved entries render as a **line chart** whose Y axis auto-scales, so gain/loss is visible | 4, 5, 6, 7 |
| AC4 | The header shows the **current weight** and the **change over the selected range** with its sign | 4, 7 |
| AC5 | The **same** 1M/3M/6M/All chips drive the body-weight chart and the training charts | 8 |
| AC6 | Every entry records its **full timestamp**, and the card can show **daily / weekly averages** instead of raw weigh-ins (switch inside the card) | 1, 4, 7 |
| AC7 | Every save is a separate point; a wrong entry can be **deleted** from the History Drawer (which always lists raw entries) | 3, 7 |
| AC8 | Weight is stored in **kg**, displayed/entered in the Settings unit (kg/lb) | 1, 3, 7 |
| AC9 | Entries **sync** in Account Mode and are included in **JSON export/import**; old backups still import | 9 |
| AC10 | RU/EN, light/dark, fully offline; live refresh after save/delete; **no new dependencies** | 3, 7, 10 |

## 7. Risks & edge cases

- **Dexie upgrade on installed PWAs** — bumping to `version(2)` runs an
  automatic upgrade on existing IndexedDB databases; adding a table needs no
  `upgrade()` callback, but must be verified against a database created by v1
  (Step 11 reload check).
- **Point rename touches shipped code** (`sessionId`/`startedAt` → `id`/`at`) —
  mechanical, but the compiler + existing `progress.test.ts` are the safety net;
  no behaviour change intended.
- **Auto baseline can exaggerate noise** — a 0.3 kg daily fluctuation fills the
  plot. Accepted: that is exactly the requested readability. `niceTicks` padding
  already handles the single-point case (min === max).
- **Soft validation lets a typo (780) through** — it distorts the auto-scaled
  axis until deleted; this is why History + delete is in v1.
- **lb round-trip** — entering 173.0 lb stores 78.47 kg; redisplaying gives
  173.0 lb (1-decimal display). Rounding to 2 decimals in kg keeps the error
  below display precision.
- **Multiple entries the same day** are two points close together on the X axis
  in `All entries` mode; `By day` is exactly the fix, and with many entries the
  chart's `DENSE_THRESHOLD` (40) already drops markers.
- **An averaged point is not a real weigh-in** — mitigated by the caption ("ср.
  за неделю") and by the header always showing the latest *raw* entry.
- **Sparse buckets distort the line** — one weigh-in in a week produces a
  "weekly average" equal to that single measurement, and empty weeks leave gaps
  the line simply connects across. Accepted (no interpolation); flagged because
  a straight segment over a 3-week gap can look like a smooth trend.
- **Local-time buckets** mean the same entry can fall in a different day/week
  after a timezone change (travel). Accepted: bucketing is a display concern,
  the stored `measuredAt` never changes.
- **Tombstoned entries never resurface** — `EntityStore.list()` filters them and
  the export excludes them, same as every other entity.
- **Sync conflicts** — per-doc LWW by `updatedAt`; two devices logging different
  weights create two distinct entries (different ids), which is the intended
  union, not a conflict.

## 8. Test strategy

- **Unit (domain)** `progress.test.ts`: `buildBodyWeightSeries` maps and sorts
  by `measuredAt`; `groupBodyWeightPoints` — `'raw'` is a passthrough, `'day'`
  averages same-day entries into one point at local midnight and keeps separate
  days apart (including a 23:59 / 00:01 pair straddling midnight), `'week'`
  buckets Monday–Sunday (asserted on a Sunday/Monday boundary pair) and averages,
  output stays sorted, empty input → empty; `bodyWeightDelta` → `undefined` for
  0/1 points, negative for a loss, positive for a gain, and computed over
  grouped points; existing volume/duration tests updated to the new field names;
  `filterByRange` boundaries retained.
  `validation.test.ts`: `isValidBodyWeight` rejects 0, negatives, `NaN`.
- **Unit (data)** `repository.test.ts`: `listChronological` order, `latest`,
  tombstone filtering. `operations.test.ts`: `logBodyWeight` stores canonical kg
  and returns `null` on invalid input; two saves the same day produce two
  entries; `deleteBodyWeightEntry` hides the entry from reads.
- **Unit (backup)** `exportImport.test.ts`: round-trip includes body weight;
  a file **without** `bodyWeightEntries` still parses and imports; LWW merge of
  an existing entry.
- **Flow (component)** `progress.test.tsx` (extends the current suite):
  empty tab still shows the body-weight card with its button; log a weight via
  the real UI → chart with 1 point, no delta; log a second → 2 points + delta
  with the correct sign; **two entries the same day + "По дням" → one point**
  whose readout is their average, and the History Drawer still lists both;
  **"По неделям" → one point per week**; open History → delete → back to 1
  point; range chip narrows the body-weight points; `weightUnit = 'lb'` → lb
  label in the header and lb prefill in the dialog; RU + EN labels.
  *Seeding note:* `logBodyWeight` always stamps `measuredAt = now()` (no
  backdating in the UI, by design), so tests that need historical entries seed
  them through `repository.bodyWeightEntries.put(...)` directly rather than
  through a UI-dead "set date" operation — the same trick the existing suite
  uses for old sessions, minus the extra public API.
- **Regression**: full suite green (`npm test`). Known pre-existing flakiness in
  `flow.test.tsx` / `SettingsPage.test.tsx` — re-run, not a regression.
