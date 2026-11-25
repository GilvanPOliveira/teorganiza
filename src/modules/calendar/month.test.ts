import { describe, expect, it } from 'vitest'
import { monthGrid } from './month'

describe('monthGrid', () => {
  it('starts on the Sunday before the 1st and always has six weeks', () => {
    // November 2026 starts on a Sunday.
    const grid = monthGrid(2026, 10)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toEqual({ date: '2026-11-01', inMonth: true })
    expect(grid[29]).toEqual({ date: '2026-11-30', inMonth: true })
    expect(grid[30]).toEqual({ date: '2026-12-01', inMonth: false })
  })

  it('pads with the previous month', () => {
    // December 2026 starts on a Tuesday.
    const grid = monthGrid(2026, 11)
    expect(grid.slice(0, 3)).toEqual([
      { date: '2026-11-29', inMonth: false },
      { date: '2026-11-30', inMonth: false },
      { date: '2026-12-01', inMonth: true },
    ])
  })
})
