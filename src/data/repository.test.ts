import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GymDB } from '@/data/db'
import { createDexieRepository } from '@/data/dexie-repository'
import type { Repository } from '@/data/repository'
import type { BodyWeightEntry, RoutineDay, SetEntry } from '@/domain/types'

// Each test gets an isolated in-memory database (fake-indexeddb from setup).
let db: GymDB
let repo: Repository

beforeEach(() => {
  db = new GymDB(`test-${crypto.randomUUID()}`)
  repo = createDexieRepository(db)
})

afterEach(async () => {
  await db.delete()
})

function day(partial: Partial<RoutineDay> & { id: string; order: number }): RoutineDay {
  return { name: 'Day', updatedAt: 1, ...partial }
}

function set(partial: Partial<SetEntry> & { id: string; createdAt: number }): SetEntry {
  return {
    exerciseLogId: 'log-1',
    weightKg: 0,
    reps: 0,
    durationSec: 0,
    order: 0,
    exerciseName: 'Bench press',
    updatedAt: 1,
    ...partial,
  }
}

describe('Dexie repository port', () => {
  it('lists routine days sorted by order', async () => {
    await repo.routineDays.put(day({ id: 'b', order: 2, name: 'B' }))
    await repo.routineDays.put(day({ id: 'a', order: 0, name: 'A' }))
    await repo.routineDays.put(day({ id: 'c', order: 1, name: 'C' }))

    const ordered = await repo.routineDays.listOrdered()
    expect(ordered.map((d) => d.name)).toEqual(['A', 'C', 'B'])
  })

  it('soft-deletes: removed records disappear from reads but keep a tombstone', async () => {
    await repo.routineDays.put(day({ id: 'a', order: 0 }))
    await repo.routineDays.remove('a')

    expect(await repo.routineDays.get('a')).toBeUndefined()
    expect(await repo.routineDays.list()).toHaveLength(0)

    // Tombstone is retained in the raw table for sync propagation.
    const raw = await db.routineDays.get('a')
    expect(raw?.deleted).toBe(true)
    expect(raw?.updatedAt).toBeGreaterThan(1)
  })

  describe('mostRecentByName (Previous Set support §6.2)', () => {
    it('returns undefined when there is no prior history', async () => {
      expect(await repo.sets.mostRecentByName('Bench press', 1000)).toBeUndefined()
    })

    it('returns the most recent set strictly before the cutoff', async () => {
      await repo.sets.put(set({ id: 's1', createdAt: 100, reps: 5 }))
      await repo.sets.put(set({ id: 's2', createdAt: 300, reps: 8 }))
      await repo.sets.put(set({ id: 's3', createdAt: 900, reps: 12 })) // after cutoff

      const prev = await repo.sets.mostRecentByName('Bench press', 500)
      expect(prev?.id).toBe('s2')
    })

    it('ignores tombstoned sets and other exercise names', async () => {
      await repo.sets.put(set({ id: 's1', createdAt: 100, reps: 5 }))
      await repo.sets.put(set({ id: 's2', createdAt: 200, reps: 8 }))
      await repo.sets.put(set({ id: 'other', createdAt: 250, exerciseName: 'Squat' }))
      await repo.sets.remove('s2')

      const prev = await repo.sets.mostRecentByName('Bench press', 500)
      expect(prev?.id).toBe('s1')
    })

    it('picks the most recent across multiple prior sessions', async () => {
      // Two prior sessions' sets for the same exercise name.
      await repo.sets.put(set({ id: 'old', createdAt: 100, reps: 5 }))
      await repo.sets.put(set({ id: 'newer', createdAt: 400, reps: 6 }))

      const prev = await repo.sets.mostRecentByName('Bench press', 1000)
      expect(prev?.id).toBe('newer')
    })

    it('excludes current-session sets (strictly before the cutoff)', async () => {
      // A set created exactly at the session start must NOT count as "previous".
      await repo.sets.put(set({ id: 'atStart', createdAt: 500 }))
      expect(await repo.sets.mostRecentByName('Bench press', 500)).toBeUndefined()
    })

    it('is rename-safe: matched by denormalised name, not by log id', async () => {
      // Set logged under a different exerciseLogId but the same name is still found.
      await repo.sets.put(set({ id: 'x', exerciseLogId: 'some-other-log', createdAt: 200 }))
      const prev = await repo.sets.mostRecentByName('Bench press', 500)
      expect(prev?.id).toBe('x')
    })
  })

  describe('bodyWeightEntries', () => {
    const entry = (
      partial: Partial<BodyWeightEntry> & { id: string; measuredAt: number }
    ): BodyWeightEntry => ({ weightKg: 78, updatedAt: 1, ...partial })

    it('lists entries oldest-first (chart order)', async () => {
      await repo.bodyWeightEntries.put(entry({ id: 'b', measuredAt: 300 }))
      await repo.bodyWeightEntries.put(entry({ id: 'a', measuredAt: 100 }))
      await repo.bodyWeightEntries.put(entry({ id: 'c', measuredAt: 200 }))

      const ids = (await repo.bodyWeightEntries.listChronological()).map((e) => e.id)
      expect(ids).toEqual(['a', 'c', 'b'])
    })

    it('returns the most recent entry from latest()', async () => {
      await repo.bodyWeightEntries.put(entry({ id: 'a', measuredAt: 100, weightKg: 80 }))
      await repo.bodyWeightEntries.put(entry({ id: 'b', measuredAt: 300, weightKg: 77.5 }))
      expect((await repo.bodyWeightEntries.latest())?.weightKg).toBe(77.5)
    })

    it('has no latest() entry on an empty store', async () => {
      expect(await repo.bodyWeightEntries.latest()).toBeUndefined()
    })

    it('hides tombstoned entries from both reads', async () => {
      await repo.bodyWeightEntries.put(entry({ id: 'a', measuredAt: 100, weightKg: 80 }))
      await repo.bodyWeightEntries.put(entry({ id: 'b', measuredAt: 300, weightKg: 77.5 }))
      await repo.bodyWeightEntries.remove('b')

      expect((await repo.bodyWeightEntries.listChronological()).map((e) => e.id)).toEqual(['a'])
      expect((await repo.bodyWeightEntries.latest())?.id).toBe('a')
      expect(await repo.bodyWeightEntries.get('b')).toBeUndefined()
    })
  })
})
