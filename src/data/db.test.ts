// Schema upgrade guard (docs/plans/body-weight-progress.md §7, first risk).
// Bumping to version(2) runs an automatic upgrade on databases created by v1 —
// on already-installed PWAs, not just fresh installs. Adding a table needs no
// upgrade() callback, but "needs no callback" is exactly the kind of claim that
// deserves a test against a real v1 database.
import { describe, it, expect, afterEach } from 'vitest'
import Dexie from 'dexie'
import { GymDB } from '@/data/db'
import type { WorkoutSession } from '@/domain/types'

let name = ''

afterEach(async () => {
  if (name) await Dexie.delete(name)
  name = ''
})

/** A database exactly as version 1 shipped it — no bodyWeightEntries table. */
function openV1(dbName: string): Dexie & { workoutSessions: Dexie.Table<WorkoutSession, string> } {
  const legacy = new Dexie(dbName)
  legacy.version(1).stores({
    routineDays: 'id, order, updatedAt',
    routineExercises: 'id, dayId, order, updatedAt',
    workoutSessions: 'id, startedAt, updatedAt',
    exerciseLogs: 'id, sessionId, order, updatedAt',
    sets: 'id, exerciseLogId, order, createdAt, updatedAt, [exerciseName+createdAt]',
  })
  return legacy as Dexie & { workoutSessions: Dexie.Table<WorkoutSession, string> }
}

describe('GymDB schema upgrade', () => {
  it('upgrades a v1 database in place: old data survives, the new table works', async () => {
    name = `test-upgrade-${crypto.randomUUID()}`

    const legacy = openV1(name)
    await legacy.workoutSessions.put({ id: 's1', name: 'Push Day', startedAt: 100, updatedAt: 100 })
    legacy.close()

    const upgraded = new GymDB(name)
    try {
      expect(upgraded.verno).toBe(2)
      expect((await upgraded.workoutSessions.get('s1'))!.name).toBe('Push Day')

      await upgraded.bodyWeightEntries.put({
        id: 'w1',
        weightKg: 78.5,
        measuredAt: 200,
        updatedAt: 200,
      })
      expect((await upgraded.bodyWeightEntries.get('w1'))!.weightKg).toBe(78.5)
    } finally {
      upgraded.close()
    }
  })
})
