// Dexie-backed implementation of the repository port (ADR-0002).
import Dexie, { type Table } from 'dexie'
import { now } from '@/domain/ids'
import type { SyncMeta } from '@/domain/types'
import { GymDB, db as sharedDb } from './db'
import type { EntityStore, Repository } from './repository'

/** Build the generic CRUD ops for one table (live-only reads, soft delete). */
function makeStore<T extends SyncMeta & { id: string }>(table: Table<T, string>): EntityStore<T> {
  return {
    async list() {
      return table.filter((r) => !r.deleted).toArray()
    },
    async get(id) {
      const record = await table.get(id)
      return record && !record.deleted ? record : undefined
    },
    async put(record) {
      await table.put(record)
    },
    async bulkPut(records) {
      await table.bulkPut(records)
    },
    async remove(id) {
      const record = await table.get(id)
      if (!record || record.deleted) return
      await table.put({ ...record, deleted: true, updatedAt: now() })
    },
  }
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order

export function createDexieRepository(database: GymDB = sharedDb): Repository {
  const days = makeStore(database.routineDays)
  const routineExercises = makeStore(database.routineExercises)
  const sessions = makeStore(database.workoutSessions)
  const logs = makeStore(database.exerciseLogs)
  const sets = makeStore(database.sets)

  return {
    routineDays: {
      ...days,
      async listOrdered() {
        return (await days.list()).sort(byOrder)
      },
    },

    routineExercises: {
      ...routineExercises,
      async byDay(dayId) {
        const rows = await database.routineExercises.where('dayId').equals(dayId).toArray()
        return rows.filter((r) => !r.deleted).sort(byOrder)
      },
    },

    workoutSessions: {
      ...sessions,
      async listNewestFirst() {
        return (await sessions.list()).sort((a, b) => b.startedAt - a.startedAt)
      },
    },

    exerciseLogs: {
      ...logs,
      async bySession(sessionId) {
        const rows = await database.exerciseLogs.where('sessionId').equals(sessionId).toArray()
        return rows.filter((r) => !r.deleted).sort(byOrder)
      },
    },

    sets: {
      ...sets,
      async byLog(exerciseLogId) {
        const rows = await database.sets.where('exerciseLogId').equals(exerciseLogId).toArray()
        return rows.filter((r) => !r.deleted).sort(byOrder)
      },
      async mostRecentByName(exerciseName, beforeMs) {
        // Compound index [exerciseName+createdAt]; strictly-before upper bound
        // (includeUpper = false) implements `createdAt < startedAt` (§6.2).
        return database.sets
          .where('[exerciseName+createdAt]')
          .between([exerciseName, Dexie.minKey], [exerciseName, beforeMs], true, false)
          .reverse()
          .filter((r) => !r.deleted)
          .first()
      },
    },
  }
}

/** Shared repository instance backed by the singleton Dexie database. */
export const repository: Repository = createDexieRepository()
