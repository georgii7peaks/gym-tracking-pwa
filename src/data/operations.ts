// Application operations (use cases) composed over the repository port. This is
// the ONLY write path from the UI: every mutation validates via the domain layer
// and calls notifyDataChanged() so live reads refresh. Multi-entity operations
// (Start a Session, cascade deletes) live here rather than in the generic port.
import { newId, now } from '@/domain/ids'
import { nextOrder } from '@/domain/ordering'
import { startSession } from '@/domain/session'
import { clampReps, clampWeightKg, isValidDuration, sanitizeName } from '@/domain/validation'
import type {
  ExerciseLog,
  Metric,
  RoutineDay,
  RoutineExercise,
  SetEntry,
  WorkoutSession,
} from '@/domain/types'
import type { WeightUnit } from '@/prefs/preferences'
import { notifyDataChanged } from './changes'
import { repository as repo } from './dexie-repository'

// ── Shared reorder helper ────────────────────────────────────────────────────

interface Orderable {
  id: string
  order: number
  updatedAt: number
}

/**
 * Re-sequence `current` to match `orderedIds` (contiguous 0..n-1, §3.3), saving
 * only the records whose position actually changed.
 */
async function applyReorder<T extends Orderable>(
  current: readonly T[],
  orderedIds: readonly string[],
  save: (records: T[]) => Promise<void>
): Promise<void> {
  const byId = new Map(current.map((r) => [r.id, r]))
  const ts = now()
  const changed: T[] = []
  orderedIds.forEach((id, index) => {
    const record = byId.get(id)
    if (record && record.order !== index) {
      changed.push({ ...record, order: index, updatedAt: ts })
    }
  })
  if (changed.length > 0) {
    await save(changed)
    notifyDataChanged()
  }
}

// ── Routine Days ─────────────────────────────────────────────────────────────

export async function createRoutineDay(rawName: string): Promise<RoutineDay | null> {
  const name = sanitizeName(rawName)
  if (!name) return null
  const days = await repo.routineDays.listOrdered()
  const day: RoutineDay = { id: newId(), name, order: nextOrder(days), updatedAt: now() }
  await repo.routineDays.put(day)
  notifyDataChanged()
  return day
}

export async function renameRoutineDay(id: string, rawName: string): Promise<void> {
  const name = sanitizeName(rawName)
  if (!name) return
  const day = await repo.routineDays.get(id)
  if (!day) return
  await repo.routineDays.put({ ...day, name, updatedAt: now() })
  notifyDataChanged()
}

/** Cascade delete a day and its routine exercises (soft-delete tombstones). */
export async function deleteRoutineDay(id: string): Promise<void> {
  const exercises = await repo.routineExercises.byDay(id)
  for (const exercise of exercises) await repo.routineExercises.remove(exercise.id)
  await repo.routineDays.remove(id)
  notifyDataChanged()
}

export async function reorderRoutineDays(orderedIds: readonly string[]): Promise<void> {
  const days = await repo.routineDays.listOrdered()
  await applyReorder(days, orderedIds, (records) => repo.routineDays.bulkPut(records))
}

// ── Routine Exercises ────────────────────────────────────────────────────────

export async function addRoutineExercise(
  dayId: string,
  rawName: string,
  metric: Metric = 'weightReps',
  weightUnit: WeightUnit = 'kg'
): Promise<RoutineExercise | null> {
  const name = sanitizeName(rawName)
  if (!name) return null
  const existing = await repo.routineExercises.byDay(dayId)
  const exercise: RoutineExercise = {
    id: newId(),
    dayId,
    name,
    order: nextOrder(existing),
    metric,
    weightUnit,
    updatedAt: now(),
  }
  await repo.routineExercises.put(exercise)
  notifyDataChanged()
  return exercise
}

export async function renameRoutineExercise(id: string, rawName: string): Promise<void> {
  const name = sanitizeName(rawName)
  if (!name) return
  const exercise = await repo.routineExercises.get(id)
  if (!exercise) return
  await repo.routineExercises.put({ ...exercise, name, updatedAt: now() })
  notifyDataChanged()
}

/** Metric is editable on routine exercises (fixed only once logged, §2). */
export async function setRoutineExerciseMetric(id: string, metric: Metric): Promise<void> {
  const exercise = await repo.routineExercises.get(id)
  if (!exercise) return
  await repo.routineExercises.put({ ...exercise, metric, updatedAt: now() })
  notifyDataChanged()
}

/** Preferred display unit for a weightReps routine exercise (stored kg unchanged). */
export async function setRoutineExerciseWeightUnit(
  id: string,
  weightUnit: WeightUnit
): Promise<void> {
  const exercise = await repo.routineExercises.get(id)
  if (!exercise) return
  await repo.routineExercises.put({ ...exercise, weightUnit, updatedAt: now() })
  notifyDataChanged()
}

export async function deleteRoutineExercise(id: string): Promise<void> {
  await repo.routineExercises.remove(id)
  notifyDataChanged()
}

export async function reorderRoutineExercises(
  dayId: string,
  orderedIds: readonly string[]
): Promise<void> {
  const exercises = await repo.routineExercises.byDay(dayId)
  await applyReorder(exercises, orderedIds, (records) => repo.routineExercises.bulkPut(records))
}

// ── Workout Sessions ─────────────────────────────────────────────────────────

/** Start a Session from a Routine Day (§6.1); persists immediately, returns it. */
export async function startSessionFromDay(dayId: string): Promise<WorkoutSession | null> {
  const day = await repo.routineDays.get(dayId)
  if (!day) return null
  const exercises = await repo.routineExercises.byDay(dayId)
  const { session, logs } = startSession(day, exercises, now())
  await repo.workoutSessions.put(session)
  if (logs.length > 0) await repo.exerciseLogs.bulkPut(logs)
  notifyDataChanged()
  return session
}

export async function updateSessionStartedAt(id: string, startedAt: number): Promise<void> {
  const session = await repo.workoutSessions.get(id)
  if (!session) return
  await repo.workoutSessions.put({ ...session, startedAt, updatedAt: now() })
  notifyDataChanged()
}

/** Cascade delete a session -> its logs -> their sets. */
export async function deleteSession(id: string): Promise<void> {
  const logs = await repo.exerciseLogs.bySession(id)
  for (const log of logs) {
    const sets = await repo.sets.byLog(log.id)
    for (const set of sets) await repo.sets.remove(set.id)
    await repo.exerciseLogs.remove(log.id)
  }
  await repo.workoutSessions.remove(id)
  notifyDataChanged()
}

/** Add a one-off exercise to a session only (does not touch the routine, §5.4). */
export async function addSessionExercise(
  sessionId: string,
  rawName: string,
  metric: Metric,
  weightUnit: WeightUnit = 'kg'
): Promise<ExerciseLog | null> {
  const name = sanitizeName(rawName)
  if (!name) return null
  const existing = await repo.exerciseLogs.bySession(sessionId)
  const log: ExerciseLog = {
    id: newId(),
    sessionId,
    name,
    order: nextOrder(existing),
    metric,
    weightUnit,
    updatedAt: now(),
  }
  await repo.exerciseLogs.put(log)
  notifyDataChanged()
  return log
}

/** Cascade delete an exercise log and its sets (no confirmation, §6.5). */
export async function deleteExerciseLog(id: string): Promise<void> {
  const sets = await repo.sets.byLog(id)
  for (const set of sets) await repo.sets.remove(set.id)
  await repo.exerciseLogs.remove(id)
  notifyDataChanged()
}

export async function reorderExerciseLogs(
  sessionId: string,
  orderedIds: readonly string[]
): Promise<void> {
  const logs = await repo.exerciseLogs.bySession(sessionId)
  await applyReorder(logs, orderedIds, (records) => repo.exerciseLogs.bulkPut(records))
}

// ── Sets ─────────────────────────────────────────────────────────────────────

export interface NewSetInput {
  weightKg: number
  reps: number
  durationSec: number
}

/**
 * Add a set to a log, validated by metric (§3.4): duration must be > 0; weight
 * may be 0; reps clamped to >= 1. Returns null when rejected.
 */
export async function addSet(log: ExerciseLog, input: NewSetInput): Promise<SetEntry | null> {
  if (log.metric === 'duration' && !isValidDuration(input.durationSec)) return null

  const existing = await repo.sets.byLog(log.id)
  const createdAt = now()
  const set: SetEntry = {
    id: newId(),
    exerciseLogId: log.id,
    weightKg: log.metric === 'weightReps' ? clampWeightKg(input.weightKg) : 0,
    reps: log.metric === 'weightReps' ? clampReps(input.reps) : 0,
    durationSec: log.metric === 'duration' ? Math.floor(input.durationSec) : 0,
    order: nextOrder(existing),
    exerciseName: log.name, // denormalised -> powers Previous Set (§6.2)
    createdAt,
    updatedAt: createdAt,
  }
  await repo.sets.put(set)
  notifyDataChanged()
  return set
}

export async function deleteSet(id: string): Promise<void> {
  await repo.sets.remove(id)
  notifyDataChanged()
}

export async function reorderSets(logId: string, orderedIds: readonly string[]): Promise<void> {
  const sets = await repo.sets.byLog(logId)
  await applyReorder(sets, orderedIds, (records) => repo.sets.bulkPut(records))
}

// ── Previous Set (§6.2) ──────────────────────────────────────────────────────

/**
 * The Previous Set for a log: most recent set with the same exercise name whose
 * `createdAt` is strictly before this session started (excludes current-session
 * sets; rename-safe because the match is by denormalised name).
 */
export async function getPreviousSet(
  log: ExerciseLog,
  session: WorkoutSession
): Promise<SetEntry | undefined> {
  return repo.sets.mostRecentByName(log.name, session.startedAt)
}
