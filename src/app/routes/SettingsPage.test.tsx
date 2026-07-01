// Settings — Weight section (§5.8): the picker sets the DEFAULT unit for new
// exercises (existing ones keep their own unit — no bulk conversion, §13 fix).
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/renderApp'
import { createRoutineDay } from '@/data/operations'

describe('Settings — weight unit', () => {
  it('changing the default unit applies to exercises added afterwards', async () => {
    const user = userEvent.setup()
    await createRoutineDay('Day A') // keeps the Starter Program prompt from appearing

    renderApp('/settings')
    await screen.findByRole('heading', { name: 'Настройки' })
    await user.click(screen.getByRole('radio', { name: 'фунты' }))

    await user.click(screen.getByRole('link', { name: /Программа/ }))
    await user.click(await screen.findByRole('link', { name: /Day A/ }))
    await user.click(await screen.findByRole('button', { name: /Добавить упражнение/ }))
    await user.type(screen.getByPlaceholderText('Название упражнения'), 'Bench press')
    await user.click(screen.getByRole('button', { name: 'Добавить' }))

    // The newly added exercise's weight-unit picker defaults to lb.
    expect(await screen.findByDisplayValue('Bench press')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'фунты', checked: true })).toBeInTheDocument()
  })
})
