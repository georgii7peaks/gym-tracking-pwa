// Dexie/IndexedDB schema — the single source of truth on every device
// (ADR-0002). Tables mirror the domain entities 1:1.
import Dexie, { type Table } from 'dexie'
import type {
  RoutineDay,
  RoutineExercise,
  WorkoutSession,
  ExerciseLog,
  SetEntry,
} from '@/domain/types'

export class GymDB extends Dexie {
  routineDays!: Table<RoutineDay, string>
  routineExercises!: Table<RoutineExercise, string>
  workoutSessions!: Table<WorkoutSession, string>
  exerciseLogs!: Table<ExerciseLog, string>
  sets!: Table<SetEntry, string>

  constructor(name = 'gym-tracking') {
    super(name)
    // Version 1. Indexes chosen for the queries the app actually runs:
    // ordered lists, child-by-parent lookups, and the Previous Set search
    // (`[exerciseName+createdAt]`). Booleans (`deleted`) are filtered in code,
    // not indexed — IndexedDB does not index boolean/undefined cleanly.
    this.version(1).stores({
      routineDays: 'id, order, updatedAt',
      routineExercises: 'id, dayId, order, updatedAt',
      workoutSessions: 'id, startedAt, updatedAt',
      exerciseLogs: 'id, sessionId, order, updatedAt',
      sets: 'id, exerciseLogId, order, createdAt, updatedAt, [exerciseName+createdAt]',
    })
  }
}

/** Shared singleton used by the app (tests construct their own instance). */
export const db = new GymDB()
