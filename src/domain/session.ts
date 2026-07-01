// Start a Session (APP_SPECIFICATION.md §6.1) — the single cross-aggregate copy.
// Copies a Routine Day into a new Workout Session: name + ordered exercises
// (name, metric), with NO stored link back. After this copy the two aggregates
// are fully independent, so later routine edits never touch this session.
import { newId } from './ids'
import type { ExerciseLog, RoutineDay, RoutineExercise, WorkoutSession } from './types'

export interface StartedSession {
  session: WorkoutSession
  logs: ExerciseLog[]
}

export function startSession(
  day: RoutineDay,
  exercises: readonly RoutineExercise[],
  startedAt: number
): StartedSession {
  const session: WorkoutSession = {
    id: newId(),
    name: day.name, // copied from the day; not editable afterwards
    startedAt,
    updatedAt: startedAt,
  }

  const ordered = [...exercises].sort((a, b) => a.order - b.order)
  const logs: ExerciseLog[] = ordered.map((exercise, index) => ({
    id: newId(),
    sessionId: session.id,
    name: exercise.name, // snapshot name
    order: index, // fresh contiguous order 0..n-1
    metric: exercise.metric, // inherited from the routine exercise
    weightUnit: exercise.weightUnit ?? 'kg', // display unit, also copied
    updatedAt: startedAt,
  }))

  return { session, logs }
}
