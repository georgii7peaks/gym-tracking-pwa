import { describe, it, expect } from 'vitest'
import { buildExerciseIndex, buildProgressSeries, filterByRange } from './progress'
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

describe('buildProgressSeries', () => {
  it('counts only done sets', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 100, done: true }),
      set({ id: 'set2', exerciseLogId: 'l1', weightKg: 999, done: false }),
    ]
    const series = buildProgressSeries('Bench press', logs, sets, sessions)
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 100 }])
  })

  it('takes the max weightKg among a session’s done sets', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 60 }),
      set({ id: 'set2', exerciseLogId: 'l1', weightKg: 80 }),
      set({ id: 'set3', exerciseLogId: 'l1', weightKg: 70 }),
    ]
    const series = buildProgressSeries('Bench press', logs, sets, sessions)
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 80 }])
  })

  it('takes the max durationSec for a duration exercise', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1', name: 'Plank', metric: 'duration' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', durationSec: 30 }),
      set({ id: 'set2', exerciseLogId: 'l1', durationSec: 45 }),
    ]
    const series = buildProgressSeries('Plank', logs, sets, sessions)
    expect(series.metric).toBe('duration')
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 45 }])
  })

  it('aggregates multiple logs of the same name within one session', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [
      log({ id: 'l1', sessionId: 's1' }),
      log({ id: 'l2', sessionId: 's1' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 60 }),
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 90 }),
    ]
    const series = buildProgressSeries('Bench press', logs, sets, sessions)
    expect(series.points).toEqual([{ sessionId: 's1', startedAt: 1000, value: 90 }])
  })

  it('resolves mixed metrics to the most recently trained log, excluding the other metric', () => {
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
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 50 }),
    ]
    const series = buildProgressSeries('Row', logs, sets, sessions)
    expect(series.metric).toBe('weightReps')
    expect(series.points).toEqual([{ sessionId: 's2', startedAt: 2000, value: 50 }])
  })

  it('sorts points oldest first regardless of input order', () => {
    const sessions = [
      session({ id: 's2', startedAt: 2000 }),
      session({ id: 's1', startedAt: 1000 }),
    ]
    const logs = [
      log({ id: 'l2', sessionId: 's2' }),
      log({ id: 'l1', sessionId: 's1' }),
    ]
    const sets = [
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 100 }),
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 90 }),
    ]
    const series = buildProgressSeries('Bench press', logs, sets, sessions)
    expect(series.points.map((p) => p.startedAt)).toEqual([1000, 2000])
  })

  it('picks up the weight unit of the most recently trained log', () => {
    const sessions = [
      session({ id: 's1', startedAt: 1000 }),
      session({ id: 's2', startedAt: 2000 }),
    ]
    const logs = [
      log({ id: 'l1', sessionId: 's1', weightUnit: 'kg' }),
      log({ id: 'l2', sessionId: 's2', weightUnit: 'lb' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 60 }),
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 70 }),
    ]
    const series = buildProgressSeries('Bench press', logs, sets, sessions)
    expect(series.weightUnit).toBe('lb')
  })

  it('returns an empty series for an unknown exercise', () => {
    const series = buildProgressSeries('Nope', [], [], [])
    expect(series.points).toEqual([])
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
