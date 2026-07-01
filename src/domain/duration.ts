// Duration helpers (APP_SPECIFICATION.md §6.4): durations render as M:SS.

export interface MinutesSeconds {
  minutes: number
  seconds: number
}

/** Split a total-seconds value into whole minutes + remaining seconds. */
export function splitDuration(totalSeconds: number): MinutesSeconds {
  const safe = Math.max(0, Math.floor(totalSeconds))
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 }
}

/** Combine minutes + seconds back into total seconds. */
export function combineDuration(minutes: number, seconds: number): number {
  return Math.max(0, Math.floor(minutes)) * 60 + Math.max(0, Math.floor(seconds))
}

/** Format seconds as `M:SS` (e.g. 90 -> "1:30", 5 -> "0:05"). */
export function formatDuration(totalSeconds: number): string {
  const { minutes, seconds } = splitDuration(totalSeconds)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
