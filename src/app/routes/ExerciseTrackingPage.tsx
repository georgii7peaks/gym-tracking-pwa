// Exercise tracking (APP_SPECIFICATION.md §5.5): record sets for one Exercise
// Log. Inputs adapt to the metric; a Previous Set reference and pre-fill (§6.2,
// §6.3) let the user usually just tap "Add set".
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { History } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/Button'
import { EditToggle } from '@/components/ui/EditToggle'
import { TextField } from '@/components/ui/TextField'
import { Stepper } from '@/components/ui/Stepper'
import { RowEditControls } from '@/components/RowEditControls'
import { useI18n } from '@/i18n/I18nProvider'
import { useLiveData } from '@/data/useLiveData'
import { getTrackingData } from '@/data/queries'
import { addSet, deleteSet, getPreviousSet, reorderSets } from '@/data/operations'
import { computePrefill } from '@/domain/prefill'
import { combineDuration, formatDuration, splitDuration } from '@/domain/duration'
import { displayToKg, formatWeightDisplay, kgToDisplay, WEIGHT_UNITS } from '@/domain/weight'
import { moveItem } from '@/domain/ordering'
import type { SetEntry } from '@/domain/types'
import type { WeightUnit } from '@/prefs/preferences'
import { useUnitLabels } from '@/prefs/useWeightUnit'
import { haptics } from '@/lib/haptics'

/** Format a display-unit number: whole -> no decimals, else one decimal. */
function formatDisplayNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function ExerciseTrackingPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { logId = '' } = useParams()
  const labels = useUnitLabels()

  const { data, loading } = useLiveData(() => getTrackingData(logId), [logId])
  const log = data?.log
  const session = data?.session
  const sets = data?.sets ?? []

  // Display unit is per-exercise (the log's, copied from the routine); weight is
  // still stored canonically in kg. Absent -> kg.
  const unit: WeightUnit = log?.weightUnit ?? 'kg'
  const unitLabel = labels[unit]

  const [editing, setEditing] = useState(false)

  // New-set inputs (weight is held in the display unit as text).
  const [weightText, setWeightText] = useState('0')
  const [reps, setReps] = useState(8)
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(30)

  // Previous Set reference (§6.2), fetched once per log.
  const [prevSet, setPrevSet] = useState<SetEntry | undefined>(undefined)
  const [prevReady, setPrevReady] = useState(false)
  const prevFetchedFor = useRef<string | null>(null)
  const prefilledFor = useRef<string | null>(null)

  useEffect(() => {
    if (!log || !session) return
    if (prevFetchedFor.current === log.id) return
    prevFetchedFor.current = log.id
    setPrevReady(false)
    getPreviousSet(log, session).then((p) => {
      setPrevSet(p)
      setPrevReady(true)
    })
  }, [log?.id, session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill once, after the Previous Set lookup settles (§6.3).
  useEffect(() => {
    if (!log || !prevReady || prefilledFor.current === log.id) return
    prefilledFor.current = log.id
    const lastSet = sets.reduce<SetEntry | undefined>(
      (latest, s) => (!latest || s.createdAt > latest.createdAt ? s : latest),
      undefined
    )
    const prefill = computePrefill(log.metric, lastSet, prevSet)
    setWeightText(formatDisplayNumber(kgToDisplay(prefill.weightKg, unit)))
    setReps(prefill.reps)
    const split = splitDuration(prefill.durationSec)
    setMinutes(split.minutes)
    setSeconds(split.seconds)
  }, [log?.id, prevReady, prevSet, sets, unit]) // eslint-disable-line react-hooks/exhaustive-deps

  // The log was deleted (or never existed) — return to the session.
  useEffect(() => {
    if (!loading && !log) navigate('/workouts', { replace: true })
  }, [loading, log, navigate])

  if (!log) return null

  const isDuration = log.metric === 'duration'
  const weightDisplay = Number.parseFloat(weightText) || 0

  const onAddSet = async () => {
    const created = await addSet(log, {
      weightKg: displayToKg(weightDisplay, unit),
      reps,
      durationSec: combineDuration(minutes, seconds),
    })
    if (created) haptics.success()
  }

  const move = async (from: number, to: number) => {
    await reorderSets(
      log.id,
      moveItem(
        sets.map((s) => s.id),
        from,
        to
      )
    )
  }

  const setValueText = (set: SetEntry): string =>
    isDuration
      ? formatDuration(set.durationSec)
      : `${formatWeightDisplay(set.weightKg, unit, labels)} × ${set.reps}`

  const lastTimeText = (): string | null => {
    if (!prevSet) return null
    return isDuration
      ? t('exercise.lastTime.duration', { duration: formatDuration(prevSet.durationSec) })
      : t('exercise.lastTime.weightReps', {
          weight: formatWeightDisplay(prevSet.weightKg, unit, labels),
          reps: prevSet.reps,
        })
  }
  const lastTime = lastTimeText()

  return (
    <Screen
      title={log.name}
      onBack={() => navigate(`/workouts/${log.sessionId}`)}
      headerRight={
        sets.length > 0 ? <EditToggle editing={editing} onToggle={setEditing} /> : undefined
      }
    >
      <div className="flex flex-col gap-6">
        {/* Previous reference */}
        {lastTime && (
          <div className="flex items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">
            <History aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            <span>{lastTime}</span>
          </div>
        )}

        {/* New set */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t('exercise.newSet')}
          </h2>

          <div className="flex flex-col gap-3 border-2 border-border bg-card p-4 shadow-retro-sm">
            {isDuration ? (
              <>
                <Stepper
                  label={t('exercise.minutes', { n: minutes })}
                  value={minutes}
                  min={0}
                  max={120}
                  step={1}
                  showValue={false}
                  onChange={setMinutes}
                />
                <Stepper
                  label={t('exercise.seconds', { n: seconds })}
                  value={seconds}
                  min={0}
                  max={59}
                  step={5}
                  showValue={false}
                  onChange={setSeconds}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold" htmlFor="weight-input">
                    {t('exercise.weight')}
                  </label>
                  <TextField
                    id="weight-input"
                    inputMode="decimal"
                    className="flex-1 text-right"
                    value={weightText}
                    onChange={(e) => setWeightText(e.target.value)}
                  />
                  <span className="w-10 text-sm font-semibold text-muted-foreground">
                    {unitLabel}
                  </span>
                </div>
                <Stepper
                  label={t('exercise.adjustWeight', { display: unitLabel })}
                  value={weightDisplay}
                  min={0}
                  max={WEIGHT_UNITS[unit].max}
                  step={WEIGHT_UNITS[unit].step}
                  format={formatDisplayNumber}
                  onChange={(v) => setWeightText(formatDisplayNumber(v))}
                />
                <Stepper
                  label={t('exercise.reps', { n: reps })}
                  value={reps}
                  min={1}
                  max={100}
                  step={1}
                  showValue={false}
                  onChange={setReps}
                />
              </>
            )}

            <Button className="w-full" onClick={onAddSet}>
              {t('exercise.addSet')}
            </Button>
          </div>
        </section>

        {/* Sets this workout */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t('exercise.setsSection')}
          </h2>
          {sets.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <p className="font-bold">{t('exercise.noSets.title')}</p>
              <p className="max-w-xs text-sm text-muted-foreground">{t('exercise.noSets.hint')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {sets.map((set, index) => (
                <li key={set.id} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center justify-between border-2 border-border bg-card px-3 py-2 shadow-retro-sm">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {t('exercise.setNumber', { n: index + 1 })}
                    </span>
                    <span className="font-mono text-base font-bold tabular-nums">
                      {setValueText(set)}
                    </span>
                  </div>
                  {editing && (
                    <RowEditControls
                      index={index}
                      count={sets.length}
                      onMoveUp={() => move(index, index - 1)}
                      onMoveDown={() => move(index, index + 1)}
                      onDelete={() => deleteSet(set.id)}
                      deleteLabel={`${t('common.delete')}: ${t('exercise.setNumber', { n: index + 1 })}`}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Screen>
  )
}
