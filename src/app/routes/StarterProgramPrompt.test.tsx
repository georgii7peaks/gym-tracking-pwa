// Starter Program prompt (§5.9, §10): shown once when Routines is empty and the
// decision hasn't been made yet; picking or skipping records the decision so it
// never reappears.
import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/renderApp'
import { createRoutineDay } from '@/data/operations'
import { getPreference } from '@/prefs/preferences'

describe('Starter Program prompt', () => {
  it('shows on launch when Routines is empty, and applying a program seeds it', async () => {
    const user = userEvent.setup()
    renderApp('/routines')

    const drawer = await screen.findByRole('dialog', { name: 'Готовая программа' })
    await user.click(within(drawer).getByRole('button', { name: /Сила/ }))

    // The seeded days now show on the Routines list.
    expect(await screen.findByText('Присед и жим')).toBeInTheDocument()
    expect(await screen.findByText('Тяга и жим над головой')).toBeInTheDocument()
    expect(getPreference('didCompleteInitialSeed')).toBe(true)
  })

  it('records the decision on Skip without adding any days', async () => {
    const user = userEvent.setup()
    renderApp('/routines')

    const drawer = await screen.findByRole('dialog', { name: 'Готовая программа' })
    await user.click(within(drawer).getByRole('button', { name: 'Пропустить' }))

    expect(await screen.findByText('Программа пуста')).toBeInTheDocument()
    expect(getPreference('didCompleteInitialSeed')).toBe(true)
  })

  it('does not show when a routine day already exists', async () => {
    await createRoutineDay('Day A')
    renderApp('/routines')

    expect(await screen.findByText('Day A')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Готовая программа' })).not.toBeInTheDocument()
    await waitFor(() => expect(getPreference('didCompleteInitialSeed')).toBe(true))
  })
})
