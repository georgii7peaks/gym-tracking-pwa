// Acceptance: the inline workout loop through the real UI, entirely offline —
// start a session, add a set on the exercise card, tick it done, watch the
// stats update.
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/renderApp'
import { addRoutineExercise, createRoutineDay } from '@/data/operations'

describe('Inline workout loop', () => {
  it('starts a session, logs a set and marks it done', async () => {
    const user = userEvent.setup()

    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps')

    renderApp('/workouts')

    // Empty state -> start a workout from the day.
    await user.click(await screen.findByRole('button', { name: 'Начать тренировку' }))
    await user.click(await screen.findByRole('button', { name: /Day A/ }))

    // Inline workout screen shows the copied exercise with no sets yet.
    expect(await screen.findByText('Bench press')).toBeInTheDocument()

    // Add a set (cold prefill: 0 / 12, unchecked) -> SETS stat shows 0/1.
    await user.click(await screen.findByRole('button', { name: /Добавить подход/ }))
    expect(await screen.findByText('0/1')).toBeInTheDocument()

    // Tick it done -> SETS stat becomes 1/1.
    await user.click(screen.getByRole('button', { name: 'Отметить подход выполненным' }))
    expect(await screen.findByText('1/1')).toBeInTheDocument()
  })

  it('steps weight in the exercise’s chosen unit (lb)', async () => {
    const user = userEvent.setup()

    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps', 'lb')

    renderApp('/workouts')
    await user.click(await screen.findByRole('button', { name: 'Начать тренировку' }))
    await user.click(await screen.findByRole('button', { name: /Day A/ }))
    await user.click(await screen.findByRole('button', { name: /Добавить подход/ }))

    // One tap of the weight + steps by 5 (lb increment), not 2.5 (kg).
    await user.click(await screen.findByRole('button', { name: 'Вес +' }))
    expect(await screen.findByText('5')).toBeInTheDocument()
  })

  it('finishing confirms in a bottom drawer and returns to the list', async () => {
    const user = userEvent.setup()

    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps')

    renderApp('/workouts')
    await user.click(await screen.findByRole('button', { name: 'Начать тренировку' }))
    await user.click(await screen.findByRole('button', { name: /Day A/ }))
    expect(await screen.findByText('Bench press')).toBeInTheDocument()

    // Finish -> drawer confirmation.
    await user.click(await screen.findByRole('button', { name: 'Завершить' }))
    const drawer = await screen.findByRole('dialog', { name: 'Завершить тренировку?' })
    await user.click(within(drawer).getByRole('button', { name: 'Завершить' }))

    // Back on the Workouts list, which now holds the saved session.
    expect(await screen.findByRole('heading', { name: 'Тренировки' })).toBeInTheDocument()
    expect(await screen.findByText('Day A')).toBeInTheDocument()
  })

  it('reopening a finished workout offers Continue instead of Finish', async () => {
    const user = userEvent.setup()

    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps')

    renderApp('/workouts')
    await user.click(await screen.findByRole('button', { name: 'Начать тренировку' }))
    await user.click(await screen.findByRole('button', { name: /Day A/ }))
    await user.click(await screen.findByRole('button', { name: 'Завершить' }))
    const drawer = await screen.findByRole('dialog', { name: 'Завершить тренировку?' })
    await user.click(within(drawer).getByRole('button', { name: 'Завершить' }))

    // Reopen the now-finished workout from the list.
    await user.click(await screen.findByRole('link', { name: /Day A/ }))
    expect(await screen.findByText('Завершена · Day A')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Завершить' })).not.toBeInTheDocument()

    // Continue reactivates it.
    await user.click(screen.getByRole('button', { name: 'Продолжить' }))
    expect(await screen.findByText('Активна · Day A')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Завершить' })).toBeInTheDocument()
  })
})
