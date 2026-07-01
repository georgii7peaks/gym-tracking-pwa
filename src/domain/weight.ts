// Weight units (APP_SPECIFICATION.md §7 + §13 fix). Weight is stored canonically
// in KILOGRAMS and converted only at display/edit time — this designs out the
// iOS "conversion drift" bug (§13) and removes any bulk DB rewrite on unit change.
import type { WeightUnit } from '@/prefs/preferences'

const LB_PER_KG = 2.2046226218

export interface WeightUnitConfig {
  /** Stepper increment in the display unit. */
  step: number
  /** Stepper maximum in the display unit. */
  max: number
}

// Per-unit input tuning (§7): kg -> step 2.5, max 500; lb -> step 5, max 1100.
export const WEIGHT_UNITS: Record<WeightUnit, WeightUnitConfig> = {
  kg: { step: 2.5, max: 500 },
  lb: { step: 5, max: 1100 },
}

/** Convert canonical kg to a display-unit numeric value. */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG
}

/** Convert a display-unit value back to canonical kg. */
export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG
}

/**
 * Format a canonical weight for display (§7): whole numbers render without
 * decimals ("60"), non-whole render to one decimal ("62.5"). The unit label is
 * localized separately by the caller.
 */
export function formatWeightValue(kg: number, unit: WeightUnit): string {
  const rounded = Math.round(kgToDisplay(kg, unit) * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/**
 * Read-only weight display in the exercise's chosen unit, with kg in parentheses
 * when that unit is not kg — e.g. "135 lb (61 kg)" for lb, "61 kg" for kg. Unit
 * labels are passed in (localized by the caller).
 */
export function formatWeightDisplay(
  kg: number,
  unit: WeightUnit,
  labels: { kg: string; lb: string }
): string {
  if (unit === 'lb') {
    return `${formatWeightValue(kg, 'lb')} ${labels.lb} (${formatWeightValue(kg, 'kg')} ${labels.kg})`
  }
  return `${formatWeightValue(kg, 'kg')} ${labels.kg}`
}
