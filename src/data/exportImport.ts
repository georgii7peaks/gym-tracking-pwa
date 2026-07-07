// Full-data backup: export to / import from a local JSON file. Covers both
// aggregates — the Routine (Routine Days -> Routine Exercises) and the Workout
// history (Workout Sessions -> Exercise Logs -> Sets). Files from the earlier
// workouts-only format are still importable (parseBackup accepts both).
//
// Import is a MERGE, never a replace: per-record last-write-wins by
// `updatedAt`, the same rule the sync engine uses (syncEngine.ts). The LWW
// compare runs against the raw table rows (tombstones included) so a record
// deleted after the backup was taken is not resurrected by importing it.
// Applied records get a fresh `updatedAt` so the next sync round pushes them
// to the cloud (an old timestamp would fall behind the `lastSyncedAt` cursor
// and the record would never leave this device).
import type { Table } from 'dexie'
import { now } from '@/domain/ids'
import type {
  ExerciseLog,
  Metric,
  RoutineDay,
  RoutineExercise,
  SetEntry,
  SyncMeta,
  WorkoutSession,
} from '@/domain/types'
import type { WeightUnit } from '@/prefs/preferences'
import { GymDB, db as sharedDb } from './db'
import { notifyDataChanged } from './changes'

export const BACKUP_FORMAT = 'gym-tracking-backup'
export const BACKUP_VERSION = 1
/** Pre-routines export format; still accepted by parseBackup for old files. */
export const LEGACY_WORKOUTS_FORMAT = 'gym-tracking-workouts'

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  /** When the file was produced (ms). Informational only. */
  exportedAt: number
  routineDays: RoutineDay[]
  routineExercises: RoutineExercise[]
  workoutSessions: WorkoutSession[]
  exerciseLogs: ExerciseLog[]
  sets: SetEntry[]
}

export interface ImportResult {
  /** File records that added or updated something locally. */
  importedRecords: number
  /** File records that changed nothing (already present and up to date). */
  skippedRecords: number
}

// ── Export ───────────────────────────────────────────────────────────────────

/**
 * Snapshot all LIVE data. Tombstoned records are sync plumbing and stay out of
 * the file (importing them elsewhere would replay deletions); children of
 * tombstoned parents are excluded with them.
 */
export async function exportBackup(database: GymDB = sharedDb): Promise<BackupFile> {
  const routineDays = (await database.routineDays.toArray()).filter((r) => !r.deleted)
  const dayIds = new Set(routineDays.map((d) => d.id))
  const routineExercises = (await database.routineExercises.toArray()).filter(
    (r) => !r.deleted && dayIds.has(r.dayId)
  )

  const workoutSessions = (await database.workoutSessions.toArray()).filter((r) => !r.deleted)
  const sessionIds = new Set(workoutSessions.map((s) => s.id))
  const exerciseLogs = (await database.exerciseLogs.toArray()).filter(
    (r) => !r.deleted && sessionIds.has(r.sessionId)
  )
  const logIds = new Set(exerciseLogs.map((l) => l.id))
  const sets = (await database.sets.toArray()).filter(
    (r) => !r.deleted && logIds.has(r.exerciseLogId)
  )

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now(),
    routineDays,
    routineExercises,
    workoutSessions,
    exerciseLogs,
    sets,
  }
}

// ── Parse / validate ─────────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isMs = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isMetric = (v: unknown): v is Metric => v === 'weightReps' || v === 'duration'
const isWeightUnit = (v: unknown): v is WeightUnit => v === 'kg' || v === 'lb'

// Readers rebuild each record field-by-field (whitelist): unknown fields and a
// stray `deleted: true` in a hand-edited file are dropped, not imported.

function readDay(raw: unknown): RoutineDay | null {
  if (!isRecord(raw)) return null
  const { id, name, order, updatedAt } = raw
  if (!isId(id) || typeof name !== 'string' || !isMs(order) || !isMs(updatedAt)) return null
  return { id, name, order, updatedAt }
}

function readExercise(raw: unknown): RoutineExercise | null {
  if (!isRecord(raw)) return null
  const { id, dayId, name, order, metric, weightUnit, updatedAt } = raw
  if (!isId(id) || !isId(dayId) || typeof name !== 'string') return null
  if (!isMs(order) || !isMetric(metric) || !isMs(updatedAt)) return null
  if (weightUnit !== undefined && !isWeightUnit(weightUnit)) return null
  return { id, dayId, name, order, metric, updatedAt, ...(weightUnit !== undefined && { weightUnit }) }
}

function readSession(raw: unknown): WorkoutSession | null {
  if (!isRecord(raw)) return null
  const { id, name, startedAt, finishedAt, updatedAt } = raw
  if (!isId(id) || typeof name !== 'string' || !isMs(startedAt) || !isMs(updatedAt)) return null
  if (finishedAt !== undefined && !isMs(finishedAt)) return null
  return { id, name, startedAt, updatedAt, ...(finishedAt !== undefined && { finishedAt }) }
}

function readLog(raw: unknown): ExerciseLog | null {
  if (!isRecord(raw)) return null
  const { id, sessionId, name, order, metric, weightUnit, updatedAt } = raw
  if (!isId(id) || !isId(sessionId) || typeof name !== 'string') return null
  if (!isMs(order) || !isMetric(metric) || !isMs(updatedAt)) return null
  if (weightUnit !== undefined && !isWeightUnit(weightUnit)) return null
  return { id, sessionId, name, order, metric, updatedAt, ...(weightUnit !== undefined && { weightUnit }) }
}

function readSet(raw: unknown): SetEntry | null {
  if (!isRecord(raw)) return null
  const { id, exerciseLogId, weightKg, reps, durationSec, order, exerciseName, createdAt, updatedAt, done } = raw
  if (!isId(id) || !isId(exerciseLogId) || typeof exerciseName !== 'string') return null
  if (!isMs(weightKg) || !isMs(reps) || !isMs(durationSec)) return null
  if (!isMs(order) || !isMs(createdAt) || !isMs(updatedAt)) return null
  if (done !== undefined && typeof done !== 'boolean') return null
  return {
    id,
    exerciseLogId,
    weightKg,
    reps,
    durationSec,
    order,
    exerciseName,
    createdAt,
    updatedAt,
    ...(done !== undefined && { done }),
  }
}

function readAll<T>(items: unknown[], read: (raw: unknown) => T | null): T[] | null {
  const out: T[] = []
  for (const item of items) {
    const record = read(item)
    if (!record) return null
    out.push(record)
  }
  return out
}

/**
 * Validate raw file text into a snapshot, or `null` if the file is not a
 * backup (wrong marker/version, malformed records, or children that point
 * outside the file). Accepts both the full backup format and the legacy
 * workouts-only format (which imports with an empty Routine side).
 * All-or-nothing: no partial imports of broken files.
 */
export function parseBackup(text: string): BackupFile | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(raw)) return null

  const isFull = raw.format === BACKUP_FORMAT && raw.version === BACKUP_VERSION
  const isLegacy = raw.format === LEGACY_WORKOUTS_FORMAT && raw.version === 1
  if (!isFull && !isLegacy) return null

  const rawDays = isFull ? raw.routineDays : []
  const rawExercises = isFull ? raw.routineExercises : []
  if (!Array.isArray(rawDays) || !Array.isArray(rawExercises)) return null
  if (!Array.isArray(raw.workoutSessions) || !Array.isArray(raw.exerciseLogs) || !Array.isArray(raw.sets)) {
    return null
  }

  const routineDays = readAll(rawDays, readDay)
  const routineExercises = readAll(rawExercises, readExercise)
  const workoutSessions = readAll(raw.workoutSessions, readSession)
  const exerciseLogs = readAll(raw.exerciseLogs, readLog)
  const sets = readAll(raw.sets, readSet)
  if (!routineDays || !routineExercises || !workoutSessions || !exerciseLogs || !sets) return null

  const dayIds = new Set(routineDays.map((d) => d.id))
  if (routineExercises.some((e) => !dayIds.has(e.dayId))) return null
  const sessionIds = new Set(workoutSessions.map((s) => s.id))
  if (exerciseLogs.some((l) => !sessionIds.has(l.sessionId))) return null
  const logIds = new Set(exerciseLogs.map((l) => l.id))
  if (sets.some((s) => !logIds.has(s.exerciseLogId))) return null

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: isMs(raw.exportedAt) ? raw.exportedAt : 0,
    routineDays,
    routineExercises,
    workoutSessions,
    exerciseLogs,
    sets,
  }
}

// ── Import ───────────────────────────────────────────────────────────────────

/** LWW-merge records into a table; returns how many were applied. */
async function mergeInto<T extends SyncMeta & { id: string }>(
  table: Table<T, string>,
  incoming: readonly T[],
  ts: number
): Promise<number> {
  const applied: T[] = []
  for (const record of incoming) {
    const local = await table.get(record.id)
    if (!local || record.updatedAt > local.updatedAt) {
      applied.push({ ...record, updatedAt: ts })
    }
  }
  if (applied.length > 0) await table.bulkPut(applied)
  return applied.length
}

/**
 * Routine Days carry a GLOBAL contiguous `order` (§3.3) chosen with no
 * knowledge of this device's days, so days new to this device are re-based to
 * append after the local maximum (keeping the file's relative order) — the
 * same rule as the sign-in merge (signInMerge.ts). Days already present here
 * merge by plain LWW like everything else.
 */
async function mergeRoutineDays(
  database: GymDB,
  incoming: readonly RoutineDay[],
  ts: number
): Promise<number> {
  const liveLocal = (await database.routineDays.toArray()).filter((d) => !d.deleted)
  let nextOrder = liveLocal.reduce((max, d) => Math.max(max, d.order), -1) + 1

  const applied: RoutineDay[] = []
  for (const day of [...incoming].sort((a, b) => a.order - b.order)) {
    const local = await database.routineDays.get(day.id)
    if (!local) {
      applied.push({ ...day, order: nextOrder++, updatedAt: ts })
    } else if (day.updatedAt > local.updatedAt) {
      applied.push({ ...day, updatedAt: ts })
    }
  }
  if (applied.length > 0) await database.routineDays.bulkPut(applied)
  return applied.length
}

/** Merge a parsed snapshot into the local store (one transaction). */
export async function importBackup(
  snapshot: BackupFile,
  database: GymDB = sharedDb
): Promise<ImportResult> {
  const ts = now()
  let imported = 0

  await database.transaction(
    'rw',
    [
      database.routineDays,
      database.routineExercises,
      database.workoutSessions,
      database.exerciseLogs,
      database.sets,
    ],
    async () => {
      imported += await mergeRoutineDays(database, snapshot.routineDays, ts)
      imported += await mergeInto(database.routineExercises, snapshot.routineExercises, ts)
      imported += await mergeInto(database.workoutSessions, snapshot.workoutSessions, ts)
      imported += await mergeInto(database.exerciseLogs, snapshot.exerciseLogs, ts)
      imported += await mergeInto(database.sets, snapshot.sets, ts)
    }
  )

  const total =
    snapshot.routineDays.length +
    snapshot.routineExercises.length +
    snapshot.workoutSessions.length +
    snapshot.exerciseLogs.length +
    snapshot.sets.length

  if (imported > 0) notifyDataChanged()
  return { importedRecords: imported, skippedRecords: total - imported }
}
