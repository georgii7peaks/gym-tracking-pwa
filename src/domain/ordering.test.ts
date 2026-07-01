import { describe, it, expect } from 'vitest'
import { moveItem, nextOrder } from './ordering'

describe('ordering (§3.3)', () => {
  it('first item gets order 0, new items append at max+1', () => {
    expect(nextOrder([])).toBe(0)
    expect(nextOrder([{ order: 0 }])).toBe(1)
    // Non-contiguous existing orders still append after the max.
    expect(nextOrder([{ order: 0 }, { order: 5 }, { order: 2 }])).toBe(6)
  })

  it('moveItem reorders without mutating the input', () => {
    const items = ['a', 'b', 'c', 'd']
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(items, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(items).toEqual(['a', 'b', 'c', 'd']) // unchanged
  })

  it('moveItem is a no-op for out-of-range or same indexes', () => {
    const items = ['a', 'b', 'c']
    expect(moveItem(items, 1, 1)).toEqual(items)
    expect(moveItem(items, -1, 2)).toEqual(items)
    expect(moveItem(items, 0, 9)).toEqual(items)
  })
})
