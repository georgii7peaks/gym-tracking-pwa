// Domain model — pure TypeScript, framework-free (IMPLEMENTATION_PLAN.md §3).
//
// All ids are UUIDs. Every record carries `updatedAt` (ms) and an optional
// `deleted` tombstone so the Phase 4 sync engine can do delta + LWW.
// Weight is stored canonically in KILOGRAMS (§13 fix); display converts.
import type { WeightUnit } from '@/prefs/preferences'

/** What kind of data an exercise records. */
export type Metric = 'weightReps' | 'duration'

/** Fields shared by every syncable record. */
export interface SyncMeta {
  /** Client wall-clock ms of the last write. Drives last-write-wins on sync. */
  updatedAt: number
  /** Soft-delete tombstone; absent/false means live. */
  deleted?: boolean
}

// ── Routine side (editable templates) ───────────────────────────────────────

export interface RoutineDay extends SyncMeta {
  id: string
  name: string
  /** Sort position among all Routine Days; contiguous 0..n-1 (§3.3). */
  order: number
}

export interface RoutineExercise extends SyncMeta {
  id: string
  dayId: string
  name: string
  /** Sort position within its Routine Day. */
  order: number
  metric: Metric
  /**
   * Preferred DISPLAY unit for weight (weightReps only). Weight is always stored
   * in kg on the Set; this only controls how it is entered/shown. Absent = kg.
   */
  weightUnit?: WeightUnit
}

// ── Workout side (logged history, append-only) ──────────────────────────────

export interface WorkoutSession extends SyncMeta {
  id: string
  /** Copied from the Routine Day's name at start; not editable afterwards. */
  name: string
  /** When the workout happened (ms). Editable via the date picker. */
  startedAt: number
}

export interface ExerciseLog extends SyncMeta {
  id: string
  sessionId: string
  /** Snapshot name, copied at creation. */
  name: string
  /** Sort position within its Workout Session. */
  order: number
  /** Read-only after creation. */
  metric: Metric
  /** Preferred display unit (weightReps), copied at creation. Absent = kg. */
  weightUnit?: WeightUnit
}

export interface SetEntry extends SyncMeta {
  id: string
  exerciseLogId: string
  /** Canonical kilograms (§13 fix). Used when metric = weightReps. */
  weightKg: number
  /** Used when metric = weightReps. */
  reps: number
  /** Seconds. Used when metric = duration. */
  durationSec: number
  /** Explicit order (§13 fix) — replaces the iOS timestamp-swap reorder. */
  order: number
  /** Denormalised parent name → powers Previous Set without joins. */
  exerciseName: string
  /** Kept for Previous Set comparison and record-keeping (ms). */
  createdAt: number
}

/** Union of every syncable entity — handy for the generic repository/sync layer. */
export type AnyEntity = RoutineDay | RoutineExercise | WorkoutSession | ExerciseLog | SetEntry

/** The five logical collections, named for tables and Firestore paths. */
export type EntityName =
  'routineDays' | 'routineExercises' | 'workoutSessions' | 'exerciseLogs' | 'sets'
