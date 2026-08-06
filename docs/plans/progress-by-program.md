# Plan: Progress by Program (replaces the per-exercise filter)

Status: **implemented**
Date: 2026-08-06

## 1. Goal

Change the unit of analysis on the Progress tab from **exercise** to
**program**. The useful question for someone training on a Push / Pull / Legs
split is "how is my *Legs* program trending against my *Push* program?", not
"how is my bench press trending". The tab's two training totals — Total Volume
and Total Duration — become **multi-series**: one coloured line per program on a
shared pair of axes, with a legend, so programs can be compared at a glance.

This supersedes `docs/plans/progress-total-volume.md`.

## 2. Decisions agreed in the interview

| Decision | Choice |
|---|---|
| What "program" means | **Routine Day** — the existing entity. No new top-level Routine aggregate. |
| Exercise filter | **Removed**, replaced by a program filter. `buildExerciseIndex`, `resolveTrainedEntries`, `TrackedExercise` and `listTrackedExercises` are deleted. |
| Chart shape | **Multi-series**: one line per program + legend. Picking one program narrows to one line. |
| Program identity | **`WorkoutSession.name`** — the snapshot Start a Session copies from the Routine Day. No `routineDayId`, no Dexie migration. |
| Colour assignment | A program's position in the **full program index**, which is independent of the range chips and of the selection. Eight fixed slots, never cycled. |
| Programs beyond 8 | Excluded from the combined view (a footnote says so); still reachable one at a time, drawn in neutral ink. |
| Single series | **No legend**; the chart title stays generic. The filter button directly above already names the selected program. |

## 3. Why identity is the name, not a foreign key

`WorkoutSession` deliberately stores no link back to its Routine Day
(`CONTEXT.md`: *"Key invariant — Workout Sessions are snapshots"*). That
invariant is what guarantees editing a Routine never mutates recorded history.
Grouping by `session.name` respects it and reuses the identity rule
`prefillFromPreviousSession` already applies when it looks for "the previous
session of the same type" (`src/data/operations.ts`).

Accepted consequences, each locked in by a test:

- Two Routine Days sharing a name **merge** into one program.
- Renaming a Routine Day **splits** its history in two; the old name survives
  with its data rather than disappearing.
- A deleted Routine Day keeps the program it already produced.
- The Progress tab reads **no rows from `routineDays`** at all. A day that was
  never trained is therefore not listed — no filter row opens onto an empty
  chart.

## 4. Metric rule

> The program filter chooses which **series** are plotted; it never chooses
> which **charts** exist. Both charts are candidates, and a chart renders iff,
> after the selection and the range filter, at least one series still has at
> least one point.

`Metric` is exhaustive (`weightReps | duration`), so every done set lands on
exactly one chart. A program mixing both appears on both; a pure weightReps
program shows only Volume.

## 5. Palette

Eight categorical slots live in `src/index.css` as `--series-1…8`, with a
separately chosen step per theme. Validated against the app's real chart surface
(`--card`: `#ffffff` light, `#211f18` dark):

- **dark** — lightness band, chroma floor, CVD separation, normal-vision floor
  and contrast all pass.
- **light** — the first four pass (worst adjacent CVD ΔE 9.1; normal-vision
  ΔE 19.6); contrast warns for three slots at 2.2–2.8 : 1.

That contrast warning is not dismissable, so identity never rests on hue alone:
the legend prints each program's name in a text token beside its swatch, and the
swatch carries a `border-border` outline so a pale slot still reads on white.
`ProgressChart` owns no palette — the colour arrives as a prop, which is why the
Body Weight card keeps passing `var(--primary)` and looks unchanged.

## 6. Steps as delivered

1. `src/index.css` — `--series-1…8` under `:root` and `.dark`.
2. `src/components/seriesColors.ts` — `PROGRAM_SLOTS`, `seriesColor(index)`.
3. `src/domain/progress.ts` — `buildTotalSeries` → `buildTotalPoints` (same
   aggregation, minus the exercise scope and the `{metric, points}` wrapper);
   new `groupPointsByProgram`, `buildVolumeSeriesByProgram`,
   `buildDurationSeriesByProgram`, `buildProgramIndex`, `filterSeriesByRange`.
   The Body Weight half is untouched.
4. `src/data/queries.ts` — one `getProgramProgress()` replacing
   `listTrackedExercises` + `getProgressSeries`. Index and both series come from
   the same snapshot, so the index that fixes the colours cannot disagree with
   the series it colours. Also drops the N+1 `loadSetsForLogs` (the page used to
   run it twice per data change) for a single `repo.sets.list()`.
5. `src/components/ProgressChart.tsx` — `points` → `series: ChartSeries[]`, one
   shared pair of axes, legend, `data-series` hook, program-prefixed readout and
   point labels. All gated on one `multi` flag.
6. `src/components/BodyWeightSection.tsx` — one line: pass a single series.
7. `src/i18n/strings.ts` — see §7.
8. `src/app/routes/ProgressPage.tsx` — one live read, colour slots from the
   index, program filter Drawer with swatches / counts / last-trained.

## 7. i18n delta

- Removed: `progress.volume.titleFor`, `progress.duration.titleFor`.
- Retexted: `progress.filter.all`, `progress.filter.button`,
  `progress.empty.hint`.
- Added: `progress.program.sessions`, `progress.program.capped`,
  `progress.legend`.

`progress.program.sessions` puts the count last ("Тренировок: {n}") to sidestep
RU *and* EN plural agreement, which the flat catalog has no machinery for.

## 8. Test strategy

`src/domain/progress.test.ts` — the volume/duration suites keep their arithmetic
cases (the `session()` factory already names every session `Day A`, so each
yields one series). New suites cover grouping by program (different names,
same-name merge, rename split, ordering, name tie-break, orphan logs, undone
sets), `buildProgramIndex` (session counting, exclusion, and the ordering
contract that fixes the colours) and `filterSeriesByRange`.

`src/app/progress.test.tsx` — the two exercise-filter tests are gone. New cases:
one line per program with a legend, no legend for one program, distinct slots,
**colour survives a range change**, same-name merge, rename keeps old history,
Drawer narrows to one line, Drawer row ordering and metadata, untrained day
absent, no-data state, and the English rendering. All 14 body-weight tests pass
unmodified — that was the acceptance criterion for the `ProgressChart` API change.

## 9. Known limitation

Exercise-level progress ("how is my bench press trending") is no longer
available anywhere in the app. That is the deliberate trade of this change, not
an oversight; if it comes back it should be a drill-down *inside* a program
rather than a second top-level filter.
