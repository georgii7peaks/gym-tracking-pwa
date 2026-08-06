// Composite reads used by list screens. These aggregate across the repository
// port (sessions -> logs -> sets) so components stay declarative. Reads are
// re-run by useLiveData whenever the operations layer reports a change.
import type {
  ExerciseLog,
  RoutineDay,
  RoutineExercise,
  SetEntry,
  WorkoutSession,
} from '@/domain/types'
import {
  buildBodyWeightSeries,
  buildDurationSeriesByProgram,
  buildProgramIndex,
  buildVolumeSeriesByProgram,
  type ProgramSeries,
  type ProgressPoint,
  type TrackedProgram,
} from '@/domain/progress'
import { repository as repo } from './dexie-repository'

// ── Workouts list (§5.1) ─────────────────────────────────────────────────────

export interface WorkoutSummary {
  session: WorkoutSession
  exerciseCount: number
  totalSets: number
}

export async function listWorkoutSummaries(): Promise<WorkoutSummary[]> {
  const sessions = await repo.workoutSessions.listNewestFirst()
  const summaries: WorkoutSummary[] = []
  for (const session of sessions) {
    const logs = await repo.exerciseLogs.bySession(session.id)
    let totalSets = 0
    for (const log of logs) totalSets += (await repo.sets.byLog(log.id)).length
    summaries.push({ session, exerciseCount: logs.length, totalSets })
  }
  return summaries
}

// ── Routine days list / Start Workout sheet (§5.2, §5.6) ─────────────────────

export interface RoutineDaySummary {
  day: RoutineDay
  exerciseCount: number
  exerciseNames: string[]
}

export async function listRoutineDaySummaries(): Promise<RoutineDaySummary[]> {
  const days = await repo.routineDays.listOrdered()
  const summaries: RoutineDaySummary[] = []
  for (const day of days) {
    const exercises = await repo.routineExercises.byDay(day.id)
    summaries.push({
      day,
      exerciseCount: exercises.length,
      exerciseNames: exercises.map((e) => e.name),
    })
  }
  return summaries
}

// ── Routine Day editor (§5.7) ────────────────────────────────────────────────

export interface RoutineDayEditor {
  day: RoutineDay | undefined
  exercises: RoutineExercise[]
}

export async function getRoutineDayEditor(dayId: string): Promise<RoutineDayEditor> {
  const day = await repo.routineDays.get(dayId)
  const exercises = await repo.routineExercises.byDay(dayId)
  return { day, exercises }
}

// ── Session detail exercise rows (§5.3) ──────────────────────────────────────

export interface ExerciseRow {
  log: ExerciseLog
  setCount: number
  /** Most recent set by createdAt — drives the "last …" status line. */
  lastSet: SetEntry | undefined
}

export async function getExerciseRows(sessionId: string): Promise<ExerciseRow[]> {
  const logs = await repo.exerciseLogs.bySession(sessionId)
  const rows: ExerciseRow[] = []
  for (const log of logs) {
    const sets = await repo.sets.byLog(log.id)
    const lastSet = sets.reduce<SetEntry | undefined>(
      (latest, s) => (!latest || s.createdAt > latest.createdAt ? s : latest),
      undefined
    )
    rows.push({ log, setCount: sets.length, lastSet })
  }
  return rows
}

export interface SessionDetail {
  session: WorkoutSession | undefined
  rows: ExerciseRow[]
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  const session = await repo.workoutSessions.get(sessionId)
  const rows = session ? await getExerciseRows(sessionId) : []
  return { session, rows }
}

// ── Exercise tracking (§5.5) ─────────────────────────────────────────────────

/** The inline Workout screen: a session with each exercise's full set list. */
export interface WorkoutExercise {
  log: ExerciseLog
  sets: SetEntry[]
}

export interface WorkoutScreenData {
  session: WorkoutSession | undefined
  exercises: WorkoutExercise[]
}

export async function getLatestSession(): Promise<WorkoutSession | undefined> {
  return (await repo.workoutSessions.listNewestFirst())[0]
}

export async function getWorkoutScreen(sessionId?: string): Promise<WorkoutScreenData> {
  const session = sessionId ? await repo.workoutSessions.get(sessionId) : await getLatestSession()
  if (!session) return { session: undefined, exercises: [] }
  const logs = await repo.exerciseLogs.bySession(session.id)
  const exercises: WorkoutExercise[] = []
  for (const log of logs) exercises.push({ log, sets: await repo.sets.byLog(log.id) })
  return { session, exercises }
}

export interface TrackingData {
  log: ExerciseLog | undefined
  session: WorkoutSession | undefined
  sets: SetEntry[]
}

export async function getTrackingData(logId: string): Promise<TrackingData> {
  const log = await repo.exerciseLogs.get(logId)
  if (!log) return { log: undefined, session: undefined, sets: [] }
  const session = await repo.workoutSessions.get(log.sessionId)
  const sets = await repo.sets.byLog(logId)
  return { log, session, sets }
}

// ── Progress tab: per-program totals (docs/plans/progress-by-program.md) ─────

export interface ProgramProgress {
  /** The filter list AND the colour order: every trained program, newest first. */
  programs: TrackedProgram[]
  volume: ProgramSeries[]
  duration: ProgramSeries[]
}

/**
 * Everything the Progress tab's training half needs, in ONE read. The program
 * index and both series lists are built from the same snapshot, so the index
 * that fixes the colours can never disagree with the series it colours.
 * Selection and range are applied in the UI over this result — switching the
 * program filter must not re-hit IndexedDB.
 */
export async function getProgramProgress(): Promise<ProgramProgress> {
  const logs = await repo.exerciseLogs.list()
  const sessions = await repo.workoutSessions.list()
  // Every live set in one scan. Sets orphaned by a tombstoned log are ignored
  // downstream (their log is absent from the log -> session map), so this is
  // equivalent to the old per-log loop, minus the N+1.
  const sets = await repo.sets.list()
  return {
    programs: buildProgramIndex(logs, sets, sessions),
    volume: buildVolumeSeriesByProgram(logs, sets, sessions),
    duration: buildDurationSeriesByProgram(logs, sets, sessions),
  }
}

// ── Progress tab: body weight (docs/plans/body-weight-progress.md) ───────────

/**
 * Every Body Weight Entry as a chart point, oldest first. One read serves all
 * three consumers — chart, header (last point) and the History Drawer (points
 * reversed) — and each point's `id` is the entry id, so delete works off it.
 */
export async function getBodyWeightSeries(): Promise<ProgressPoint[]> {
  return buildBodyWeightSeries(await repo.bodyWeightEntries.listChronological())
}
