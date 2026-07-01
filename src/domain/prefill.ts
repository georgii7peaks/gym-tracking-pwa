// Default pre-fill when logging (APP_SPECIFICATION.md §6.3), computed once when
// the Exercise tracking screen opens:
//   1. this log's own last set  ->
//   2. else the Previous Set (§6.2)  ->
//   3. else cold defaults (weight 0, reps 8, 0:30).
// Metric-aware so a duration exercise never seeds a 0:00 (invalid) duration.
import type { Metric, SetEntry } from './types'

export interface PrefillValues {
  weightKg: number
  reps: number
  durationSec: number
}

export const COLD_DEFAULTS: PrefillValues = { weightKg: 0, reps: 8, durationSec: 30 }

export function computePrefill(
  metric: Metric,
  lastSet: SetEntry | undefined,
  previousSet: SetEntry | undefined
): PrefillValues {
  const source = lastSet ?? previousSet

  if (metric === 'duration') {
    const durationSec =
      source && source.durationSec > 0 ? source.durationSec : COLD_DEFAULTS.durationSec
    return { weightKg: 0, reps: COLD_DEFAULTS.reps, durationSec }
  }

  // weightReps
  if (source) {
    return {
      weightKg: source.weightKg,
      reps: source.reps > 0 ? source.reps : COLD_DEFAULTS.reps,
      durationSec: COLD_DEFAULTS.durationSec,
    }
  }
  return { ...COLD_DEFAULTS }
}
