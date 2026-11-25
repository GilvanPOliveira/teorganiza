import { describe, expect, it } from 'vitest'
import { lastDays, streak } from './streak'

const TODAY = new Date(2026, 10, 25, 9, 0)

describe('habit streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streak(new Set(['2026-11-23', '2026-11-24', '2026-11-25']), TODAY)).toBe(3)
  })

  it('is not broken in the morning, before today is marked', () => {
    expect(streak(new Set(['2026-11-23', '2026-11-24']), TODAY)).toBe(2)
  })

  it('stops at the first gap', () => {
    expect(streak(new Set(['2026-11-20', '2026-11-22', '2026-11-24', '2026-11-25']), TODAY)).toBe(2)
    expect(streak(new Set(['2026-11-20']), TODAY)).toBe(0)
  })

  it('crosses months', () => {
    const marked = new Set(lastDays(40, TODAY))
    expect(streak(marked, TODAY)).toBe(40)
  })

  it('lists the last days oldest first, ending today', () => {
    const days = lastDays(28, TODAY)
    expect(days).toHaveLength(28)
    expect(days[0]).toBe('2026-10-29')
    expect(days[27]).toBe('2026-11-25')
  })
})
