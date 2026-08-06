import { describe, it, expect } from 'vitest'
import {
  bodyWeightDelta,
  bodyWeightEntriesForPoint,
  buildBodyWeightSeries,
  buildDurationSeriesByProgram,
  buildProgramIndex,
  buildVolumeSeriesByProgram,
  filterByRange,
  filterSeriesByRange,
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

describe('buildVolumeSeriesByProgram', () => {
  it('sums weight×reps over done sets, one point per session', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 100, reps: 5 }), // 500
      set({ id: 'set2', exerciseLogId: 'l1', weightKg: 60, reps: 10 }), // 600
    ]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toEqual([
      { program: 'Day A', points: [{ id: 's1', at: 1000, value: 1100 }] },
    ])
  })

  it('counts only done sets', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 100, reps: 5, done: true }),
      set({ id: 'set2', exerciseLogId: 'l1', weightKg: 999, reps: 9, done: false }),
    ]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toEqual([
      { program: 'Day A', points: [{ id: 's1', at: 1000, value: 500 }] },
    ])
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
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toEqual([
      { program: 'Day A', points: [{ id: 's1', at: 1000, value: 200 }] },
    ])
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
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toEqual([
      { program: 'Day A', points: [{ id: 's1', at: 1000, value: 800 }] },
    ])
  })

  it('keeps sessions separate and sorts oldest first', () => {
    const sessions = [session({ id: 's2', startedAt: 2000 }), session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l2', sessionId: 's2' }), log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 100, reps: 5 }), // 500 @ 2000
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 90, reps: 5 }), // 450 @ 1000
    ]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toEqual([
      {
        program: 'Day A',
        points: [
          { id: 's1', at: 1000, value: 450 },
          { id: 's2', at: 2000, value: 500 },
        ],
      },
    ])
  })

  it('is empty when no weightReps sets are done', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1', name: 'Plank', metric: 'duration' })]
    const sets = [set({ id: 'set1', exerciseLogId: 'l1', durationSec: 30 })]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toEqual([])
  })
})

describe('buildDurationSeriesByProgram', () => {
  it('sums durationSec over done duration sets, one point per session', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1', name: 'Plank', metric: 'duration' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', durationSec: 30 }),
      set({ id: 'set2', exerciseLogId: 'l1', durationSec: 45 }),
    ]
    expect(buildDurationSeriesByProgram(logs, sets, sessions)).toEqual([
      { program: 'Day A', points: [{ id: 's1', at: 1000, value: 75 }] },
    ])
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
    expect(buildDurationSeriesByProgram(logs, sets, sessions)).toEqual([
      { program: 'Day A', points: [{ id: 's1', at: 1000, value: 40 }] },
    ])
  })

  it('is empty when no duration sets are done', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [set({ id: 'set1', exerciseLogId: 'l1', weightKg: 100, reps: 5 })]
    expect(buildDurationSeriesByProgram(logs, sets, sessions)).toEqual([])
  })
})

/**
 * Program identity is the Workout Session's snapshotted NAME — there is no link
 * back to the Routine Day (CONTEXT.md). These lock in what that buys and costs.
 */
describe('grouping by program', () => {
  it('splits sessions of different programs into one series each', () => {
    const sessions = [
      session({ id: 's1', startedAt: 1000, name: 'Push' }),
      session({ id: 's2', startedAt: 2000, name: 'Pull' }),
    ]
    const logs = [log({ id: 'l1', sessionId: 's1' }), log({ id: 'l2', sessionId: 's2' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 50, reps: 2 }), // 100
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 50, reps: 4 }), // 200
    ]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toEqual([
      { program: 'Pull', points: [{ id: 's2', at: 2000, value: 200 }] },
      { program: 'Push', points: [{ id: 's1', at: 1000, value: 100 }] },
    ])
  })

  it('merges two Routine Days that share a name into one program', () => {
    // Two distinct days both called "Push": nothing distinguishes their sessions.
    const sessions = [
      session({ id: 's1', startedAt: 1000, name: 'Push' }),
      session({ id: 's2', startedAt: 2000, name: 'Push' }),
    ]
    const logs = [log({ id: 'l1', sessionId: 's1' }), log({ id: 'l2', sessionId: 's2' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 50, reps: 2 }),
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 50, reps: 4 }),
    ]
    const series = buildVolumeSeriesByProgram(logs, sets, sessions)
    expect(series).toHaveLength(1)
    expect(series[0].points).toHaveLength(2)
  })

  it('splits history when a Routine Day is renamed, keeping the old name', () => {
    const sessions = [
      session({ id: 's1', startedAt: 1000, name: 'Push' }),
      session({ id: 's2', startedAt: 2000, name: 'Push v2' }),
    ]
    const logs = [log({ id: 'l1', sessionId: 's1' }), log({ id: 'l2', sessionId: 's2' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 50, reps: 2 }),
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 50, reps: 4 }),
    ]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions).map((s) => s.program)).toEqual([
      'Push v2',
      'Push',
    ])
  })

  it('orders series most-recently-trained first', () => {
    const sessions = [
      session({ id: 's1', startedAt: 1000, name: 'Old' }),
      session({ id: 's2', startedAt: 3000, name: 'New' }),
      session({ id: 's3', startedAt: 2000, name: 'Mid' }),
    ]
    const logs = [
      log({ id: 'l1', sessionId: 's1' }),
      log({ id: 'l2', sessionId: 's2' }),
      log({ id: 'l3', sessionId: 's3' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 1, reps: 1 }),
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 1, reps: 1 }),
      set({ id: 'set3', exerciseLogId: 'l3', weightKg: 1, reps: 1 }),
    ]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions).map((s) => s.program)).toEqual([
      'New',
      'Mid',
      'Old',
    ])
  })

  it('breaks a lastTrainedAt tie by name, deterministically', () => {
    // Deterministic order is the colour contract: the slot is the index here.
    const sessions = [
      session({ id: 's1', startedAt: 1000, name: 'Zebra' }),
      session({ id: 's2', startedAt: 1000, name: 'Alpha' }),
    ]
    const logs = [log({ id: 'l1', sessionId: 's1' }), log({ id: 'l2', sessionId: 's2' })]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 1, reps: 1 }),
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 1, reps: 1 }),
    ]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions).map((s) => s.program)).toEqual([
      'Alpha',
      'Zebra',
    ])
  })

  it('keeps points within a series oldest first', () => {
    const sessions = [
      session({ id: 's2', startedAt: 3000, name: 'Push' }),
      session({ id: 's1', startedAt: 1000, name: 'Push' }),
    ]
    const logs = [log({ id: 'l2', sessionId: 's2' }), log({ id: 'l1', sessionId: 's1' })]
    const sets = [
      set({ id: 'set2', exerciseLogId: 'l2', weightKg: 1, reps: 1 }),
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 1, reps: 1 }),
    ]
    const [series] = buildVolumeSeriesByProgram(logs, sets, sessions)
    expect(series.points.map((p) => p.at)).toEqual([1000, 3000])
  })

  it('ignores a log whose session is missing', () => {
    const logs = [log({ id: 'l1', sessionId: 'gone' })]
    const sets = [set({ id: 'set1', exerciseLogId: 'l1', weightKg: 50, reps: 5 })]
    expect(buildVolumeSeriesByProgram(logs, sets, [])).toEqual([])
    expect(buildProgramIndex(logs, sets, [])).toEqual([])
  })

  it('produces no series for a session whose sets are all undone', () => {
    const sessions = [session({ id: 's1', startedAt: 1000 })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [set({ id: 'set1', exerciseLogId: 'l1', weightKg: 50, reps: 5, done: false })]
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toEqual([])
    expect(buildProgramIndex(logs, sets, sessions)).toEqual([])
  })
})

describe('buildProgramIndex', () => {
  it('counts distinct sessions, not logs, and takes the latest startedAt', () => {
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
    expect(buildProgramIndex(logs, sets, sessions)).toEqual([
      { name: 'Day A', lastTrainedAt: 2000, sessionCount: 2 },
    ])
  })

  it('excludes programs with zero done sets', () => {
    const sessions = [session({ id: 's1', startedAt: 1000, name: 'Untouched' })]
    const logs = [log({ id: 'l1', sessionId: 's1' })]
    const sets = [set({ id: 'set1', exerciseLogId: 'l1', done: false })]
    expect(buildProgramIndex(logs, sets, sessions)).toEqual([])
  })

  it('covers every program in both series lists, in the same order', () => {
    // This is the colour-stability contract: the slot is a program's position
    // here, so the index must never omit or reorder relative to the series.
    const sessions = [
      session({ id: 's1', startedAt: 1000, name: 'Legs' }),
      session({ id: 's2', startedAt: 2000, name: 'Core' }),
    ]
    const logs = [
      log({ id: 'l1', sessionId: 's1', metric: 'weightReps' }),
      log({ id: 'l2', sessionId: 's2', name: 'Plank', metric: 'duration' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 50, reps: 5 }),
      set({ id: 'set2', exerciseLogId: 'l2', durationSec: 60 }),
    ]
    const indexed = buildProgramIndex(logs, sets, sessions).map((p) => p.name)
    const plotted = [
      ...buildVolumeSeriesByProgram(logs, sets, sessions),
      ...buildDurationSeriesByProgram(logs, sets, sessions),
    ].map((s) => s.program)
    expect(indexed).toEqual(['Core', 'Legs'])
    for (const program of plotted) expect(indexed).toContain(program)
  })

  it('lists a mixed-metric program once but plots it on both charts', () => {
    const sessions = [session({ id: 's1', startedAt: 1000, name: 'Full body' })]
    const logs = [
      log({ id: 'l1', sessionId: 's1', metric: 'weightReps' }),
      log({ id: 'l2', sessionId: 's1', name: 'Plank', metric: 'duration' }),
    ]
    const sets = [
      set({ id: 'set1', exerciseLogId: 'l1', weightKg: 50, reps: 5 }),
      set({ id: 'set2', exerciseLogId: 'l2', durationSec: 60 }),
    ]
    expect(buildProgramIndex(logs, sets, sessions)).toEqual([
      { name: 'Full body', lastTrainedAt: 1000, sessionCount: 1 },
    ])
    expect(buildVolumeSeriesByProgram(logs, sets, sessions)).toHaveLength(1)
    expect(buildDurationSeriesByProgram(logs, sets, sessions)).toHaveLength(1)
  })
})

describe('filterSeriesByRange', () => {
  const DAY = 86_400_000
  const now = 100 * DAY

  it('drops a series whose every point falls outside the range', () => {
    const series = [
      { program: 'Recent', points: [{ id: 'a', at: now - 5 * DAY, value: 1 }] },
      { program: 'Stale', points: [{ id: 'b', at: now - 200 * DAY, value: 2 }] },
    ]
    expect(filterSeriesByRange(series, '1m', now).map((s) => s.program)).toEqual(['Recent'])
  })

  it('trims points inside a surviving series', () => {
    const series = [
      {
        program: 'Push',
        points: [
          { id: 'old', at: now - 200 * DAY, value: 1 },
          { id: 'new', at: now - 2 * DAY, value: 2 },
        ],
      },
    ]
    expect(filterSeriesByRange(series, '1m', now)).toEqual([
      { program: 'Push', points: [{ id: 'new', at: now - 2 * DAY, value: 2 }] },
    ])
  })

  it("is a passthrough for 'all'", () => {
    const series = [{ program: 'Push', points: [{ id: 'old', at: now - 900 * DAY, value: 1 }] }]
    expect(filterSeriesByRange(series, 'all', now)).toEqual(series)
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

describe('bodyWeightEntriesForPoint', () => {
  const raw = [
    { id: 'a', at: at(2026, 7, 27, 8), value: 78 },
    { id: 'b', at: at(2026, 7, 27, 20), value: 79 },
    { id: 'c', at: at(2026, 7, 29, 8), value: 76 },
    { id: 'd', at: at(2026, 8, 3, 8), value: 75 }, // next week
  ]

  it('"raw": the point IS the entry (matched by id)', () => {
    expect(bodyWeightEntriesForPoint(raw, raw[2], 'raw')).toEqual([raw[2]])
  })

  it('"day": every weigh-in of that day, newest first', () => {
    const [dayPoint] = groupBodyWeightPoints(raw, 'day')
    expect(bodyWeightEntriesForPoint(raw, dayPoint, 'day')).toEqual([raw[1], raw[0]])
  })

  it('"week": spans Monday–Sunday and excludes a neighbouring bucket', () => {
    const [weekPoint] = groupBodyWeightPoints(raw, 'week')
    // 27 Jul (Mon) … 29 Jul are one week; 3 Aug opens the next one.
    expect(bodyWeightEntriesForPoint(raw, weekPoint, 'week').map((p) => p.id)).toEqual([
      'c',
      'b',
      'a',
    ])
  })

  it('is empty for a point that no longer resolves to anything', () => {
    const deleted = { id: 'gone', at: at(2026, 7, 27, 8), value: 78 }
    expect(bodyWeightEntriesForPoint(raw, deleted, 'raw')).toEqual([])
    expect(bodyWeightEntriesForPoint([], { id: 'd-1', at: 1, value: 78 }, 'day')).toEqual([])
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
