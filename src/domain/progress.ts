// Domain: progress series over time for the Progress tab
// (docs/plans/progress-by-program.md + docs/plans/body-weight-progress.md).
// Two families of series share one point type and one range filter: training
// totals (pure aggregation over ExerciseLog + SetEntry + WorkoutSession, one
// point per Workout Session, then grouped into one series per PROGRAM — the
// Workout Session's snapshotted name) and Body Weight (one point per Body Weight
// Entry, optionally averaged into day/week buckets). Both stay canonical in kg.
import type { BodyWeightEntry, ExerciseLog, Metric, SetEntry, WorkoutSession } from './types'

/**
 * One plotted point. Deliberately neutral (`id`/`at` rather than
 * `sessionId`/`startedAt`) so the same type serves volume, duration and body
 * weight: `id` is the source record's id — or a synthetic bucket key when the
 * point is an average (see groupBodyWeightPoints).
 */
export interface ProgressPoint {
  id: string
  at: number
  value: number
}

/**
 * One program's line on a chart. `program` is the Workout Session NAME — the
 * snapshot Start a Session copies from the Routine Day, since no link back to
 * the day is stored (CONTEXT.md). It is the same "session of the same type"
 * identity prefillFromPreviousSession matches on, with the same consequences:
 * two Routine Days sharing a name merge into one program, and renaming a day
 * splits its history in two (the old name survives, with its data).
 */
export interface ProgramSeries {
  program: string
  /** Oldest first. */
  points: ProgressPoint[]
}

/** A trained program — one row of the Progress tab's filter list. */
export interface TrackedProgram {
  name: string
  lastTrainedAt: number
  sessionCount: number
}

export type ProgressRange = '1m' | '3m' | '6m' | 'all'

const RANGE_DAYS: Record<Exclude<ProgressRange, 'all'>, number> = { '1m': 30, '3m': 90, '6m': 180 }
const DAY_MS = 86_400_000

/** Locale-free compare — a pure domain function must not depend on a collation. */
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * One point per Workout Session: the sum of a per-set contribution over the
 * session's *done* sets whose log matches `metric`. Sessions with no matching
 * done set contribute no point. Points sorted by `startedAt` ascending. Shared
 * by both total builders.
 */
function buildTotalPoints(
  logs: ExerciseLog[],
  sets: SetEntry[],
  sessions: WorkoutSession[],
  metric: Metric,
  contribution: (set: SetEntry) => number
): ProgressPoint[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  // Log id -> its session, for logs of this metric.
  const sessionByLog = new Map<string, WorkoutSession>()
  for (const log of logs) {
    if (log.metric !== metric) continue
    const session = sessionById.get(log.sessionId)
    if (session) sessionByLog.set(log.id, session)
  }

  const bySession = new Map<string, ProgressPoint>()
  for (const set of sets) {
    if (!set.done) continue
    const session = sessionByLog.get(set.exerciseLogId)
    if (!session) continue
    const prev = bySession.get(session.id)
    bySession.set(session.id, {
      id: session.id,
      at: session.startedAt,
      value: (prev?.value ?? 0) + contribution(set),
    })
  }

  return [...bySession.values()].sort((a, b) => a.at - b.at)
}

/** The most recent point of a series (its points are already oldest-first). */
const lastAt = (s: ProgramSeries) => s.points[s.points.length - 1].at

/**
 * Split one chart's points into a series per program. Every point carries its
 * Workout Session's id, so the session's name is the group key. Series come out
 * most-recently-trained first (ties by name), matching buildProgramIndex — the
 * order the colour slots are assigned in.
 */
function groupPointsByProgram(
  points: ProgressPoint[],
  sessions: WorkoutSession[]
): ProgramSeries[] {
  const nameById = new Map(sessions.map((s) => [s.id, s.name]))
  const byProgram = new Map<string, ProgressPoint[]>()
  for (const point of points) {
    const name = nameById.get(point.id)
    if (name === undefined) continue
    const list = byProgram.get(name)
    if (list) list.push(point)
    else byProgram.set(name, [point])
  }

  // buildTotalPoints already sorted, so each group stays oldest-first.
  return [...byProgram.entries()]
    .map(([program, grouped]) => ({ program, points: grouped }))
    .sort((a, b) => lastAt(b) - lastAt(a) || byName(a.program, b.program))
}

/**
 * Total training volume per session: `Σ (weightKg × reps)` over done weightReps
 * sets, in canonical kg — one series per program.
 */
export function buildVolumeSeriesByProgram(
  logs: ExerciseLog[],
  sets: SetEntry[],
  sessions: WorkoutSession[]
): ProgramSeries[] {
  return groupPointsByProgram(
    buildTotalPoints(logs, sets, sessions, 'weightReps', (s) => s.weightKg * s.reps),
    sessions
  )
}

/**
 * Total training duration per session: `Σ durationSec` over done duration sets —
 * one series per program.
 */
export function buildDurationSeriesByProgram(
  logs: ExerciseLog[],
  sets: SetEntry[],
  sessions: WorkoutSession[]
): ProgramSeries[] {
  return groupPointsByProgram(
    buildTotalPoints(logs, sets, sessions, 'duration', (s) => s.durationSec),
    sessions
  )
}

/**
 * Distinct trained programs, most recently trained first (ties by name).
 *
 * Deliberately independent of the range chips and of the current selection: it
 * is the ONLY source of a program's colour slot, so a colour can never move
 * when a program drops out of the visible range.
 *
 * "Trained" = at least one done set, which is exactly "produces at least one
 * plotted point": Metric is exhaustive (weightReps | duration), so every done
 * set lands on either the Volume or the Duration chart.
 */
export function buildProgramIndex(
  logs: ExerciseLog[],
  sets: SetEntry[],
  sessions: WorkoutSession[]
): TrackedProgram[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const sessionByLog = new Map<string, WorkoutSession>()
  for (const log of logs) {
    const session = sessionById.get(log.sessionId)
    if (session) sessionByLog.set(log.id, session)
  }

  // Distinct sessions that actually recorded something.
  const trained = new Map<string, WorkoutSession>()
  for (const set of sets) {
    if (!set.done) continue
    const session = sessionByLog.get(set.exerciseLogId)
    if (session) trained.set(session.id, session)
  }

  const byProgram = new Map<string, TrackedProgram>()
  for (const session of trained.values()) {
    const current = byProgram.get(session.name)
    if (current) {
      current.sessionCount += 1
      current.lastTrainedAt = Math.max(current.lastTrainedAt, session.startedAt)
    } else {
      byProgram.set(session.name, {
        name: session.name,
        lastTrainedAt: session.startedAt,
        sessionCount: 1,
      })
    }
  }

  return [...byProgram.values()].sort(
    (a, b) => b.lastTrainedAt - a.lastTrainedAt || byName(a.name, b.name)
  )
}

/** Range-chip filtering (1M/3M/6M/All); kept pure (nowMs passed in) for tests. */
export function filterByRange(
  points: ProgressPoint[],
  range: ProgressRange,
  nowMs: number
): ProgressPoint[] {
  if (range === 'all') return points
  const cutoff = nowMs - RANGE_DAYS[range] * DAY_MS
  return points.filter((p) => p.at >= cutoff)
}

/**
 * Apply the range chips to every series, dropping any left with no points — an
 * empty series would put a dead entry in the legend. Colour slots come from
 * buildProgramIndex, so dropping a series here never repaints another.
 */
export function filterSeriesByRange(
  series: ProgramSeries[],
  range: ProgressRange,
  nowMs: number
): ProgramSeries[] {
  return series
    .map((s) => ({ program: s.program, points: filterByRange(s.points, range, nowMs) }))
    .filter((s) => s.points.length > 0)
}

// ── Body weight (docs/plans/body-weight-progress.md) ─────────────────────────

/** How the body-weight points are read: raw weigh-ins, or per-bucket averages. */
export type BodyWeightGrouping = 'raw' | 'day' | 'week'

/**
 * One point per Body Weight Entry, oldest first. Returns bare points rather
 * than a ProgressSeries: `Metric` is weightReps|duration and body weight is
 * neither. Values stay canonical kg (display converts).
 */
export function buildBodyWeightSeries(entries: BodyWeightEntry[]): ProgressPoint[] {
  return entries
    .map((e) => ({ id: e.id, at: e.measuredAt, value: e.weightKg }))
    .sort((a, b) => a.at - b.at)
}

/** Local midnight of the day containing `ms` (DST-correct via the Date parts). */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Local start of the ISO week (Monday) containing `ms`. */
function startOfLocalWeek(ms: number): number {
  const d = new Date(ms)
  const daysSinceMonday = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday).getTime()
}

/**
 * The single source of bucket truth: which instant a grouping collapses a
 * weigh-in onto. Shared by the grouper and by bodyWeightEntriesForPoint, so a
 * plotted average and the entries behind it can never disagree.
 */
const BUCKET_START: Record<Exclude<BodyWeightGrouping, 'raw'>, (ms: number) => number> = {
  day: startOfLocalDay,
  week: startOfLocalWeek,
}

/**
 * Collapse points into local day / week buckets, each plotted at its bucket
 * START with the ARITHMETIC MEAN of the weigh-ins inside it (averaging in
 * canonical kg keeps kg and lb consistent). Empty buckets are not gap-filled —
 * a zero would be a lie about body weight. Bucket ids are prefixed so they can
 * never collide with an entry UUID. `'raw'` is a passthrough.
 *
 * Filter by range BEFORE grouping, so a bucket never mixes in weigh-ins from
 * outside the selected range.
 */
export function groupBodyWeightPoints(
  points: ProgressPoint[],
  grouping: BodyWeightGrouping
): ProgressPoint[] {
  if (grouping === 'raw') return points
  const startOf = BUCKET_START[grouping]
  const prefix = grouping === 'day' ? 'd' : 'w'

  const buckets = new Map<number, { sum: number; count: number }>()
  for (const point of points) {
    const bucketStart = startOf(point.at)
    const bucket = buckets.get(bucketStart)
    if (bucket) {
      bucket.sum += point.value
      bucket.count += 1
    } else {
      buckets.set(bucketStart, { sum: point.value, count: 1 })
    }
  }

  return [...buckets.entries()]
    .map(([at, { sum, count }]) => ({ id: `${prefix}-${at}`, at, value: sum / count }))
    .sort((a, b) => a.at - b.at)
}

/**
 * The RAW entries behind a plotted point, newest first. In `'raw'` the point IS
 * the entry (id match); in `'day'`/`'week'` it is a bucket average, so every raw
 * point whose bucket start equals the point's `at` is returned. Empty when the
 * point no longer resolves to anything (it was just deleted, or the grouping
 * changed under it).
 *
 * Pass the SAME range-filtered list that was grouped — resolving against the
 * unfiltered list would list weigh-ins that were never averaged into the point.
 */
export function bodyWeightEntriesForPoint(
  points: ProgressPoint[],
  point: ProgressPoint,
  grouping: BodyWeightGrouping
): ProgressPoint[] {
  if (grouping === 'raw') {
    const match = points.find((p) => p.id === point.id)
    return match ? [match] : []
  }
  const startOf = BUCKET_START[grouping]
  return points.filter((p) => startOf(p.at) === point.at).sort((a, b) => b.at - a.at)
}

/**
 * Change across the PLOTTED (already filtered + grouped) points: last − first.
 * `undefined` with fewer than two points — there is no change to report.
 */
export function bodyWeightDelta(points: ProgressPoint[]): number | undefined {
  if (points.length < 2) return undefined
  return points[points.length - 1].value - points[0].value
}
