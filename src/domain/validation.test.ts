import { describe, it, expect } from 'vitest'
import { clampReps, clampWeightKg, isValidDuration, sanitizeName } from './validation'

describe('validation (§3.4)', () => {
  it('trims names and rejects blank/whitespace-only', () => {
    expect(sanitizeName('  Bench press  ')).toBe('Bench press')
    expect(sanitizeName('')).toBeNull()
    expect(sanitizeName('   ')).toBeNull()
  })

  it('rejects non-positive durations, accepts positive', () => {
    expect(isValidDuration(0)).toBe(false)
    expect(isValidDuration(-5)).toBe(false)
    expect(isValidDuration(30)).toBe(true)
    expect(isValidDuration(Number.NaN)).toBe(false)
  })

  it('clamps reps to 1..100 (never below 1)', () => {
    expect(clampReps(0)).toBe(1)
    expect(clampReps(8)).toBe(8)
    expect(clampReps(250)).toBe(100)
    expect(clampReps(7.6)).toBe(8)
  })

  it('allows weight 0 (bodyweight) but never negative', () => {
    expect(clampWeightKg(0)).toBe(0)
    expect(clampWeightKg(62.5)).toBe(62.5)
    expect(clampWeightKg(-10)).toBe(0)
  })
})
