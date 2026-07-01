import { describe, it, expect } from 'vitest'
import { COLD_DEFAULTS, computePrefill } from './prefill'
import type { SetEntry } from './types'

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    id: 's',
    exerciseLogId: 'log',
    weightKg: 0,
    reps: 0,
    durationSec: 0,
    order: 0,
    exerciseName: 'Bench press',
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('pre-fill defaults (§6.3)', () => {
  it('falls back to cold defaults when there is no history', () => {
    expect(computePrefill('weightReps', undefined, undefined)).toEqual(COLD_DEFAULTS)
  })

  it('prefers this log’s last set over the previous set', () => {
    const last = set({ weightKg: 80, reps: 5 })
    const previous = set({ weightKg: 60, reps: 10 })
    const result = computePrefill('weightReps', last, previous)
    expect(result.weightKg).toBe(80)
    expect(result.reps).toBe(5)
  })

  it('uses the previous set when the log has none yet', () => {
    const previous = set({ weightKg: 60, reps: 10 })
    const result = computePrefill('weightReps', undefined, previous)
    expect(result.weightKg).toBe(60)
    expect(result.reps).toBe(10)
  })

  it('seeds duration from history, or the 0:30 cold default', () => {
    expect(computePrefill('duration', undefined, undefined).durationSec).toBe(30)
    const previous = set({ durationSec: 45 })
    expect(computePrefill('duration', undefined, previous).durationSec).toBe(45)
    // A source with no usable duration falls back to the cold default.
    expect(computePrefill('duration', set({ durationSec: 0 }), undefined).durationSec).toBe(30)
  })
})
