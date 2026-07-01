// Phase 1 acceptance: the full strength-tracking loop through the real UI,
// entirely offline (Dexie only) — Start a Session -> Session detail -> Exercise
// tracking -> add a set.
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/renderApp'
import { addRoutineExercise, createRoutineDay } from '@/data/operations'

describe('Local core loop (Phase 1)', () => {
  it('starts a session from a routine day and logs a set', async () => {
    const user = userEvent.setup()

    // Seed a routine day with one exercise.
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps')

    renderApp('/workouts')

    // Open the Start Workout sheet and pick the day.
    await user.click(await screen.findByRole('button', { name: 'Новая тренировка' }))
    await user.click(await screen.findByRole('button', { name: /Day A/ }))

    // Landed in the new Session detail with the copied exercise.
    expect(await screen.findByRole('heading', { name: 'Day A' })).toBeInTheDocument()
    const exerciseLink = await screen.findByRole('link', { name: /Bench press/ })
    expect(exerciseLink).toHaveTextContent(/Не начато/)

    // Drill into the exercise and add a set (cold defaults: 0 kg × 8).
    await user.click(exerciseLink)
    await user.click(await screen.findByRole('button', { name: 'Добавить подход' }))

    expect(await screen.findByText('Подход 1')).toBeInTheDocument()
    expect(screen.getByText('0 кг × 8')).toBeInTheDocument()
  })

  it('shows weight in the exercise’s chosen unit, with kg in parentheses (lb)', async () => {
    const user = userEvent.setup()

    // Exercise configured to display in pounds; storage stays canonical kg.
    const day = await createRoutineDay('Day A')
    await addRoutineExercise(day!.id, 'Bench press', 'weightReps', 'lb')

    renderApp('/workouts')
    await user.click(await screen.findByRole('button', { name: 'Новая тренировка' }))
    await user.click(await screen.findByRole('button', { name: /Day A/ }))
    await user.click(await screen.findByRole('link', { name: /Bench press/ }))
    await user.click(await screen.findByRole('button', { name: 'Добавить подход' }))

    // Chosen unit primary, kg in parentheses.
    expect(await screen.findByText('0 фунты (0 кг) × 8')).toBeInTheDocument()
  })
})
