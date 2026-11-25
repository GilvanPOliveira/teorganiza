import { toLocalISODate } from '@core/api'

/** The last `days` calendar dates, oldest first, ending today. */
export function lastDays(days: number, today: Date = new Date()): string[] {
  return Array.from({ length: days }, (_, index) =>
    toLocalISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - index))),
  )
}

/**
 * Consecutive marked days ending today — or ending yesterday, so a streak
 * does not read as broken in the morning before today is marked.
 */
export function streak(marked: ReadonlySet<string>, today: Date = new Date()): number {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!marked.has(toLocalISODate(day))) day.setDate(day.getDate() - 1)
  let count = 0
  while (marked.has(toLocalISODate(day))) {
    count++
    day.setDate(day.getDate() - 1)
  }
  return count
}
