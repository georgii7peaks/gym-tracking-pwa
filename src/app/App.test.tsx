import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/renderApp'

describe('App shell', () => {
  it('renders the three tabs and the Workouts empty state in Russian by default', async () => {
    renderApp('/workouts')

    // Default language is Russian; the Workouts list shows its empty state.
    expect(screen.getByRole('heading', { name: 'Тренировки' })).toBeInTheDocument()
    expect(screen.getByText('Пока нет тренировок')).toBeInTheDocument()

    // All three tab labels are present.
    expect(screen.getByRole('link', { name: /Тренировки/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Программа/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Настройки/ })).toBeInTheDocument()
  })

  it('switches the whole UI language at runtime without reload', async () => {
    const user = userEvent.setup()
    renderApp('/settings')

    expect(screen.getByRole('heading', { name: 'Настройки' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'English' }))

    // Header + tab labels update immediately (no reload).
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Workouts/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Routines/ })).toBeInTheDocument()
  })
})
