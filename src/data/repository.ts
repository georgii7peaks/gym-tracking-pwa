// Repository PORT (IMPLEMENTATION_PLAN.md §2). The domain layer depends only
// on this interface, never on Dexie or Firestore directly. Dexie is the sole
// implementation for now; the Phase 4 sync adapter sits beside it, not in the
// UI path.
import type {
  BodyWeightEntry,
  RoutineDay,
  RoutineExercise,
  WorkoutSession,
  ExerciseLog,
  SetEntry,
} from '@/domain/types'

/**
 * Generic persistence for one entity collection.
 *
 * `list`/`get` return only live (non-tombstoned) records — the tombstone is a
 * sync concern, invisible to the UI. `remove` is a soft delete (sets the
 * tombstone + bumps `updatedAt`) so deletions can propagate to the cloud.
 */
export interface EntityStore<T> {
  /** All live records. Sort order is defined per store (see repository impl). */
  list(): Promise<T[]>
  /** A single live record by id, or `undefined` if missing/tombstoned. */
  get(id: string): Promise<T | undefined>
  /** Insert or replace a record verbatim (caller sets `updatedAt`). */
  put(record: T): Promise<void>
  /** Insert or replace many records in one transaction. */
  bulkPut(records: T[]): Promise<void>
  /** Soft-delete: mark the tombstone and bump `updatedAt`. */
  remove(id: string): Promise<void>
}

export interface Repository {
  routineDays: EntityStore<RoutineDay> & {
    /** Days sorted by `order`. */
    listOrdered(): Promise<RoutineDay[]>
  }

  routineExercises: EntityStore<RoutineExercise> & {
    /** Live exercises for a day, sorted by `order`. */
    byDay(dayId: string): Promise<RoutineExercise[]>
  }

  workoutSessions: EntityStore<WorkoutSession> & {
    /** Sessions newest-first (by `startedAt` desc). */
    listNewestFirst(): Promise<WorkoutSession[]>
  }

  exerciseLogs: EntityStore<ExerciseLog> & {
    /** Live logs for a session, sorted by `order`. */
    bySession(sessionId: string): Promise<ExerciseLog[]>
  }

  sets: EntityStore<SetEntry> & {
    /** Live sets for a log, sorted by `order`. */
    byLog(exerciseLogId: string): Promise<SetEntry[]>
    /**
     * Previous Set support (§6.2): the most recent live set whose
     * `exerciseName` matches and whose `createdAt` is strictly before
     * `beforeMs`, or `undefined` if there is no prior history.
     */
    mostRecentByName(exerciseName: string, beforeMs: number): Promise<SetEntry | undefined>
  }

  bodyWeightEntries: EntityStore<BodyWeightEntry> & {
    /** Live entries oldest-first (chart order). */
    listChronological(): Promise<BodyWeightEntry[]>
    /** Most recent live entry, or undefined — prefills the entry form. */
    latest(): Promise<BodyWeightEntry | undefined>
  }
}
