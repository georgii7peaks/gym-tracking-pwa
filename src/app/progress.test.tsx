// Acceptance: the Progress tab — the user's Body Weight plus Total Volume +
// Total Duration over time, with a Drawer filter down to a single exercise and
// one shared set of 1M/3M/6M/All range chips
// (docs/plans/progress-total-volume.md AC1-AC8 + body-weight-progress.md
// AC1-AC10). Mirrors flow.test.tsx: real UI, offline, seeded via the operations
// layer.
import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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
import { repository as repo } from '@/data/dexie-repository'
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

// ── Body weight (docs/plans/body-weight-progress.md) ─────────────────────────

const HOUR_MS = 3_600_000
/** U+2212 MINUS SIGN — what the delta renders, not an ASCII hyphen. */
const MINUS = '−'

const ru = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate('ru', key, params)

const bodyWeightChart = () => screen.findByRole('img', { name: /Вес тела/ })

/**
 * Wait for the chart to hold exactly `count` points. The chart element already
 * exists across a re-render, so a bare findBy* would resolve against the STALE
 * point set — the count itself is what has to be waited on.
 */
async function bodyWeightPoints(count: number): Promise<NodeListOf<Element>> {
  await waitFor(async () => expect(points(await bodyWeightChart())).toHaveLength(count))
  return points(await bodyWeightChart())
}

/** Seed a Body Weight Entry at an arbitrary past time — the UI always stamps now(). */
async function seedWeight(id: string, weightKg: number, measuredAt: number) {
  await repo.bodyWeightEntries.put({ id, weightKg, measuredAt, updatedAt: measuredAt })
}

/** Local midnight of the Monday opening the current week (the 'week' bucket rule). */
function thisMonday(): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime()
}

/** Log one weight through the real UI: open the dialog, replace the value, save. */
async function logWeightViaUI(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.click(screen.getByRole('button', { name: ru('progress.bodyWeight.log') }))
  const dialog = await screen.findByRole('dialog', { name: ru('progress.bodyWeight.dialogTitle') })
  const field = within(dialog).getByRole('textbox')
  await user.clear(field)
  await user.type(field, value)
  await user.click(within(dialog).getByRole('button', { name: ru('common.save') }))
}

describe('Progress tab — body weight', () => {
  it('shows the body-weight card with its button even with no workouts at all', async () => {
    renderApp('/progress')

    expect(
      await screen.findByRole('heading', { name: ru('progress.bodyWeight.title') })
    ).toBeInTheDocument()
    expect(screen.getByText(ru('progress.bodyWeight.empty'))).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: ru('progress.bodyWeight.log') })
    ).toBeInTheDocument()
    // The workouts half still says there is nothing trained yet.
    expect(screen.getByText(ru('progress.empty.title'))).toBeInTheDocument()
  })

  it('charts the first logged weight and reports no change yet', async () => {
    const user = userEvent.setup()
    renderApp('/progress')
    await screen.findByRole('heading', { name: ru('progress.bodyWeight.title') })

    await logWeightViaUI(user, '80')

    await bodyWeightPoints(1)
    expect(screen.getByText('80 кг')).toBeInTheDocument()
    // One point is no trend — the delta stays hidden.
    expect(screen.queryByText(ru('progress.bodyWeight.change'))).not.toBeInTheDocument()
  })

  it('shows the change with its sign once there are two points', async () => {
    const user = userEvent.setup()
    await seedWeight('old', 80, Date.now() - 3 * DAY_MS)
    renderApp('/progress')
    await bodyWeightChart()

    await logWeightViaUI(user, '77.5')

    await bodyWeightPoints(2)
    expect(screen.getByText(ru('progress.bodyWeight.change'))).toBeInTheDocument()
    expect(screen.getByText(`${MINUS}2.5 кг`)).toBeInTheDocument()
  })

  it('averages same-day weigh-ins into one point in "По дням", history still lists both', async () => {
    const user = userEvent.setup()
    renderApp('/progress')
    await screen.findByRole('heading', { name: ru('progress.bodyWeight.title') })

    await logWeightViaUI(user, '78')
    await logWeightViaUI(user, '79')
    await bodyWeightPoints(2)

    await user.click(screen.getByRole('radio', { name: ru('progress.bodyWeight.group.day') }))

    const grouped = await bodyWeightPoints(1)
    expect(grouped[0].getAttribute('aria-label')).toMatch(/78\.5/)
    expect(screen.getByText(ru('progress.bodyWeight.avg.day'))).toBeInTheDocument()

    // The drawer always lists RAW entries — deleting needs real entry ids.
    await user.click(screen.getByRole('button', { name: ru('progress.bodyWeight.history') }))
    const drawer = await screen.findByRole('dialog', {
      name: ru('progress.bodyWeight.historyTitle'),
    })
    expect(within(drawer).getAllByRole('button', { name: /Удалить:/ })).toHaveLength(2)
  })

  it('collapses a week of weigh-ins into one point in "По неделям"', async () => {
    const user = userEvent.setup()
    const monday = thisMonday()
    await seedWeight('w1', 80, monday - 7 * DAY_MS + 10 * HOUR_MS) // previous week
    await seedWeight('w2', 78, monday + 10 * HOUR_MS) // this week
    await seedWeight('w3', 76, monday + 2 * DAY_MS + 10 * HOUR_MS) // this week too
    renderApp('/progress')

    await bodyWeightPoints(3)

    await user.click(screen.getByRole('radio', { name: ru('progress.bodyWeight.group.week') }))

    const weekly = await bodyWeightPoints(2)
    expect(weekly[1].getAttribute('aria-label')).toMatch(/77/) // (78 + 76) / 2
    expect(screen.getByText(ru('progress.bodyWeight.avg.week'))).toBeInTheDocument()
  })

  it('deletes an entry from the History drawer', async () => {
    const user = userEvent.setup()
    await seedWeight('old', 80, Date.now() - 3 * DAY_MS)
    await seedWeight('recent', 78, Date.now() - HOUR_MS)
    renderApp('/progress')
    await bodyWeightPoints(2)

    await user.click(screen.getByRole('button', { name: ru('progress.bodyWeight.history') }))
    const drawer = await screen.findByRole('dialog', {
      name: ru('progress.bodyWeight.historyTitle'),
    })
    await user.click(within(drawer).getByRole('button', { name: /Удалить: 78 кг/ }))

    const confirm = await screen.findByRole('dialog', {
      name: ru('progress.bodyWeight.delete.title'),
    })
    await user.click(within(confirm).getByRole('button', { name: ru('common.delete') }))

    await bodyWeightPoints(1)
  })

  it('narrows the body-weight chart with the shared range chips', async () => {
    const user = userEvent.setup()
    await seedWeight('old', 85, Date.now() - 200 * DAY_MS)
    await seedWeight('recent', 78, Date.now() - HOUR_MS)
    renderApp('/progress')
    await bodyWeightPoints(2)

    await user.click(screen.getByRole('radio', { name: ru('progress.range.1m') }))

    await bodyWeightPoints(1)
  })

  it('displays and prefills in lb when that is the Settings unit', async () => {
    const user = userEvent.setup()
    setPreference('weightUnit', 'lb')
    await seedWeight('w1', 78.47, Date.now() - HOUR_MS) // 173.0 lb
    renderApp('/progress')
    await bodyWeightChart()

    expect(screen.getByText(`173 ${ru('unit.lb')}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: ru('progress.bodyWeight.log') }))
    const dialog = await screen.findByRole('dialog', {
      name: ru('progress.bodyWeight.dialogTitle'),
    })
    expect(within(dialog).getByRole('textbox')).toHaveValue('173')
  })

  it('renders the body-weight card in English', async () => {
    setPreference('language', 'en')
    await seedWeight('w1', 78, Date.now() - HOUR_MS)
    renderApp('/progress')

    expect(await screen.findByRole('heading', { name: 'Body weight' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log weight' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'By week' })).toBeInTheDocument()
    // Appears only once the seeded entry has loaded.
    expect(await screen.findByText('Current weight')).toBeInTheDocument()
  })
})
