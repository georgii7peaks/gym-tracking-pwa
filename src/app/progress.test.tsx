// Acceptance: the Progress tab — Total Volume + Total Duration over time, with a
// Drawer filter down to a single exercise and 1M/3M/6M/All range chips
// (docs/plans/progress-total-volume.md AC1-AC8). Mirrors flow.test.tsx: real UI,
// offline, seeded via the operations layer.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/renderApp'
import {
  addRoutineExercise,
  addSet,
  createRoutineDay,
  startSessionFromDay,
  toggleSetDone,
  updateSessionStartedAt,
} from '@/data/operations'
import { getWorkoutScreen } from '@/data/queries'
import { setPreference } from '@/prefs/preferences'
import { translate } from '@/i18n/strings'

const DAY_MS = 86_400_000

async function logDoneSet(
  logName: string,
  sessionId: string,
  values: { weightKg: number; reps: number; durationSec: number }
) {
  const { exercises } = await getWorkoutScreen(sessionId)
  const target = exercises.find((e) => e.log.name === logName)!
  const set = await addSet(target.log, values)
  await toggleSetDone(set!.id)
}

/**
 * One routine day with a weightReps exercise ("Bench press") and a duration one
 * ("Plank"), trained in two sessions: ~200 days ago and just now.
 *   Volume:   400 kg @ old, 500 kg @ now
 *   Duration: 60 s @ old,   90 s @ now
 */
async function seedMixed() {
  const day = await createRoutineDay('Day A')
  await addRoutineExercise(day!.id, 'Bench press', 'weightReps')
  await addRoutineExercise(day!.id, 'Plank', 'duration')

  const old = await startSessionFromDay(day!.id)
  await logDoneSet('Bench press', old!.id, { weightKg: 80, reps: 5, durationSec: 0 })
  await logDoneSet('Plank', old!.id, { weightKg: 0, reps: 0, durationSec: 60 })
  await updateSessionStartedAt(old!.id, Date.now() - 200 * DAY_MS)

  const recent = await startSessionFromDay(day!.id)
  await logDoneSet('Bench press', recent!.id, { weightKg: 100, reps: 5, durationSec: 0 })
  await logDoneSet('Plank', recent!.id, { weightKg: 0, reps: 0, durationSec: 90 })
}

const volumeChart = () => screen.findByRole('img', { name: /Общий объём/ })
const durationChart = () => screen.findByRole('img', { name: /Общее время/ })
const points = (chart: HTMLElement) => chart.querySelectorAll('circle[role="button"]')

describe('Progress tab', () => {
  it('shows an empty state when nothing has been trained yet', async () => {
    renderApp('/progress')
    expect(await screen.findByText(translate('ru', 'progress.empty.title'))).toBeInTheDocument()
  })

  it('shows both total charts across all exercises by default', async () => {
    await seedMixed()
    renderApp('/progress')

    expect(points(await volumeChart())).toHaveLength(2)
    expect(points(await durationChart())).toHaveLength(2)
  })

  it('filters to only the Volume chart for a weightReps exercise', async () => {
    const user = userEvent.setup()
    await seedMixed()
    renderApp('/progress')
    await volumeChart() // wait for first paint

    await user.click(screen.getByRole('button', { name: /Упражнение/ }))
    const drawer = await screen.findByRole('dialog', {
      name: translate('ru', 'progress.filter.button'),
    })
    await user.click(within(drawer).getByRole('button', { name: /Bench press/ }))

    expect(
      await screen.findByRole('heading', { name: 'Объём: Bench press, кг' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Общее время/ })).not.toBeInTheDocument()
  })

  it('filters to only the Duration chart for a duration exercise', async () => {
    const user = userEvent.setup()
    await seedMixed()
    renderApp('/progress')
    await volumeChart()

    await user.click(screen.getByRole('button', { name: /Упражнение/ }))
    const drawer = await screen.findByRole('dialog', {
      name: translate('ru', 'progress.filter.button'),
    })
    await user.click(within(drawer).getByRole('button', { name: /Plank/ }))

    expect(await screen.findByRole('heading', { name: 'Время: Plank' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Общий объём/ })).not.toBeInTheDocument()
  })

  it('narrows the visible chart when a shorter range is picked', async () => {
    const user = userEvent.setup()
    await seedMixed()
    renderApp('/progress')

    const chart = await volumeChart()
    expect(points(chart)).toHaveLength(2)

    await user.click(screen.getByRole('radio', { name: translate('ru', 'progress.range.1m') }))
    expect(points(chart)).toHaveLength(1)
  })

  it('shows the Volume chart in the Settings weight unit (lb)', async () => {
    setPreference('weightUnit', 'lb')
    await seedMixed()
    renderApp('/progress')

    // Title carries the localized lb label…
    expect(
      await screen.findByRole('heading', { name: translate('ru', 'progress.volume.title', { unit: translate('ru', 'unit.lb') }) })
    ).toBeInTheDocument()
    // …and 400 kg reads as 882 lb on its data point.
    expect(screen.getByRole('button', { name: /882/ })).toBeInTheDocument()
  })

  it('renders headings and the empty state in English', async () => {
    setPreference('language', 'en')
    await seedMixed()
    renderApp('/progress')

    expect(await screen.findByRole('heading', { name: 'Total volume, kg' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Total duration' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exercise/ })).toBeInTheDocument()
  })
})
