import { describe, expect, it } from 'vitest'
import { dockLayout } from '@core/shell/navigation'

describe('left dock layout', () => {
  it('is one column when every icon fits the height', () => {
    // 900px leaves room for 16 icons of 48px.
    expect(dockLayout(10, 900)).toEqual({ columns: 1, rows: 10 })
    expect(dockLayout(16, 900)).toEqual({ columns: 1, rows: 16 })
  })

  it('grows a second column instead of scrolling, with balanced rows', () => {
    expect(dockLayout(17, 900)).toEqual({ columns: 2, rows: 9 })
    expect(dockLayout(29, 900)).toEqual({ columns: 2, rows: 15 })
  })

  it('grows a third column on a short window', () => {
    // 768px fits 14 icons per column: 29 icons need three columns.
    expect(dockLayout(29, 768)).toEqual({ columns: 3, rows: 10 })
  })

  it('never divides by zero on a tiny window', () => {
    expect(dockLayout(5, 50)).toEqual({ columns: 5, rows: 1 })
  })
})
