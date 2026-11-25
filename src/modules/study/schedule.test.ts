import { describe, expect, it } from 'vitest'
import { newCard, review } from './schedule'

const TODAY = new Date(2026, 10, 25)

describe('spaced repetition', () => {
  it('a new card is due today', () => {
    expect(newCard('capital da França', 'Paris', null, TODAY)).toMatchObject({ due: '2026-11-25', interval: 0, reviews: 0 })
  })

  it('first answers set the first gap', () => {
    const card = newCard('a', 'b', null, TODAY)
    expect(review(card, 3, TODAY)).toMatchObject({ interval: 2, due: '2026-11-27', reviews: 1, ease: 2.5 })
    expect(review(card, 4, TODAY)).toMatchObject({ interval: 4, ease: 2.65 })
    expect(review(card, 2, TODAY)).toMatchObject({ interval: 1, ease: 2.35 })
  })

  it('good answers grow the interval by the ease', () => {
    const seen = { ...newCard('a', 'b', null, TODAY), interval: 10, reviews: 3 }
    expect(review(seen, 3, TODAY)).toMatchObject({ interval: 25, due: '2026-12-20' })
    expect(review(seen, 4, TODAY).interval).toBe(33)
    expect(review(seen, 2, TODAY).interval).toBe(12)
  })

  it('a miss starts over tomorrow and makes the card harder, never below 1.3', () => {
    const seen = { ...newCard('a', 'b', null, TODAY), interval: 30, reviews: 5, ease: 1.4 }
    expect(review(seen, 1, TODAY)).toMatchObject({ interval: 1, due: '2026-11-26', ease: 1.3 })
  })
})
