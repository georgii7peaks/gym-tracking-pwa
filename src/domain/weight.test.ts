import { describe, it, expect } from 'vitest'
import {
  displayToKg,
  formatWeightDisplay,
  formatWeightValue,
  kgToDisplay,
  WEIGHT_UNITS,
} from './weight'

describe('weight (§7 + §13 canonical-kg fix)', () => {
  it('kg is stored and displayed 1:1', () => {
    expect(kgToDisplay(60, 'kg')).toBe(60)
    expect(displayToKg(60, 'kg')).toBe(60)
  })

  it('kg <-> lb round-trips without drift (canonical storage)', () => {
    const kg = 62.5
    const asLb = kgToDisplay(kg, 'lb')
    expect(displayToKg(asLb, 'lb')).toBeCloseTo(kg, 6)
  })

  it('formats whole numbers without decimals and non-whole to one decimal', () => {
    expect(formatWeightValue(60, 'kg')).toBe('60')
    expect(formatWeightValue(62.5, 'kg')).toBe('62.5')
    expect(formatWeightValue(0, 'kg')).toBe('0')
  })

  it('exposes per-unit steps and maxes', () => {
    expect(WEIGHT_UNITS.kg).toEqual({ step: 2.5, max: 500 })
    expect(WEIGHT_UNITS.lb).toEqual({ step: 5, max: 1100 })
  })

  it('display format: chosen unit, with kg in parentheses only for lb', () => {
    const labels = { kg: 'кг', lb: 'фунты' }
    // kg -> just kg, no parentheses.
    expect(formatWeightDisplay(60, 'kg', labels)).toBe('60 кг')
    // lb -> pounds first, kg in parentheses.
    expect(formatWeightDisplay(60, 'lb', labels)).toBe('132.3 фунты (60 кг)')
    expect(formatWeightDisplay(0, 'lb', labels)).toBe('0 фунты (0 кг)')
  })
})
