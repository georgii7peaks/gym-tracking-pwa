// Ordering rules (APP_SPECIFICATION.md §3.3), applied uniformly to Routine Days,
// Routine Exercises, and Exercise Logs. Sets also use an explicit `order` now
// (§13 fix), so the same helpers cover them.
//
// - New item's order = (max existing order) + 1; the first item gets 0.
// - After a reorder the sequence is rewritten to a contiguous 0..n-1.

/** The order value a new item should take when appended to `items`. */
export function nextOrder(items: readonly { order: number }[]): number {
  if (items.length === 0) return 0
  return Math.max(...items.map((i) => i.order)) + 1
}

/** Move the item at `from` to `to`, returning a new array (no mutation). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = items.slice()
  if (from === to || from < 0 || to < 0 || from >= copy.length || to >= copy.length) {
    return copy
  }
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}
