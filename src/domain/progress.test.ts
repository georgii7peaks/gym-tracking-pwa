import { describe, it, expect } from 'vitest'
import {
  bodyWeightDelta,
  buildBodyWeightSeries,
  buildDurationSeries,
  buildExerciseIndex,
  buildVolumeSeries,
  filterByRange,
  groupBodyWeightPoints,
} from './progress'
import type { BodyWeightEntry, ExerciseLog, SetEntry, WorkoutSession } from './types'

function session(partial: Partial<WorkoutSession> & { id: string; startedAt: number }): WorkoutSession {
  return { name: 'Day A', updatedAt: 1, ...partial }
}

function log(partial: Partial<ExerciseLog> & { id: string; sessionId: string }): ExerciseLog {
  return { name: 'Bench press', order: 0, metric: 'weightReps', updatedAt: 1, ...partial }
}

function set(partial: Partial<SetEntry> & { id: string; exerciseLogId: string }): SetEntry {
  return {
    weightKg: 0,
    reps: 0,
    durationSec: 0,
    order: 0,
    exerciseName: 'Bench press',
    createdAt: 1,
    done: true,
    updatedAt: 1,
    ...partial,
  }
}

describe('buildVolumeSeries', () => {
  it('sums weight×reps over done sets, one point per session', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 100, reps: 5 }), // 500
      set({ id: 'set2', exerciseLogId: 'l1', weightKg: 60, reps: 10 }), // 600
    ]
    const series = buildVolumeSeries(logs, sets, sessions)
    expect(series.metric).toBe('weightReps')
    expect(series.points).toEqual([{ id: 's1', at: 1000, value: 1100 }])
  })

  it('counts only done sets', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 100, reps: 5, done: true }),
      set({ id: 'set2', exerciseLogId: 'l1', weightKg: 999, reps: 9, done: false }),
    ]
    const series = buildVolumeSeries(logs, sets, sessions)
    expect(series.points).toEqual([{ id: 's1', at: 1000, value: 500 }])
  })

  it('ignores duration sets — only weightReps logs contribute', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [
      log({ id: 'l1', sessionId: 's1', name: 'Bench press', metric: 'weightReps' }),
      log({ id: 'l2', sessionId: 's1', name: 'Plank', metric: 'duration' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 40, reps: 5 }), // 200
      set({ id: 'set2', exerciseLogId: 'l2', durationSec: 60 }), // ignored
    ]
    const series = buildVolumeSeries(logs, sets, sessions)
    expect(series.points).toEqual([{ id: 's1', at: 1000, value: 200 }])
  })

  it('aggregates across multiple exercises within one session', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [
      log({ id: 'l1', sessionId: 's1', name: 'Bench press' }),
      log({ id: 'l2', sessionId: 's1', name: 'Squat' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 60, reps: 5 }), // 300
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 100, reps: 5 }), // 500
    ]
    const series = buildVolumeSeries(logs, sets, sessions)
    expect(series.points).toEqual([{ id: 's1', at: 1000, value: 800 }])
  })

  it('keeps sessions separate and sorts oldest first', () => {
    const sessions = [
      session({ id: 's2', startedAt: 2000 }),
      session({ id: 's1', startedAt: 1000 }),
    ]
    const logs = [
      log({ id: 'l2', sessionId: 's2' }),
      log({ id: 'l1', sessionId: 's1' }),
    ]
    const sets = [
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 100, reps: 5 }), // 500 @ 2000
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 90, reps: 5 }), // 450 @ 1000
    ]
    const series = buildVolumeSeries(logs, sets, sessions)
    expect(series.points).toEqual([
      { id: 's1', at: 1000, value: 450 },
      { id: 's2', at: 2000, value: 500 },
    ])
  })

  it('scopes to a single exercise when a name is given', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [
      log({ id: 'l1', sessionId: 's1', name: 'Bench press' }),
      log({ id: 'l2', sessionId: 's1', name: 'Squat' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 60, reps: 5 }), // 300
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 100, reps: 5 }), // 500
    ]
    const series = buildVolumeSeries(logs, sets, sessions, 'Squat')
    expect(series.points).toEqual([{ id: 's1', at: 1000, value: 500 }])
  })

  it('is empty when no weightReps sets are done', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1', name: 'Plank', metric: 'duration' })]
    const sets = [set({ id: 'set1', exerciseLogId: 'l1', durationSec: 30 })]
    expect(buildVolumeSeries(logs, sets, sessions).points).toEqual([])
  })
})

describe('buildDurationSeries', () => {
  it('sums durationSec over done duration sets, one point per session', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1', name: 'Plank', metric: 'duration' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', durationSec: 30 }),
      set({ id: 'set2', exerciseLogId: 'l1', durationSec: 45 }),
    ]
    const series = buildDurationSeries(logs, sets, sessions)
    expect(series.metric).toBe('duration')
    expect(series.points).toEqual([{ id: 's1', at: 1000, value: 75 }])
  })

  it('counts only done sets and ignores weightReps logs', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [
      log({ id: 'l1', sessionId: 's1', name: 'Plank', metric: 'duration' }),
      log({ id: 'l2', sessionId: 's1', name: 'Bench press', metric: 'weightReps' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', durationSec: 40, done: true }),
      set({ id: 'set2', exerciseLogId: 'l1', durationSec: 999, done: false }),
      set({ id: 'set3', exerciseLogId: 'l2', weightKg: 100, reps: 5 }), // ignored
    ]
    const series = buildDurationSeries(logs, sets, sessions)
    expect(series.points).toEqual([{ id: 's1', at: 1000, value: 40 }])
  })

  it('scopes to a single exercise when a name is given', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [
      log({ id: 'l1', sessionId: 's1', name: 'Plank', metric: 'duration' }),
      log({ id: 'l2', sessionId: 's1', name: 'Wall sit', metric: 'duration' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', durationSec: 60 }),
      set({ id: 'set2', exerciseLogId: 'l2', durationSec: 90 }),
    ]
    const series = buildDurationSeries(logs, sets, sessions, 'Wall sit')
    expect(series.points).toEqual([{ id: 's1', at: 1000, value: 90 }])
  })

  it('is empty when no duration sets are done', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [set({ id: 'set1', exerciseLogId: 'l1', weightKg: 100, reps: 5 })]
    expect(buildDurationSeries(logs, sets, sessions).points).toEqual([])
  })
})

describe('buildExerciseIndex', () => {
  it('excludes exercises with zero done sets', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1', name: 'Untouched' })]
    const sets = [set({ id: 'set1', exerciseLogId: 'l1', done: false })]
    expect(buildExerciseIndex(logs, sets, sessions)).toEqual([])
  })

  it('sorts by most recently trained first', () => {
    const sessions = [
      session({ id: 's1', startedAt: 1000 }),
      session({ id: 's2', startedAt: 2000 }),
    ]
    const logs = [
      log({ id: 'l1', sessionId: 's1', name: 'Squat' }),
      log({ id: 'l2', sessionId: 's2', name: 'Bench press' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1' }),
      set({ id: 'set2', exerciseLogId: 'l2' }),
    ]
    const names = buildExerciseIndex(logs, sets, sessions).map((e) => e.name)
    expect(names).toEqual(['Bench press', 'Squat'])
  })

  it('counts distinct sessions, not logs', () => {
    const sessions = [
      session({ id: 's1', startedAt: 1000 }),
      session({ id: 's2', startedAt: 2000 }),
    ]
    const logs = [
      log({ id: 'l1', sessionId: 's1' }),
      log({ id: 'l2', sessionId: 's1' }),
      log({ id: 'l3', sessionId: 's2' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1' }),
      set({ id: 'set2', exerciseLogId: 'l2' }),
      set({ id: 'set3', exerciseLogId: 'l3' }),
    ]
    const [entry] = buildExerciseIndex(logs, sets, sessions)
    expect(entry.sessionCount).toBe(2)
    expect(entry.lastTrainedAt).toBe(2000)
  })

  it('resolves a mixed-metric name to its most recently trained log', () => {
    const sessions = [
      session({ id: 's1', startedAt: 1000 }),
      session({ id: 's2', startedAt: 2000 }),
    ]
    const logs = [
      log({ id: 'l1', sessionId: 's1', metric: 'duration', name: 'Row' }),
      log({ id: 'l2', sessionId: 's2', metric: 'weightReps', name: 'Row' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', durationSec: 60 }),
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 50, reps: 5 }),
    ]
    const [entry] = buildExerciseIndex(logs, sets, sessions)
    expect(entry.metric).toBe('weightReps')
  })
})

describe('filterByRange', () => {
  const DAY = 86_400_000
  const points = [
    { id: 's40', at: -40 * DAY, value: 1 },
    { id: 's10', at: -10 * DAY, value: 2 },
    { id: 'now', at: 0, value: 3 },
  ]

  it('"all" returns every point unfiltered', () => {
    expect(filterByRange(points, 'all', 0)).toEqual(points)
  })

  it('"1m" drops points older than 30 days', () => {
    expect(filterByRange(points, '1m', 0).map((p) => p.id)).toEqual(['s10', 'now'])
  })

  it('"3m" keeps points within 90 days', () => {
    expect(filterByRange(points, '3m', 0).map((p) => p.id)).toEqual(['s40', 's10', 'now'])
  })

  it('is inclusive of the exact cutoff boundary', () => {
    const boundary = [{ id: 'edge', at: -30 * DAY, value: 1 }]
    expect(filterByRange(boundary, '1m', 0)).toEqual(boundary)
  })
})

// ── Body weight ──────────────────────────────────────────────────────────────

/** Local-time timestamp — buckets are local, so tests must be too. */
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime()

function entry(
  partial: Partial<BodyWeightEntry> & { id: string; measuredAt: number }
): BodyWeightEntry {
  return { weightKg: 78, updatedAt: 1, ...partial }
}

describe('buildBodyWeightSeries', () => {
  it('maps entries to points and sorts oldest first', () => {
    const points = buildBodyWeightSeries([
      entry({ id: 'b', measuredAt: at(2026, 7, 27), weightKg: 77.5 }),
      entry({ id: 'a', measuredAt: at(2026, 7, 20), weightKg: 79 }),
    ])
    expect(points).toEqual([
      { id: 'a', at: at(2026, 7, 20), value: 79 },
      { id: 'b', at: at(2026, 7, 27), value: 77.5 },
    ])
  })

  it('is empty for no entries', () => {
    expect(buildBodyWeightSeries([])).toEqual([])
  })
})

describe('groupBodyWeightPoints', () => {
  it('"raw" returns the input untouched', () => {
    const points = [{ id: 'a', at: at(2026, 7, 27, 8), value: 78 }]
    expect(groupBodyWeightPoints(points, 'raw')).toBe(points)
  })

  it('"day" averages same-day weigh-ins into one point at local midnight', () => {
    const points = [
      { id: 'a', at: at(2026, 7, 27, 7, 30), value: 78 },
      { id: 'b', at: at(2026, 7, 27, 21, 0), value: 79 },
    ]
    expect(groupBodyWeightPoints(points, 'day')).toEqual([
      { id: `d-${at(2026, 7, 27, 0, 0)}`, at: at(2026, 7, 27, 0, 0), value: 78.5 },
    ])
  })

  it('"day" keeps a 23:59 / 00:01 pair straddling midnight in separate buckets', () => {
    const points = [
      { id: 'a', at: at(2026, 7, 27, 23, 59), value: 78 },
      { id: 'b', at: at(2026, 7, 28, 0, 1), value: 80 },
    ]
    const grouped = groupBodyWeightPoints(points, 'day')
    expect(grouped.map((p) => p.value)).toEqual([78, 80])
    expect(grouped.map((p) => p.at)).toEqual([at(2026, 7, 27, 0, 0), at(2026, 7, 28, 0, 0)])
  })

  it('"week" buckets Monday–Sunday and plots at the Monday', () => {
    // Sunday 26 Jul closes the week starting Monday 20 Jul; Monday 27 Jul opens
    // the next one — the boundary case the ISO (Monday-start) rule exists for.
    const points = [
      { id: 'a', at: at(2026, 7, 26, 9), value: 80 },
      { id: 'b', at: at(2026, 7, 27, 9), value: 78 },
      { id: 'c', at: at(2026, 7, 29, 9), value: 76 },
    ]
    expect(groupBodyWeightPoints(points, 'week')).toEqual([
      { id: `w-${at(2026, 7, 20, 0, 0)}`, at: at(2026, 7, 20, 0, 0), value: 80 },
      { id: `w-${at(2026, 7, 27, 0, 0)}`, at: at(2026, 7, 27, 0, 0), value: 77 },
    ])
  })

  it('sorts bucketed output oldest first regardless of input order', () => {
    const points = [
      { id: 'late', at: at(2026, 7, 29), value: 76 },
      { id: 'early', at: at(2026, 7, 21), value: 80 },
    ]
    expect(groupBodyWeightPoints(points, 'day').map((p) => p.value)).toEqual([80, 76])
  })

  it('leaves an empty week as a gap rather than filling it', () => {
    // Nothing weighed in the week of 20 Jul → two points, not three.
    const points = [
      { id: 'a', at: at(2026, 7, 15), value: 80 },
      { id: 'b', at: at(2026, 7, 29), value: 76 },
    ]
    expect(groupBodyWeightPoints(points, 'week')).toHaveLength(2)
  })

  it('is empty for empty input', () => {
    expect(groupBodyWeightPoints([], 'day')).toEqual([])
    expect(groupBodyWeightPoints([], 'week')).toEqual([])
  })
})

describe('bodyWeightDelta', () => {
  it('is undefined with fewer than two points', () => {
    expect(bodyWeightDelta([])).toBeUndefined()
    expect(bodyWeightDelta([{ id: 'a', at: 1, value: 78 }])).toBeUndefined()
  })

  it('is negative for a loss and positive for a gain', () => {
    const loss = [
      { id: 'a', at: 1, value: 80 },
      { id: 'b', at: 2, value: 77.5 },
    ]
    expect(bodyWeightDelta(loss)).toBeCloseTo(-2.5)
    expect(bodyWeightDelta([...loss].reverse().map((p, i) => ({ ...p, at: i })))).toBeCloseTo(2.5)
  })

  it('is computed over grouped points, not raw ones', () => {
    // Two weigh-ins on day 1 (avg 80) and one on day 2 (76) → −4, not −5.
    const raw = [
      { id: 'a', at: at(2026, 7, 27, 8), value: 81 },
      { id: 'b', at: at(2026, 7, 27, 20), value: 79 },
      { id: 'c', at: at(2026, 7, 28, 8), value: 76 },
    ]
    expect(bodyWeightDelta(raw)).toBeCloseTo(-5)
    expect(bodyWeightDelta(groupBodyWeightPoints(raw, 'day'))).toBeCloseTo(-4)
  })
})
