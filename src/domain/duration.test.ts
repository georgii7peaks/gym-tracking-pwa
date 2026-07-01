import { describe, it, expect } from 'vitest'
import { combineDuration, formatDuration, splitDuration } from './duration'

describe('duration (§6.4)', () => {
  it('splits and combines minutes/seconds', () => {
    expect(splitDuration(90)).toEqual({ minutes: 1, seconds: 30 })
    expect(splitDuration(5)).toEqual({ minutes: 0, seconds: 5 })
    expect(combineDuration(1, 30)).toBe(90)
    expect(combineDuration(2, 0)).toBe(120)
  })

  it('formats as M:SS with zero-padded seconds', () => {
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(605)).toBe('10:05')
  })
})
