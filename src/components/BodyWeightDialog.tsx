// Body Weight entry form — one dialog for both create and edit
// (docs/plans/body-weight-point-actions.md step 5). A numeric field plus ± fine
// tuning, PREFILLED with the last saved weight so a typical weigh-in is one tap
// on ± and Save, and a date/time field so a forgotten weigh-in can be
// back-dated (and a wrong one re-dated). Entry is in the Settings unit; the
// value is converted back to canonical kg on save (domain/weight.ts rule).
import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { TextField } from './ui/TextField'
import { useI18n } from '@/i18n/I18nProvider'
import { useWeightUnit } from '@/prefs/useWeightUnit'
import { displayToKg, kgToDisplay } from '@/domain/weight'
import { isValidMeasuredAt } from '@/domain/validation'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/datetime'
import type { WeightUnit } from '@/prefs/preferences'

interface BodyWeightDialogProps {
  open: boolean
  /** Present = edit mode: the entry being corrected, prefilling both fields. */
  entry?: { weightKg: number; measuredAt: number }
  /** Latest entry in canonical kg — prefills a CREATE. Undefined = first ever. */
  latestKg: number | undefined
  onSubmit: (weightKg: number, measuredAt: number) => void
  onCancel: () => void
}

/** Fine-tuning step in the DISPLAY unit: 0.1 kg / 0.2 lb (roughly equivalent). */
const STEP: Record<WeightUnit, number> = { kg: 0.1, lb: 0.2 }

/** Field text -> a number, accepting the comma decimal separator RU keyboards emit. */
function parseValue(text: string): number | undefined {
  const normalized = text.replace(',', '.').trim()
  if (normalized === '') return undefined
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** Trim float noise from stepping (0.1 + 0.2) without hiding real precision. */
const format1 = (value: number) => String(Math.round(value * 10) / 10)

export function BodyWeightDialog({
  open,
  entry,
  latestKg,
  onSubmit,
  onCancel,
}: BodyWeightDialogProps) {
  const { t } = useI18n()
  const { unit, unitLabel } = useWeightUnit()
  const [text, setText] = useState('')
  const [dateText, setDateText] = useState('')

  // Re-prefill each time the dialog opens (the entry / latest one may have
  // changed). Deps are primitives, so typing never re-triggers this.
  const entryKg = entry?.weightKg
  const entryAt = entry?.measuredAt
  useEffect(() => {
    if (!open) return
    const prefillKg = entryKg ?? latestKg
    setText(prefillKg === undefined ? '' : format1(kgToDisplay(prefillKg, unit)))
    // The input has minute precision, so a "now" prefill is always <= now and
    // never trips the future check below.
    setDateText(toDateTimeLocalValue(entryAt ?? Date.now()))
  }, [open, entryKg, entryAt, latestKg, unit])

  const parsed = parseValue(text)
  const measuredAt = fromDateTimeLocalValue(dateText)
  const dateInvalid = measuredAt === null || !isValidMeasuredAt(measuredAt, Date.now())
  const step = (delta: number) => {
    const base = parsed ?? (latestKg === undefined ? 0 : kgToDisplay(latestKg, unit))
    setText(format1(Math.max(0, base + delta)))
  }

  const submit = () => {
    if (parsed !== undefined && measuredAt !== null && !dateInvalid) {
      onSubmit(displayToKg(parsed, unit), measuredAt)
    }
  }

  const fieldLabel = t('progress.bodyWeight.field', { unit: unitLabel })
  const dateLabel = t('progress.bodyWeight.dateField')

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t(entry ? 'progress.bodyWeight.editDialogTitle' : 'progress.bodyWeight.dialogTitle')}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            className="flex-1"
            disabled={parsed === undefined || dateInvalid}
            onClick={submit}
          >
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="font-mono text-xs uppercase text-muted-foreground" htmlFor="body-weight">
          {fieldLabel}
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label={t('progress.bodyWeight.decrease')}
            onClick={() => step(-STEP[unit])}
          >
            <Minus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
          </Button>
          <TextField
            id="body-weight"
            autoFocus
            inputMode="decimal"
            aria-label={fieldLabel}
            className="text-center font-mono text-lg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
          <Button
            variant="secondary"
            size="icon"
            aria-label={t('progress.bodyWeight.increase')}
            onClick={() => step(STEP[unit])}
          >
            <Plus aria-hidden className="h-5 w-5" strokeWidth={2.5} />
          </Button>
        </div>

        <label
          className="font-mono text-xs uppercase text-muted-foreground"
          htmlFor="body-weight-date"
        >
          {dateLabel}
        </label>
        <TextField
          id="body-weight-date"
          type="datetime-local"
          aria-label={dateLabel}
          className="font-mono"
          value={dateText}
          // Native guard only — isValidMeasuredAt above is the real gate.
          max={toDateTimeLocalValue(Date.now())}
          onChange={(e) => setDateText(e.target.value)}
        />
        {dateInvalid && (
          <p className="text-sm text-destructive">
            {t('progress.bodyWeight.dateFuture')}
          </p>
        )}
      </div>
    </Modal>
  )
}
