import { toLocalISODate } from '@core/api'
import type { Card, Grade } from './schema'

/**
 * Spaced repetition in the SM-2 family, with the four answers of the
 * keyboard (1 errei, 2 difícil, 3 bom, 4 fácil):
 *
 *   1 — back to the start: see it again tomorrow, and it gets harder
 *   2 — a little longer than before, ease drops a bit
 *   3 — interval × ease
 *   4 — interval × ease × 1.3, ease rises
 */
export function review(card: Card, grade: Grade, today: Date = new Date()): Card {
  let { interval, ease } = card

  if (grade === 1) {
    interval = 1
    ease = Math.max(1.3, ease - 0.2)
  } else if (card.reviews === 0 || interval === 0) {
    interval = grade === 4 ? 4 : grade === 3 ? 2 : 1
    if (grade === 4) ease += 0.15
    if (grade === 2) ease = Math.max(1.3, ease - 0.15)
  } else if (grade === 2) {
    interval = Math.max(interval + 1, Math.round(interval * 1.2))
    ease = Math.max(1.3, ease - 0.15)
  } else if (grade === 3) {
    interval = Math.max(interval + 1, Math.round(interval * ease))
  } else {
    interval = Math.max(interval + 2, Math.round(interval * ease * 1.3))
    ease += 0.15
  }

  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + interval)
  return { ...card, interval, ease: Math.round(ease * 100) / 100, due: toLocalISODate(due), reviews: card.reviews + 1 }
}

export function newCard(front: string, back: string, courseId: string | null, today: Date = new Date()): Card {
  return { courseId, front, back, due: toLocalISODate(today), interval: 0, ease: 2.5, reviews: 0 }
}
