// Add Session Exercise sheet (APP_SPECIFICATION.md §5.4): a one-off exercise for
// this workout only. Metric is chosen here and fixed for that Exercise Log. Add
// is disabled while the name is blank.
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useI18n } from '@/i18n/I18nProvider'
import { addSessionExercise } from '@/data/operations'
import type { Metric } from '@/domain/types'
import type { WeightUnit } from '@/prefs/preferences'
import { useWeightUnit } from '@/prefs/useWeightUnit'

interface AddSessionExerciseSheetProps {
  open: boolean
  sessionId: string
  onClose: () => void
}

export function AddSessionExerciseSheet({
  open,
  sessionId,
  onClose,
}: AddSessionExerciseSheetProps) {
  const { t } = useI18n()
  const { unit: defaultUnit } = useWeightUnit()
  const [name, setName] = useState('')
  const [metric, setMetric] = useState<Metric>('weightReps')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(defaultUnit)

  useEffect(() => {
    if (open) {
      setName('')
      setMetric('weightReps')
      setWeightUnit(defaultUnit)
    }
  }, [open, defaultUnit])

  const canAdd = name.trim().length > 0
  const submit = async () => {
    if (!canAdd) return
    await addSessionExercise(sessionId, name, metric, weightUnit)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('session.addExercise.title')}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" disabled={!canAdd} onClick={submit}>
            {t('common.add')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <TextField
            autoFocus
            value={name}
            placeholder={t('dayEditor.exerciseName')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
          <p className="text-sm text-muted-foreground">{t('session.addExerciseMessage')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t('dayEditor.dataType')}
          </span>
          <SegmentedControl<Metric>
            ariaLabel={t('dayEditor.dataType')}
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'weightReps', label: t('metric.weightReps') },
              { value: 'duration', label: t('metric.duration') },
            ]}
          />
        </div>
        {metric === 'weightReps' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {t('weightUnit.label')}
            </span>
            <SegmentedControl<WeightUnit>
              ariaLabel={t('weightUnit.label')}
              value={weightUnit}
              onChange={setWeightUnit}
              options={[
                { value: 'kg', label: t('unit.kg') },
                { value: 'lb', label: t('unit.lb') },
              ]}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
