// Validation rules (APP_SPECIFICATION.md §3.4).
//
// - Names are trimmed; a blank/whitespace-only name is rejected (nothing saved).
// - A duration set of <= 0 seconds is rejected.
// - A weight-reps set with weight 0 is allowed (bodyweight); reps are >= 1.

/** Trim a user-entered name; return null when blank (the create is rejected). */
export function sanitizeName(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** A duration set must be strictly positive. */
export function isValidDuration(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds > 0
}

/** Constrain reps to the UI range 1..100. */
export function clampReps(reps: number): number {
  if (!Number.isFinite(reps)) return 1
  return Math.min(100, Math.max(1, Math.round(reps)))
}

/** Weight may be 0 (bodyweight) but never negative. */
export function clampWeightKg(kg: number): number {
  if (!Number.isFinite(kg) || kg < 0) return 0
  return kg
}

/**
 * A Body Weight Entry must be strictly positive — deliberately NOT clampWeightKg,
 * which allows 0 for bodyweight sets. Soft validation: no upper bound, so a typo
 * is corrected afterwards (edit or delete the entry) rather than refused up front.
 */
export function isValidBodyWeight(kg: number): boolean {
  return Number.isFinite(kg) && kg > 0
}

/** A weigh-in cannot be recorded in the future; any past instant is allowed. */
export function isValidMeasuredAt(ms: number, nowMs: number): boolean {
  return Number.isFinite(ms) && ms <= nowMs
}
