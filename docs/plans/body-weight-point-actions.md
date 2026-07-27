# Plan: edit / delete a Body Weight Entry from the chart point

Status: **implemented**
Date: 2026-07-27

## 1. Goal

Remove the "History" button and the history list from the Body Weight card on
the Progress tab, and make the **chart point itself** the way to fix a weigh-in:
tap a point → an action button appears under the chart → a Drawer with the real
entries behind that point, each editable (weight **and** date/time) or
deletable. Follow-up to `docs/plans/body-weight-progress.md`, which shipped the
card with a delete-only History Drawer and no edit path at all.

## 2. Decisions agreed in the interview

| Decision | Choice |
|---|---|
| "History" button + Drawer | **Removed.** `BodyWeightHistoryDrawer.tsx` is deleted; "Log weight" becomes the only (full-width) button on the card |
| Affordance | Tap a point → the existing readout caption **plus one button** under the chart ("Действия с записью") → **Drawer** with `Изменить` / `Удалить` per entry. Not two inline buttons, not a drawer straight from the tap (a tap must still be able to just *read* the value) |
| Averaged points (`По дням` / `По неделям`) | The Drawer **always lists the real entries behind the point**: 1 row in `Все`, every weigh-in of that day/week in a bucket. **No limit** — the Drawer already scrolls (`max-h-[90vh]` + `overflow-y-auto`); a bucket is at most ~21 rows in real use and is *always* smaller than the old History list, which rendered every entry ever |
| What is editable | **Weight *and* date/time** (`measuredAt`), via a native `<input type="datetime-local">` — `toDateTimeLocalValue`/`fromDateTimeLocalValue` already exist in `src/lib/datetime.ts` and are currently unused |
| Date field in the **create** dialog | **Yes** — one dialog serves create and edit; on create the field is prefilled with "now", so the normal flow is unchanged but a forgotten weigh-in can be back-dated. *(Explicit scope extension, approved in the interview.)* |
| Date validation | **Not in the future**, any past instant allowed. Save is disabled with a short inline error while the date is in the future |
| Discoverability hint under the chart | **None** — the caption line stays blank until a point is selected (as today) |
| Delete confirmation | **Kept** (`ConfirmDialog`) — deletion is a tombstone with no undo |

## 3. Stated assumptions (low-risk, decided from the codebase — veto any before approval)

- **`ProgressChart` selection moves from index to point `id`.** Today `selected`
  is an array index (`ProgressChart.tsx:63`), so after a delete or a grouping
  switch the highlight silently jumps to a *different* point. Keyed by `id`, a
  selection whose point no longer exists simply resolves to "nothing selected".
  This is a prerequisite for delete-from-the-chart, not a drive-by refactor.
- **The action button is rendered by `BodyWeightSection` through an optional
  `renderPointAction` slot** on `ProgressChart`, so it sits *inside* the chart
  card under the caption (as in the approved mockup) while the chart stays
  generic. Volume/Duration pass nothing and render exactly as today.
- **Bucket → entries resolution runs against the *range-filtered* raw points** —
  the same list that was grouped. Resolving against the unfiltered list would
  make a boundary bucket list weigh-ins that were never averaged into it.
- **Drawer titles carry no counts** (`Запись веса` / `Записи за день` /
  `Записи за неделю`). The i18n catalog is a flat `{param}` map with no plural
  support, and "1 запись / 2 записи / 5 записей" would need `Intl.PluralRules`
  for one label. Each row shows its full date+time via `formatSessionDate`.
- **The edit dialog stacks on top of the open Drawer** — same pattern as the
  existing `ConfirmDialog`-over-`Drawer` (both are `Modal`, `z-50`, portalled;
  the later mount paints on top). So after editing one entry of a day the
  Drawer is still there to edit the next one.
- **Deleting the last entry behind the open point closes the Drawer** (there is
  nothing left to act on) and the chart's selection clears itself, because the
  point's `id` is gone from the data.
- **`measuredAt` is what the user picks; `updatedAt` is always "now"** on both
  create and edit — sync (LWW per doc) and JSON backup need no change and stay
  backward compatible. No Dexie schema change, no migration.
- **Storage stays canonical kg**, rounded to 2 decimals on write (`round2` in
  `operations.ts`), entry/display in the Settings unit — unchanged rule.
- **An entry outside the selected range is unreachable** until the range chip is
  widened (previously the History list showed everything). Acceptable: "Всё" is
  one tap away, and the chart is the stated entry point now.

## 4. Steps

### Step 1 — domain: date validation (`src/domain/validation.ts`)

Add a pure rule beside `isValidBodyWeight`:

```ts
/** A weigh-in cannot be recorded in the future; any past instant is allowed. */
export function isValidMeasuredAt(ms: number, nowMs: number): boolean {
  return Number.isFinite(ms) && ms <= nowMs
}
```

Also correct the `isValidBodyWeight` doc comment — "a typo is fixed by deleting
the entry" is no longer the only remedy.

### Step 2 — domain: resolve a plotted point back to real entries (`src/domain/progress.ts`)

Extract the existing `startOfLocalDay` / `startOfLocalWeek` pair into one lookup
used by both the grouper and the new resolver (single source of bucket truth),
then add:

```ts
/**
 * The RAW entries behind a plotted point, newest first. In 'raw' the point IS
 * the entry (id match); in 'day'/'week' it is a bucket average, so every raw
 * point whose bucket start equals the point's `at` is returned.
 * Pass the SAME range-filtered list that was grouped.
 */
export function bodyWeightEntriesForPoint(
  points: ProgressPoint[],
  point: ProgressPoint,
  grouping: BodyWeightGrouping
): ProgressPoint[]
```

### Step 3 — data: the write path (`src/data/operations.ts`)

- `logBodyWeight(weightKg: number, measuredAt?: number)` — defaults to `now()`;
  rejects (`null`) an invalid weight **or** a future `measuredAt`.
- New `updateBodyWeightEntry(id, { weightKg, measuredAt })`:
  loads the entry (`repo.bodyWeightEntries.get`), returns `null` for a missing
  entry or invalid input, otherwise writes `weightKg` (rounded), `measuredAt`
  and a fresh `updatedAt`, then `notifyDataChanged()`.

No repository-port change: `EntityStore.get/put` already cover this.

### Step 4 — `src/components/ProgressChart.tsx`

- `selected: number | null` → `selectedId: string | null`; `active` is looked up
  by id, so a vanished point deselects itself.
- New optional prop `renderPointAction?: (point: ProgressPoint) => ReactNode`,
  rendered under the `aria-live` caption only while a point is active.

### Step 5 — `src/components/BodyWeightDialog.tsx` (create **and** edit)

- Props become `{ open, entry?: { weightKg, measuredAt }, latestKg, onSubmit(weightKg, measuredAt), onCancel }`;
  `entry` present ⇒ edit mode (title `Изменить запись`, prefilled from the
  entry), absent ⇒ create mode (title unchanged, weight prefilled from
  `latestKg`, date prefilled with "now").
- Add the labelled `TextField type="datetime-local"` with a `max` of "now"
  (native guard) and `isValidMeasuredAt` as the real gate: Save disabled +
  inline error text while the value is in the future or unparseable.
- Keep the ± stepping, the comma decimal separator, and unit conversion as is.

### Step 6 — `src/components/BodyWeightPointDrawer.tsx` (replaces the history drawer)

Delete `BodyWeightHistoryDrawer.tsx`; the new component takes
`{ open, onClose, entries, grouping, onEdit, onDelete }`, renders the title per
grouping and one row per entry: weight + `formatSessionDate` + a pencil and a
trash icon button (the existing row markup plus the pencil). The delete
`ConfirmDialog` stays inside this component, as today.

### Step 7 — `src/components/BodyWeightSection.tsx` (wiring)

- Drop `historyOpen` and the "История" button; "Записать вес" goes full width.
- Keep `rangeFiltered` as a named value (`filterByRange(points, range, now)`)
  and group *that*, so the resolver can reuse it.
- New state: `actionPoint` (the plotted point whose Drawer is open) and
  `editing` (the raw entry being edited). `entries` is derived per render via
  `bodyWeightEntriesForPoint`; when it becomes empty the Drawer closes.
- Pass `renderPointAction` to the chart; label `Действия с записью` for a single
  entry, `Действия с записями` for a bucket with more than one.
- Save handlers call `logBodyWeight(kg, measuredAt)` / `updateBodyWeightEntry(...)`.

### Step 8 — i18n (`src/i18n/strings.ts`)

Remove `progress.bodyWeight.history`, `.historyTitle`, `.historyEmpty`.
Add `common.edit`, `progress.bodyWeight.pointActions` / `.pointActionsMany`,
`.pointTitle` / `.pointTitleDay` / `.pointTitleWeek`, `.editDialogTitle`,
`.dateField`, `.dateFuture` — RU + EN.

### Step 9 — tests, lint, typecheck

Per section 6 below, then `npm run lint`, `npm run typecheck`, `npm test`.

## 5. Acceptance criteria → steps

| # | Criterion | Steps |
|---|---|---|
| AC1 | The Body Weight card has **no** "История" button and no history screen | 6, 7 |
| AC2 | Tapping a chart point shows the readout **and** an action button | 4, 7 |
| AC3 | The action button opens a Drawer listing the real entries behind that point (1 in `Все`, all of the day/week in a bucket) | 2, 6, 7 |
| AC4 | Each row can be **edited**: weight and date/time, saved to the same entry | 3, 5, 6, 7 |
| AC5 | Each row can be **deleted**, with confirmation | 6, 7 |
| AC6 | A future date is refused (Save disabled + inline error) on create and edit | 1, 5 |
| AC7 | "Записать вес" also offers date/time, prefilled with now | 3, 5, 7 |
| AC8 | After a delete the chart deselects instead of highlighting a neighbour; the Drawer closes when its last entry is gone | 4, 7 |
| AC9 | Volume / Duration charts are visually and behaviourally unchanged | 4 |
| AC10 | Sync and JSON backup keep working with no schema change | 3 (no-op by construction; covered by existing tests) |

## 6. Test strategy

**New / updated unit tests**

- `src/domain/validation.test.ts` — `isValidMeasuredAt`: past ok, exactly now
  ok, future rejected, `NaN` rejected.
- `src/domain/progress.test.ts` — `bodyWeightEntriesForPoint`: raw (id match),
  day bucket returns both same-day entries newest first, week bucket spans
  Mon–Sun, an entry in a neighbouring bucket is excluded, unknown point → `[]`.
- `src/data/operations.test.ts` — `logBodyWeight` with an explicit past
  `measuredAt`; rejection of a future one; `updateBodyWeightEntry` changes
  weight *and* date, bumps `updatedAt`, keeps the id, and returns `null` for an
  unknown id / invalid weight / future date.

**Updated UI tests (`src/app/progress.test.tsx`)**

- Delete the two History-drawer tests; rewrite the "same-day average" test so
  the assertion "both raw entries are still reachable" goes through the point
  Drawer instead of the History list.
- Tap a point → action button → Drawer → `Изменить` → change the weight → the
  header ("Текущий вес") and the point value update.
- Tap a point → Drawer → `Удалить` → confirm → the point count drops and the
  Drawer closes.
- Log a weigh-in with a back-dated date/time → it lands as an earlier point and
  does **not** become "Текущий вес".
- Future date → Save disabled.

**Manual check:** iOS Safari rendering of `datetime-local` (native wheel) inside
the Modal, and the edit dialog stacking above the Drawer.

## 7. Risks and edge cases

- **Two weigh-ins minutes apart in `Все`** land on nearly the same X pixel — the
  wrong twin may be hit. Mitigation: that is precisely what the day/week Drawer
  solves (both are listed with their times); noted, not otherwise handled.
- **Editing a date moves the point** — possibly into another bucket or out of
  the selected range. Handled by deriving everything from live data each render:
  the Drawer closes when its point resolves to nothing, and the chart drops a
  selection whose id disappeared. Covered by AC8's test.
- **`datetime-local` in jsdom** behaves as a plain text input; tests set values
  as `YYYY-MM-DDTHH:mm` strings via `fireEvent.change`. `fromDateTimeLocalValue`
  parses that form as *local* time (ES2015 rule), which is what the buckets use.
- **Clock skew / seconds truncation**: the input has minute precision, so a
  "now" prefill is always `<= Date.now()` and never trips the future check.
- **No undo after delete** — unchanged from today; the `ConfirmDialog` is the
  only guard, which is why it stays.
- **Discoverability**: with the History button gone and no hint text (explicit
  decision), a user who never taps a point will not find the edit path. Flagged,
  accepted.
