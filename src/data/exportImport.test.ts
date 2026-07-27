import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GymDB } from '@/data/db'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  LEGACY_WORKOUTS_FORMAT,
  exportBackup,
  importBackup,
  parseBackup,
  type BackupFile,
} from '@/data/exportImport'
import type {
  BodyWeightEntry,
  ExerciseLog,
  RoutineDay,
  RoutineExercise,
  SetEntry,
  WorkoutSession,
} from '@/domain/types'

// Two isolated in-memory databases per test (fake-indexeddb from setup):
// `source` plays the exporting device, `target` the importing one.
let source: GymDB
let target: GymDB

beforeEach(() => {
  source = new GymDB(`test-src-${crypto.randomUUID()}`)
  target = new GymDB(`test-dst-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await source.delete()
  await target.delete()
})

function day(partial: Partial<RoutineDay> & { id: string }): RoutineDay {
  return { name: 'Push Day', order: 0, updatedAt: 100, ...partial }
}

function exercise(partial: Partial<RoutineExercise> & { id: string; dayId: string }): RoutineExercise {
  return { name: 'Bench press', order: 0, metric: 'weightReps', updatedAt: 100, ...partial }
}

function session(partial: Partial<WorkoutSession> & { id: string }): WorkoutSession {
  return { name: 'Push Day', startedAt: 100, updatedAt: 100, ...partial }
}

function log(partial: Partial<ExerciseLog> & { id: string; sessionId: string }): ExerciseLog {
  return { name: 'Bench press', order: 0, metric: 'weightReps', updatedAt: 100, ...partial }
}

function set(partial: Partial<SetEntry> & { id: string; exerciseLogId: string }): SetEntry {
  return {
    weightKg: 60,
    reps: 8,
    durationSec: 0,
    order: 0,
    exerciseName: 'Bench press',
    createdAt: 100,
    updatedAt: 100,
    ...partial,
  }
}

function bodyWeight(partial: Partial<BodyWeightEntry> & { id: string }): BodyWeightEntry {
  return { weightKg: 78, measuredAt: 100, updatedAt: 100, ...partial }
}

async function seedSource() {
  await source.routineDays.bulkPut([
    day({ id: 'r1' }),
    day({ id: 'r2', order: 1, deleted: true, updatedAt: 200 }),
  ])
  await source.routineExercises.bulkPut([
    exercise({ id: 'e1', dayId: 'r1' }),
    exercise({ id: 'e2', dayId: 'r1', deleted: true, updatedAt: 200 }),
    exercise({ id: 'e3', dayId: 'r2' }), // live child of a tombstoned day
  ])
  await source.workoutSessions.bulkPut([
    session({ id: 's1' }),
    session({ id: 's2', deleted: true, updatedAt: 200 }),
  ])
  await source.exerciseLogs.bulkPut([
    log({ id: 'l1', sessionId: 's1' }),
    log({ id: 'l2', sessionId: 's1', deleted: true, updatedAt: 200 }),
    log({ id: 'l3', sessionId: 's2' }), // live child of a tombstoned session
  ])
  await source.sets.bulkPut([
    set({ id: 'x1', exerciseLogId: 'l1' }),
    set({ id: 'x2', exerciseLogId: 'l1', deleted: true, updatedAt: 200 }),
    set({ id: 'x3', exerciseLogId: 'l2' }), // live child of a tombstoned log
  ])
}

describe('exportBackup', () => {
  it('exports only live records, excluding children of tombstoned parents', async () => {
    await seedSource()
    const snapshot = await exportBackup(source)

    expect(snapshot.format).toBe(BACKUP_FORMAT)
    expect(snapshot.version).toBe(BACKUP_VERSION)
    expect(snapshot.routineDays.map((d) => d.id)).toEqual(['r1'])
    expect(snapshot.routineExercises.map((e) => e.id)).toEqual(['e1'])
    expect(snapshot.workoutSessions.map((s) => s.id)).toEqual(['s1'])
    expect(snapshot.exerciseLogs.map((l) => l.id)).toEqual(['l1'])
    expect(snapshot.sets.map((s) => s.id)).toEqual(['x1'])
  })

  it('exports live body weight entries and drops tombstoned ones', async () => {
    await source.bodyWeightEntries.bulkPut([
      bodyWeight({ id: 'w1', weightKg: 78.5 }),
      bodyWeight({ id: 'w2', deleted: true, updatedAt: 200 }),
    ])
    const snapshot = await exportBackup(source)
    expect(snapshot.bodyWeightEntries.map((e) => e.id)).toEqual(['w1'])
  })
})

describe('parseBackup', () => {
  async function validText(): Promise<string> {
    await seedSource()
    return JSON.stringify(await exportBackup(source))
  }

  it('round-trips its own export', async () => {
    const parsed = parseBackup(await validText())
    expect(parsed).not.toBeNull()
    expect(parsed!.routineDays).toHaveLength(1)
    expect(parsed!.routineExercises).toHaveLength(1)
    expect(parsed!.workoutSessions).toHaveLength(1)
    expect(parsed!.exerciseLogs).toHaveLength(1)
    expect(parsed!.sets).toHaveLength(1)
  })

  it('accepts the legacy workouts-only format with an empty Routine side', () => {
    const legacy = {
      format: LEGACY_WORKOUTS_FORMAT,
      version: 1,
      exportedAt: 500,
      workoutSessions: [session({ id: 's1' })],
      exerciseLogs: [log({ id: 'l1', sessionId: 's1' })],
      sets: [set({ id: 'x1', exerciseLogId: 'l1' })],
    }
    const parsed = parseBackup(JSON.stringify(legacy))
    expect(parsed).not.toBeNull()
    expect(parsed!.routineDays).toEqual([])
    expect(parsed!.routineExercises).toEqual([])
    expect(parsed!.workoutSessions).toHaveLength(1)
  })

  it('rejects non-JSON, wrong format marker, and wrong version', async () => {
    expect(parseBackup('not json')).toBeNull()
    const snapshot = JSON.parse(await validText())
    expect(parseBackup(JSON.stringify({ ...snapshot, format: 'other' }))).toBeNull()
    expect(parseBackup(JSON.stringify({ ...snapshot, version: 99 }))).toBeNull()
  })

  it('rejects malformed records and dangling references', async () => {
    const snapshot = JSON.parse(await validText())

    const badDay = { ...snapshot, routineDays: [{ id: 'r1' }] }
    expect(parseBackup(JSON.stringify(badDay))).toBeNull()

    const badSession = { ...snapshot, workoutSessions: [{ id: 's1' }] }
    expect(parseBackup(JSON.stringify(badSession))).toBeNull()

    const orphanExercise = {
      ...snapshot,
      routineExercises: [...snapshot.routineExercises, exercise({ id: 'e9', dayId: 'missing' })],
    }
    expect(parseBackup(JSON.stringify(orphanExercise))).toBeNull()

    const orphanLog = {
      ...snapshot,
      exerciseLogs: [...snapshot.exerciseLogs, log({ id: 'l9', sessionId: 'missing' })],
    }
    expect(parseBackup(JSON.stringify(orphanLog))).toBeNull()

    const orphanSet = {
      ...snapshot,
      sets: [...snapshot.sets, set({ id: 'x9', exerciseLogId: 'missing' })],
    }
    expect(parseBackup(JSON.stringify(orphanSet))).toBeNull()
  })

  it('strips a smuggled tombstone instead of importing a deletion', async () => {
    const snapshot = JSON.parse(await validText())
    snapshot.routineDays[0].deleted = true
    const parsed = parseBackup(JSON.stringify(snapshot))
    expect(parsed!.routineDays[0].deleted).toBeUndefined()
  })

  it('round-trips body weight entries', async () => {
    await source.bodyWeightEntries.put(bodyWeight({ id: 'w1', weightKg: 78.5, measuredAt: 700 }))
    const parsed = parseBackup(JSON.stringify(await exportBackup(source)))
    expect(parsed!.bodyWeightEntries).toEqual([
      { id: 'w1', weightKg: 78.5, measuredAt: 700, updatedAt: 100 },
    ])
  })

  it('still parses a file written before body weight existed (field absent)', async () => {
    const snapshot = JSON.parse(await validText())
    delete snapshot.bodyWeightEntries
    const parsed = parseBackup(JSON.stringify(snapshot))
    expect(parsed).not.toBeNull()
    expect(parsed!.bodyWeightEntries).toEqual([])
  })

  it('rejects a malformed body weight entry', async () => {
    const snapshot = JSON.parse(await validText())
    expect(parseBackup(JSON.stringify({ ...snapshot, bodyWeightEntries: [{ id: 'w1' }] }))).toBeNull()
  })
})

describe('importBackup', () => {
  async function snapshotFromSource(): Promise<BackupFile> {
    await seedSource()
    return exportBackup(source)
  }

  it('restores a full backup into an empty database', async () => {
    const snapshot = await snapshotFromSource()
    const before = Date.now()
    const result = await importBackup(snapshot, target)

    expect(result).toEqual({ importedRecords: 5, skippedRecords: 0 })
    expect(await target.routineDays.toArray()).toHaveLength(1)
    expect(await target.routineExercises.toArray()).toHaveLength(1)
    expect(await target.workoutSessions.toArray()).toHaveLength(1)
    expect(await target.exerciseLogs.toArray()).toHaveLength(1)
    expect(await target.sets.toArray()).toHaveLength(1)
    // `updatedAt` is bumped so the next sync round pushes imported records.
    const imported = await target.workoutSessions.get('s1')
    expect(imported!.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('re-bases NEW routine days after the local maximum order, keeping file order', async () => {
    await target.routineDays.bulkPut([
      day({ id: 'local-a', name: 'Local A', order: 0 }),
      day({ id: 'local-b', name: 'Local B', order: 1 }),
    ])
    const snapshot: BackupFile = {
      ...(await snapshotFromSource()),
      routineDays: [day({ id: 'r1', order: 1, name: 'Imported 2nd' }), day({ id: 'r0', order: 0, name: 'Imported 1st' })],
      routineExercises: [],
    }

    await importBackup(snapshot, target)

    const days = (await target.routineDays.toArray()).sort((a, b) => a.order - b.order)
    expect(days.map((d) => d.name)).toEqual(['Local A', 'Local B', 'Imported 1st', 'Imported 2nd'])
    expect(days.map((d) => d.order)).toEqual([0, 1, 2, 3])
  })

  it('is a merge: keeps newer local records (LWW) and reports them as skipped', async () => {
    const snapshot = await snapshotFromSource()
    await target.routineDays.put(day({ id: 'r1', name: 'Renamed locally', updatedAt: 999 }))
    await target.workoutSessions.put(session({ id: 's1', updatedAt: 999 }))
    await target.sets.put(set({ id: 'x1', exerciseLogId: 'l1', weightKg: 100, updatedAt: 999 }))

    const result = await importBackup(snapshot, target)

    // Only the routine exercise and the exercise log were missing locally.
    expect(result).toEqual({ importedRecords: 2, skippedRecords: 3 })
    expect((await target.routineDays.get('r1'))!.name).toBe('Renamed locally')
    expect((await target.sets.get('x1'))!.weightKg).toBe(100)
  })

  it('does not resurrect records deleted after the backup was taken', async () => {
    const snapshot = await snapshotFromSource()
    await target.routineDays.put(day({ id: 'r1', deleted: true, updatedAt: 999 }))
    await target.workoutSessions.put(session({ id: 's1', deleted: true, updatedAt: 999 }))

    await importBackup(snapshot, target)

    expect((await target.routineDays.get('r1'))!.deleted).toBe(true)
    expect((await target.workoutSessions.get('s1'))!.deleted).toBe(true)
  })

  it('re-importing the same file is a no-op', async () => {
    const snapshot = await snapshotFromSource()
    await importBackup(snapshot, target)
    const second = await importBackup(snapshot, target)

    expect(second).toEqual({ importedRecords: 0, skippedRecords: 5 })
    expect(await target.routineDays.toArray()).toHaveLength(1)
    expect(await target.sets.toArray()).toHaveLength(1)
  })

  it('imports body weight entries and counts them in the total', async () => {
    await source.bodyWeightEntries.put(bodyWeight({ id: 'w1', weightKg: 78.5 }))
    const snapshot = await snapshotFromSource()

    const result = await importBackup(snapshot, target)

    expect(result).toEqual({ importedRecords: 6, skippedRecords: 0 })
    expect((await target.bodyWeightEntries.get('w1'))!.weightKg).toBe(78.5)
  })

  it('LWW-merges an entry that already exists locally', async () => {
    await source.bodyWeightEntries.put(bodyWeight({ id: 'w1', weightKg: 78.5, updatedAt: 100 }))
    const snapshot = await snapshotFromSource()
    // A newer local edit of the same entry must survive the import.
    await target.bodyWeightEntries.put(bodyWeight({ id: 'w1', weightKg: 80, updatedAt: 999 }))

    const result = await importBackup(snapshot, target)

    expect((await target.bodyWeightEntries.get('w1'))!.weightKg).toBe(80)
    expect(result.skippedRecords).toBe(1)
  })
})
