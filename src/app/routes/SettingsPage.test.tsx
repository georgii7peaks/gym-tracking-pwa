// Settings — Weight section (§5.8): the picker sets the DEFAULT unit for new
// exercises (existing ones keep their own unit — no bulk conversion, §13 fix).
import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/renderApp'
import { createRoutineDay } from '@/data/operations'
import { getPreference } from '@/prefs/preferences'

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
    // Wait for the prompt dialog to close: its input holds the same text, so
    // finding by display value too early can match the dialog's field and see
    // it detach when the dialog unmounts.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // The newly added exercise's weight-unit picker defaults to lb.
    expect(await screen.findByDisplayValue('Bench press')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'фунты', checked: true })).toBeInTheDocument()
  })
})

describe('Settings — workout section', () => {
  it('persists the rest-timer default and the auto-rest / vibration toggles', async () => {
    const user = userEvent.setup()
    await createRoutineDay('Day A') // keeps the Starter Program prompt from appearing

    renderApp('/settings')
    await screen.findByRole('heading', { name: 'Настройки' })

    // 1:30 default; one + tap steps by 15s.
    expect(screen.getByText('1:30')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Таймер отдыха +' }))
    expect(screen.getByText('1:45')).toBeInTheDocument()
    expect(getPreference('restTimerSec')).toBe(105)

    // Both switches default on; a tap turns them off and persists.
    await user.click(screen.getByRole('switch', { name: 'Автозапуск таймера отдыха' }))
    expect(getPreference('autoRest')).toBe(false)
    await user.click(screen.getByRole('switch', { name: 'Вибрация' }))
    expect(getPreference('soundHaptics')).toBe(false)
  })
})
