// Acceptance: the Progress tab — list every trained exercise, chart one's
// history, and filter it by range (docs/plans/progress-charts.md AC1-AC7).
// Mirrors flow.test.tsx: real UI, offline, seeded via the operations layer.
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
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

/** "Bench press", trained in two sessions: one ~200 days ago, one just now. */
async function seedTrainedExercise() {
  const day = await createRoutineDay('Day A')
  await addRoutineExercise(day!.id, 'Bench press', 'weightReps')

  const oldSession = await startSessionFromDay(day!.id)
  const { exercises: oldExercises } = await getWorkoutScreen(oldSession!.id)
  const oldSet = await addSet(oldExercises[0].log, { weightKg: 80, reps: 5, durationSec: 0 })
  await toggleSetDone(oldSet!.id)
  await updateSessionStartedAt(oldSession!.id, Date.now() - 200 * DAY_MS)

  const recentSession = await startSessionFromDay(day!.id)
  const { exercises: recentExercises } = await getWorkoutScreen(recentSession!.id)
  const recentSet = await addSet(recentExercises[0].log, { weightKg: 100, reps: 5, durationSec: 0 })
  await toggleSetDone(recentSet!.id)
}

describe('Progress tab', () => {
  it('shows an empty state when nothing has been trained yet', async () => {
    renderApp('/progress')
    expect(await screen.findByText(translate('ru', 'progress.empty.title'))).toBeInTheDocument()
  })

  it('lists a trained exercise and charts its history, filterable by range', async () => {
    const user = userEvent.setup()
    await seedTrainedExercise()

    renderApp('/workouts')
    await user.click(await screen.findByRole('link', { name: /Прогресс/ }))

    expect(await screen.findByRole('link', { name: /Bench press/ })).toBeInTheDocument()
    expect(screen.getByText(translate('ru', 'metric.weightReps.short'))).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Bench press/ }))

    const chartLabel = translate('ru', 'progress.chartLabel', { name: 'Bench press' })
    const chart = await screen.findByRole('img', { name: chartLabel })
    expect(chart.querySelectorAll('circle[role="button"]')).toHaveLength(2)

    // Range chip narrows to the recent (last-30-days) session only.
    await user.click(screen.getByRole('radio', { name: translate('ru', 'progress.range.1m') }))
    expect(chart.querySelectorAll('circle[role="button"]')).toHaveLength(1)
  })

  it('handles exercise names with spaces and Cyrillic characters via the URL', async () => {
    const user = userEvent.setup()
    const day = await createRoutineDay('Day B')
    await addRoutineExercise(day!.id, 'Жим лёжа', 'weightReps')
    const session = await startSessionFromDay(day!.id)
    const { exercises } = await getWorkoutScreen(session!.id)
    const set = await addSet(exercises[0].log, { weightKg: 50, reps: 8, durationSec: 0 })
    await toggleSetDone(set!.id)

    renderApp('/progress')
    await user.click(await screen.findByRole('link', { name: /Жим лёжа/ }))

    expect(await screen.findByRole('heading', { name: 'Жим лёжа' })).toBeInTheDocument()
    expect(
      await screen.findByRole('img', {
        name: translate('ru', 'progress.chartLabel', { name: 'Жим лёжа' }),
      })
    ).toBeInTheDocument()
  })

  it('renders an empty state for an unknown exercise instead of crashing', async () => {
    renderApp('/progress/Unknown%20Exercise')
    expect(await screen.findByText(translate('ru', 'progress.noData'))).toBeInTheDocument()
  })

  it('renders the Progress tab and its empty state in English', async () => {
    setPreference('language', 'en')
    renderApp('/progress')

    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Progress/ })).toBeInTheDocument()
    expect(screen.getByText(translate('en', 'progress.empty.hint'))).toBeInTheDocument()
  })
})
