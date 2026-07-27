// Integration tests for the operations layer over the shared repository. The
// Dexie singleton is cleared between tests by the global setup (setup.ts).
import { describe, it, expect } from 'vitest'
import { repository as repo } from './dexie-repository'
import {
  addRoutineExercise,
  addSet,
  applyStarterProgram,
  createRoutineDay,
  deleteBodyWeightEntry,
  deleteRoutineDay,
  deleteSession,
  finishSession,
  getPreviousSet,
  logBodyWeight,
  renameRoutineExercise,
  reorderRoutineDays,
  resumeSession,
  startSessionFromDay,
  updateBodyWeightEntry,
} from './operations'
import { STARTER_PROGRAMS } from '@/domain/starterPrograms'
import type { ExerciseLog } from '@/domain/types'

async function firstLog(sessionId: string): Promise<ExerciseLog> {
  const logs = await repo.exerciseLogs.bySession(sessionId)
  return logs[0]
}

describe('operations — routine editing', () => {
  it('rejects a blank day name (nothing saved)', async () => {
    expect(await createRoutineDay('   ')).toBeNull()
    expect(await repo.routineDays.list()).toHaveLength(0)
  })

  it('appends new days and reorders to a contiguous sequence', async () => {
    const a = await createRoutineDay('A')
    const b = await createRoutineDay('B')
    const c = await createRoutineDay('C')
    expect([a, b, c].every(Boolean)).toBe(true)

    // Move C to the front.
    await reorderRoutineDays([c!.id, a!.id, b!.id])
    const ordered = await repo.routineDays.listOrdered()
    expect(ordered.map((d) => d.name)).toEqual(['C', 'A', 'B'])
    expect(ordered.map((d) => d.order)).toEqual([0, 1, 2])
  })

  it('cascade-deletes a day and its exercises', async () => {
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press')
    await addRoutineExercise(day!.id, 'Lat pulldown')

    await deleteRoutineDay(day!.id)

    expect(await repo.routineDays.get(day!.id)).toBeUndefined()
    expect(await repo.routineExercises.byDay(day!.id)).toHaveLength(0)
  })
})

describe('operations — Start a Session (§6.1) + snapshot independence', () => {
  it('copies day + exercises and stays independent of later routine edits', async () => {
    const day = await createRoutineDay('Day A')
    const ex = await addRoutineExercise(day!.id, 'Bench press', 'weightReps')

    const session = await startSessionFromDay(day!.id)
    expect(session).not.toBeNull()

    const log = await firstLog(session!.id)
    expect(session!.name).toBe('Day A')
    expect(log.name).toBe('Bench press')
    expect(log.metric).toBe('weightReps')
    expect(log.order).toBe(0)

    // Editing the routine afterwards must not change the started session (§2).
    await renameRoutineExercise(ex!.id, 'Incline press')
    expect((await firstLog(session!.id)).name).toBe('Bench press')
  })

  it('copies the per-exercise weight unit into the log', async () => {
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps', 'lb')
    const session = await startSessionFromDay(day!.id)
    expect((await firstLog(session!.id)).weightUnit).toBe('lb')
  })
})

describe('operations — set logging (§3.4)', () => {
  it('allows weight 0, clamps reps to >= 1, stores canonical kg', async () => {
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Squat', 'weightReps')
    const session = await startSessionFromDay(day!.id)
    const log = await firstLog(session!.id)

    const created = await addSet(log, { weightKg: 0, reps: 0, durationSec: 0 })
    expect(created).not.toBeNull()
    expect(created!.weightKg).toBe(0)
    expect(created!.reps).toBe(1) // clamped up from 0
    expect(created!.exerciseName).toBe('Squat')
  })

  it('rejects a non-positive duration set', async () => {
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Plank', 'duration')
    const session = await startSessionFromDay(day!.id)
    const log = await firstLog(session!.id)

    expect(await addSet(log, { weightKg: 0, reps: 0, durationSec: 0 })).toBeNull()
    expect(await addSet(log, { weightKg: 0, reps: 0, durationSec: 45 })).not.toBeNull()
    expect(await repo.sets.byLog(log.id)).toHaveLength(1)
  })
})

describe('operations — Previous Set (§6.2) end-to-end', () => {
  it('finds prior history and excludes current-session sets', async () => {
    // A prior set logged long ago, under the same exercise name.
    await repo.sets.put({
      id: 'prior',
      exerciseLogId: 'old-log',
      weightKg: 60,
      reps: 8,
      durationSec: 0,
      order: 0,
      exerciseName: 'Bench press',
      createdAt: 1000, // far before any session started now
      updatedAt: 1000,
    })

    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps')
    const session = await startSessionFromDay(day!.id)
    const log = await firstLog(session!.id)

    const previous = await getPreviousSet(log, session!)
    expect(previous?.id).toBe('prior')

    // A set logged during the current session must not become "previous".
    await addSet(log, { weightKg: 70, reps: 5, durationSec: 0 })
    expect((await getPreviousSet(log, session!))?.id).toBe('prior')
  })
})

describe('operations — cascade delete a session', () => {
  it('removes the session, its logs and their sets', async () => {
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps')
    const session = await startSessionFromDay(day!.id)
    const log = await firstLog(session!.id)
    await addSet(log, { weightKg: 50, reps: 8, durationSec: 0 })

    await deleteSession(session!.id)

    expect(await repo.workoutSessions.get(session!.id)).toBeUndefined()
    expect(await repo.exerciseLogs.bySession(session!.id)).toHaveLength(0)
    expect(await repo.sets.byLog(log.id)).toHaveLength(0)
  })
})

describe('operations — finish / resume a session', () => {
  it('finishing stamps finishedAt; resuming clears it', async () => {
    const day = await createRoutineDay('Day A')
    const session = await startSessionFromDay(day!.id)
    expect(session!.finishedAt).toBeUndefined()

    await finishSession(session!.id)
    const finished = await repo.workoutSessions.get(session!.id)
    expect(finished!.finishedAt).toBeTypeOf('number')

    await resumeSession(session!.id)
    const resumed = await repo.workoutSessions.get(session!.id)
    expect(resumed!.finishedAt).toBeUndefined()
  })
})

describe('operations — apply a Starter Program (§10, Appendix B)', () => {
  it('inserts the program’s days and exercises, in order, named in the given language', async () => {
    const fatLoss = STARTER_PROGRAMS.find((p) => p.id === 'fatLoss')!

    await applyStarterProgram(fatLoss, 'ru')

    const days = await repo.routineDays.listOrdered()
    expect(days.map((d) => d.name)).toEqual(['Полное тело', 'Полное тело'])
    expect(days.map((d) => d.order)).toEqual([0, 1])

    const dayAExercises = await repo.routineExercises.byDay(days[0].id)
    expect(dayAExercises.map((e) => e.name)).toEqual([
      'Велотренажёр',
      'Приседания с гантелями',
      'Тяга верхнего блока',
      'Жим гантелей на наклонной',
      'Румынская тяга с гантелями',
      'Планка',
    ])
    expect(dayAExercises.map((e) => e.order)).toEqual([0, 1, 2, 3, 4, 5])
    expect(dayAExercises[0].metric).toBe('duration') // Велотренажёр
    expect(dayAExercises[1].metric).toBe('weightReps') // Приседания с гантелями
  })

  it('appends after any existing days rather than replacing them', async () => {
    await createRoutineDay('My own day')
    const strength = STARTER_PROGRAMS.find((p) => p.id === 'strength')!

    await applyStarterProgram(strength, 'en')

    const days = await repo.routineDays.listOrdered()
    expect(days.map((d) => d.name)).toEqual(['My own day', 'Squat & press', 'Deadlift & overhead'])
    expect(days.map((d) => d.order)).toEqual([0, 1, 2])
  })
})

describe('operations — auto-fill from the previous workout of the same type', () => {
  it('copies the prior session’s sets (unchecked) into a repeated workout', async () => {
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps')

    // First workout of this type: log two sets.
    const s1 = await startSessionFromDay(day!.id)
    const log1 = await firstLog(s1!.id)
    await addSet(log1, { weightKg: 60, reps: 8, durationSec: 0 })
    await addSet(log1, { weightKg: 62.5, reps: 6, durationSec: 0 })
    // Backdate so it is unambiguously "prior" to the next session.
    await repo.workoutSessions.put({ ...s1!, startedAt: 1000 })

    // Second workout of the same type: sets pre-populated from the first.
    const s2 = await startSessionFromDay(day!.id)
    const sets = await repo.sets.byLog((await firstLog(s2!.id)).id)
    expect(sets.map((x) => x.weightKg)).toEqual([60, 62.5])
    expect(sets.map((x) => x.reps)).toEqual([8, 6])
    expect(sets.every((x) => x.done === false)).toBe(true)
  })

  it('leaves exercises empty when there is no prior workout of that type', async () => {
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps')
    const s1 = await startSessionFromDay(day!.id)
    expect(await repo.sets.byLog((await firstLog(s1!.id)).id)).toHaveLength(0)
  })
})

describe('operations — body weight', () => {
  it('stores the canonical kg value rounded to 2 decimals', async () => {
    // 173 lb → 78.4707… kg; rounding keeps the error below display precision.
    const entry = await logBodyWeight(78.47070422)
    expect(entry?.weightKg).toBe(78.47)
    expect(await repo.bodyWeightEntries.list()).toHaveLength(1)
  })

  it('rejects a non-positive weight (nothing saved)', async () => {
    expect(await logBodyWeight(0)).toBeNull()
    expect(await logBodyWeight(-5)).toBeNull()
    expect(await logBodyWeight(Number.NaN)).toBeNull()
    expect(await repo.bodyWeightEntries.list()).toHaveLength(0)
  })

  it('creates a separate entry per save, even on the same day', async () => {
    const first = await logBodyWeight(78)
    const second = await logBodyWeight(78.4)
    expect(first!.id).not.toBe(second!.id)
    expect(await repo.bodyWeightEntries.list()).toHaveLength(2)
  })

  it('stamps measuredAt with the save timestamp', async () => {
    const before = Date.now()
    const entry = await logBodyWeight(78)
    expect(entry!.measuredAt).toBeGreaterThanOrEqual(before)
    expect(entry!.measuredAt).toBeLessThanOrEqual(Date.now())
  })

  it('hides a deleted entry from reads (soft delete)', async () => {
    const entry = await logBodyWeight(78)
    await deleteBodyWeightEntry(entry!.id)
    expect(await repo.bodyWeightEntries.listChronological()).toHaveLength(0)
    expect(await repo.bodyWeightEntries.latest()).toBeUndefined()
  })

  it('back-dates an entry when an explicit measuredAt is given', async () => {
    const yesterday = Date.now() - 86_400_000
    const entry = await logBodyWeight(78, yesterday)
    expect(entry!.measuredAt).toBe(yesterday)
    // updatedAt is always "now" — sync is last-write-wins on that field.
    expect(entry!.updatedAt).toBeGreaterThan(yesterday)
  })

  it('rejects a weigh-in dated in the future (nothing saved)', async () => {
    expect(await logBodyWeight(78, Date.now() + 3_600_000)).toBeNull()
    expect(await repo.bodyWeightEntries.list()).toHaveLength(0)
  })

  it('edits weight and date in place, keeping the id and bumping updatedAt', async () => {
    const entry = await logBodyWeight(78, Date.now() - 86_400_000)
    const newDate = Date.now() - 2 * 86_400_000

    const updated = await updateBodyWeightEntry(entry!.id, { weightKg: 76.5, measuredAt: newDate })

    expect(updated!.id).toBe(entry!.id)
    expect(updated!.weightKg).toBe(76.5)
    expect(updated!.measuredAt).toBe(newDate)
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(entry!.updatedAt)
    expect(await repo.bodyWeightEntries.list()).toHaveLength(1)
  })

  it('rejects an edit with an unknown id, an invalid weight or a future date', async () => {
    const entry = await logBodyWeight(78)
    const at = entry!.measuredAt

    expect(await updateBodyWeightEntry('nope', { weightKg: 76, measuredAt: at })).toBeNull()
    expect(await updateBodyWeightEntry(entry!.id, { weightKg: 0, measuredAt: at })).toBeNull()
    expect(
      await updateBodyWeightEntry(entry!.id, { weightKg: 76, measuredAt: Date.now() + 3_600_000 })
    ).toBeNull()

    // The original survives untouched.
    expect((await repo.bodyWeightEntries.get(entry!.id))!.weightKg).toBe(78)
  })
})
