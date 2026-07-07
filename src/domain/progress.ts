// Domain: per-exercise progress series (Progress tab, docs/plans/progress-charts.md).
// Pure aggregation over ExerciseLog + SetEntry + WorkoutSession, mirroring the
// composite-query style already used by data/queries.ts.
import type { WeightUnit } from '@/prefs/preferences'
import type { ExerciseLog, Metric, SetEntry, WorkoutSession } from './types'

export interface TrackedExercise {
  name: string
  metric: Metric
  weightUnit?: WeightUnit
  lastTrainedAt: number
  sessionCount: number
}

export interface ProgressPoint {
  sessionId: string
  startedAt: number
  value: number
}

export interface ProgressSeries {
  metric: Metric
  weightUnit?: WeightUnit
  points: ProgressPoint[]
}

export type ProgressRange = '1m' | '3m' | '6m' | 'all'

const RANGE_DAYS: Record<Exclude<ProgressRange, 'all'>, number> = { '1m': 30, '3m': 90, '6m': 180 }
const DAY_MS = 86_400_000

interface TrainedEntry {
  session: WorkoutSession
  doneSets: SetEntry[]
}

/**
 * Logs for one exercise name, resolved to a single metric via "the most
 * recently trained log wins" (mixed-metric assumption): only logs sharing
 * that log's metric are kept, each paired with its session and done sets.
 * Returns `undefined` if the exercise has no done sets at all.
 */
function resolveTrainedEntries(
  name: string,
  logs: ExerciseLog[],
  sets: SetEntry[],
  sessions: WorkoutSession[]
): { metric: Metric; weightUnit: WeightUnit | undefined; entries: TrainedEntry[] } | undefined {
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const doneSetsByLog = new Map<string, SetEntry[]>()
  for (const set of sets) {
    if (!set.done) continue
    const list = doneSetsByLog.get(set.exerciseLogId)
    if (list) list.push(set)
    else doneSetsByLog.set(set.exerciseLogId, [set])
  }

  const candidates = logs
    .filter((log) => log.name === name)
    .map((log) => ({
      log,
      session: sessionById.get(log.sessionId),
      doneSets: doneSetsByLog.get(log.id) ?? [],
    }))
    .filter(
      (c): c is { log: ExerciseLog; session: WorkoutSession; doneSets: SetEntry[] } =>
        c.session !== undefined && c.doneSets.length > 0
    )
  if (candidates.length === 0) return undefined

  const latest = candidates.reduce((a, b) => (b.session.startedAt > a.session.startedAt ? b : a))
  const metric = latest.log.metric
  const entries = candidates
    .filter((c) => c.log.metric === metric)
    .map((c) => ({ session: c.session, doneSets: c.doneSets }))
  return { metric, weightUnit: latest.log.weightUnit, entries }
}

/** A done set's contribution to its session's aggregated value, by metric. */
function setValue(set: SetEntry, metric: Metric): number {
  return metric === 'duration' ? set.durationSec : set.weightKg
}

/** Distinct tracked exercises (>=1 done set), most recently trained first. */
export function buildExerciseIndex(
  logs: ExerciseLog[],
  sets: SetEntry[],
  sessions: WorkoutSession[]
): TrackedExercise[] {
  const names = [...new Set(logs.map((l) => l.name))]
  const index: TrackedExercise[] = []
  for (const name of names) {
    const resolved = resolveTrainedEntries(name, logs, sets, sessions)
    if (!resolved) continue
    const sessionIds = new Set(resolved.entries.map((e) => e.session.id))
    const lastTrainedAt = Math.max(...resolved.entries.map((e) => e.session.startedAt))
    index.push({
      name,
      metric: resolved.metric,
      weightUnit: resolved.weightUnit,
      lastTrainedAt,
      sessionCount: sessionIds.size,
    })
  }
  return index.sort((a, b) => b.lastTrainedAt - a.lastTrainedAt)
}

/** One exercise's progression: max done value per session, oldest first. */
export function buildProgressSeries(
  name: string,
  logs: ExerciseLog[],
  sets: SetEntry[],
  sessions: WorkoutSession[]
): ProgressSeries {
  const resolved = resolveTrainedEntries(name, logs, sets, sessions)
  if (!resolved) return { metric: 'weightReps', points: [] }

  const bySession = new Map<string, ProgressPoint>()
  for (const { session, doneSets } of resolved.entries) {
    const maxValue = Math.max(...doneSets.map((s) => setValue(s, resolved.metric)))
    const existing = bySession.get(session.id)
    bySession.set(session.id, {
      sessionId: session.id,
      startedAt: session.startedAt,
      value: existing ? Math.max(existing.value, maxValue) : maxValue,
    })
  }

  const points = [...bySession.values()].sort((a, b) => a.startedAt - b.startedAt)
  return { metric: resolved.metric, weightUnit: resolved.weightUnit, points }
}

/** Range-chip filtering (1M/3M/6M/All); kept pure (nowMs passed in) for tests. */
export function filterByRange(
  points: ProgressPoint[],
  range: ProgressRange,
  nowMs: number
): ProgressPoint[] {
  if (range === 'all') return points
  const cutoff = nowMs - RANGE_DAYS[range] * DAY_MS
  return points.filter((p) => p.startedAt >= cutoff)
}
