import { describe, it, expect } from 'vitest'
import { startSession } from './session'
import type { RoutineDay, RoutineExercise } from './types'

function day(partial: Partial<RoutineDay> = {}): RoutineDay {
  return { id: 'day-1', name: 'Day A — Upper', order: 0, updatedAt: 1, ...partial }
}

function exercise(
  partial: Partial<RoutineExercise> & { id: string; order: number }
): RoutineExercise {
  return {
    dayId: 'day-1',
    name: 'Exercise',
    metric: 'weightReps',
    updatedAt: 1,
    ...partial,
  }
}

describe('Start a Session (§6.1)', () => {
  it('copies the day name and ordered exercises (name + metric) into logs', () => {
    const exercises = [
      exercise({ id: 'e2', order: 1, name: 'Lat pulldown', metric: 'weightReps' }),
      exercise({ id: 'e1', order: 0, name: 'Bike', metric: 'duration' }),
    ]
    const { session, logs } = startSession(day(), exercises, 1000)

    expect(session.name).toBe('Day A — Upper')
    expect(session.startedAt).toBe(1000)

    // Copied in the day's exercise order, with fresh contiguous 0..n-1 order.
    expect(logs.map((l) => l.name)).toEqual(['Bike', 'Lat pulldown'])
    expect(logs.map((l) => l.order)).toEqual([0, 1])
    expect(logs.map((l) => l.metric)).toEqual(['duration', 'weightReps'])
  })

  it('copies the per-exercise display unit, defaulting to kg', () => {
    const exercises = [
      exercise({ id: 'e1', order: 0, metric: 'weightReps', weightUnit: 'lb' }),
      exercise({ id: 'e2', order: 1, metric: 'weightReps' }), // no unit -> kg
    ]
    const { logs } = startSession(day(), exercises, 1000)
    expect(logs.map((l) => l.weightUnit)).toEqual(['lb', 'kg'])
  })

  it('links each log to the session but stores no link back to the day', () => {
    const { session, logs } = startSession(day(), [exercise({ id: 'e1', order: 0 })], 1000)
    expect(logs[0].sessionId).toBe(session.id)
    // Nothing on the session references the source day.
    expect(session).not.toHaveProperty('dayId')
  })

  it('produces an empty session when the day has no exercises', () => {
    const { session, logs } = startSession(day(), [], 1000)
    expect(session.name).toBe('Day A — Upper')
    expect(logs).toEqual([])
  })
})
