// Weight-unit helpers. The global preference (kg by default) is used as the
// DEFAULT unit when creating a new exercise; the actual display unit is chosen
// per exercise/log (types.ts `weightUnit`). Reading a preference is synchronous.
import { useI18n } from '@/i18n/I18nProvider'
import { getPreference, type WeightUnit } from './preferences'

/** The global default unit + its localized label (default for new exercises). */
export function useWeightUnit(): { unit: WeightUnit; unitLabel: string } {
  const { t } = useI18n()
  const unit = getPreference('weightUnit')
  return { unit, unitLabel: t(unit === 'kg' ? 'unit.kg' : 'unit.lb') }
}

/** Localized labels for both units — for the "unit (kg)" display format. */
export function useUnitLabels(): { kg: string; lb: string } {
  const { t } = useI18n()
  return { kg: t('unit.kg'), lb: t('unit.lb') }
}
