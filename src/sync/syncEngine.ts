// Explicit push/pull delta sync (Phase 4, ADR-0002): online-only, never
// awaited on a UI path. Runs on sign-in, on foreground while online, and
// after local writes (debounced) — see syncTriggers.ts. Conflict resolution
// is last-write-wins per document by `updatedAt`; deletes are tombstones
// already baked into the domain model, so applying a pulled tombstone is a
// plain bulkPut like any other field change (see repository.ts).
import { collection, doc, getDocs, query, where, writeBatch, type Firestore } from 'firebase/firestore'
import type { Table } from 'dexie'
import { db as localDb } from '@/data/db'
import { notifyDataChanged } from '@/data/changes'
import { now } from '@/domain/ids'
import type {
  BodyWeightEntry,
  ExerciseLog,
  RoutineDay,
  RoutineExercise,
  SetEntry,
  SyncMeta,
  WorkoutSession,
} from '@/domain/types'
import { getPreference, setPreference } from '@/prefs/preferences'
import { setSyncStatus } from './syncStatus'

type SyncableRecord = SyncMeta & { id: string }

// Firestore hard caps a batch at 500 writes; leave headroom.
const BATCH_LIMIT = 450

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function pushCollection<T extends SyncableRecord>(
  firestore: Firestore,
  uid: string,
  collectionName: string,
  table: Table<T, string>,
  sinceMs: number
): Promise<void> {
  const changed = await table.where('updatedAt').above(sinceMs).toArray()
  for (const group of chunk(changed, BATCH_LIMIT)) {
    const batch = writeBatch(firestore)
    for (const record of group) {
      batch.set(doc(firestore, 'users', uid, collectionName, record.id), { ...record })
    }
    await batch.commit()
  }
}

/** Returns whether anything was actually applied to local Dexie. */
async function pullCollection<T extends SyncableRecord>(
  firestore: Firestore,
  uid: string,
  collectionName: string,
  table: Table<T, string>,
  sinceMs: number
): Promise<boolean> {
  const remoteQuery = query(
    collection(firestore, 'users', uid, collectionName),
    where('updatedAt', '>', sinceMs)
  )
  const snapshot = await getDocs(remoteQuery)
  if (snapshot.empty) return false

  const toApply: T[] = []
  for (const docSnap of snapshot.docs) {
    const remote = docSnap.data() as T
    const local = await table.get(remote.id)
    // LWW: apply the remote doc only if it's strictly newer than what's local
    // (push already ran this round, so this device's own docs compare equal
    // and are correctly skipped here, not re-applied).
    if (!local || remote.updatedAt > local.updatedAt) toApply.push(remote)
  }
  if (toApply.length > 0) await table.bulkPut(toApply)
  return toApply.length > 0
}

/**
 * One push-then-pull round for the signed-in user's data. Push runs first so
 * this device's just-written docs are already on the server before the pull
 * query runs against the same `sinceMs` cursor.
 */
export async function runSync(uid: string): Promise<void> {
  setSyncStatus({ state: 'syncing', error: null })
  try {
    const { db: firestore } = await import('@/lib/firebase')
    const sinceMs = getPreference('lastSyncedAt')
    const startedAt = now()

    await pushCollection<RoutineDay>(firestore, uid, 'routineDays', localDb.routineDays, sinceMs)
    await pushCollection<RoutineExercise>(
      firestore,
      uid,
      'routineExercises',
      localDb.routineExercises,
      sinceMs
    )
    await pushCollection<WorkoutSession>(
      firestore,
      uid,
      'workoutSessions',
      localDb.workoutSessions,
      sinceMs
    )
    await pushCollection<ExerciseLog>(firestore, uid, 'exerciseLogs', localDb.exerciseLogs, sinceMs)
    await pushCollection<SetEntry>(firestore, uid, 'sets', localDb.sets, sinceMs)
    await pushCollection<BodyWeightEntry>(
      firestore,
      uid,
      'bodyWeightEntries',
      localDb.bodyWeightEntries,
      sinceMs
    )

    const pulled = [
      await pullCollection<RoutineDay>(firestore, uid, 'routineDays', localDb.routineDays, sinceMs),
      await pullCollection<RoutineExercise>(
        firestore,
        uid,
        'routineExercises',
        localDb.routineExercises,
        sinceMs
      ),
      await pullCollection<WorkoutSession>(
        firestore,
        uid,
        'workoutSessions',
        localDb.workoutSessions,
        sinceMs
      ),
      await pullCollection<ExerciseLog>(firestore, uid, 'exerciseLogs', localDb.exerciseLogs, sinceMs),
      await pullCollection<SetEntry>(firestore, uid, 'sets', localDb.sets, sinceMs),
      await pullCollection<BodyWeightEntry>(
        firestore,
        uid,
        'bodyWeightEntries',
        localDb.bodyWeightEntries,
        sinceMs
      ),
    ]

    setPreference('lastSyncedAt', startedAt)
    // Only notify (and thus only let the debounced write-trigger re-arm) when
    // the pull actually changed local data — otherwise a sync's own
    // notification would keep re-scheduling itself every DEBOUNCE_MS forever.
    if (pulled.some(Boolean)) notifyDataChanged()
    setSyncStatus({ state: 'idle', error: null })
  } catch (error) {
    setSyncStatus({ state: 'error', error: error instanceof Error ? error.message : String(error) })
  }
}
