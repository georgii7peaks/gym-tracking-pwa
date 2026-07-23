import { describe, it, expect } from 'vitest'
import {
  buildDurationSeries,
  buildExerciseIndex,
  buildVolumeSeries,
  filterByRange,
} from './progress'
import type { ExerciseLog, SetEntry, WorkoutSession } from './types'

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
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 1100 }])
  })

  it('counts only done sets', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 100, reps: 5, done: true }),
      set({ id: 'set2', exerciseLogId: 'l1', weightKg: 999, reps: 9, done: false }),
    ]
    const series = buildVolumeSeries(logs, sets, sessions)
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 500 }])
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
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 200 }])
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
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 800 }])
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
      { sessionId: 's1', startedAt: 1000, value: 450 },
      { sessionId: 's2', startedAt: 2000, value: 500 },
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
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 500 }])
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
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 75 }])
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
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 40 }])
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
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 90 }])
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
    { sessionId: 's40', startedAt: -40 * DAY, value: 1 },
    { sessionId: 's10', startedAt: -10 * DAY, value: 2 },
    { sessionId: 'now', startedAt: 0, value: 3 },
  ]

  it('"all" returns every point unfiltered', () => {
    expect(filterByRange(points, 'all', 0)).toEqual(points)
  })

  it('"1m" drops points older than 30 days', () => {
    expect(filterByRange(points, '1m', 0).map((p) => p.sessionId)).toEqual(['s10', 'now'])
  })

  it('"3m" keeps points within 90 days', () => {
    expect(filterByRange(points, '3m', 0).map((p) => p.sessionId)).toEqual(['s40', 's10', 'now'])
  })

  it('is inclusive of the exact cutoff boundary', () => {
    const boundary = [{ sessionId: 'edge', startedAt: -30 * DAY, value: 1 }]
    expect(filterByRange(boundary, '1m', 0)).toEqual(boundary)
  })
})
