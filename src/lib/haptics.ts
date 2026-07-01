// Haptics wrapper (APP_SPECIFICATION.md §12). Three intents mapped to
// `navigator.vibrate` patterns; a no-op where the API is unsupported (most
// desktops, iOS Safari) so callers never need to feature-check.

export type HapticIntent = 'success' | 'warning' | 'selection'

const PATTERNS: Record<HapticIntent, number | number[]> = {
  success: 15,
  warning: [10, 40, 10],
  selection: 8,
}

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Fire a haptic for the given intent; safely does nothing when unsupported. */
export function haptic(intent: HapticIntent): void {
  if (!canVibrate()) return
  try {
    navigator.vibrate(PATTERNS[intent])
  } catch {
    /* ignore — vibrate can throw in some embedded contexts */
  }
}

export const haptics = {
  success: () => haptic('success'),
  warning: () => haptic('warning'),
  selection: () => haptic('selection'),
}
