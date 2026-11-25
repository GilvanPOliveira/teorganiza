import { toLocalISODate } from '@core/api'

/**
 * The 6×7 grid of a month view, starting on Sunday, padded with the days
 * of the months around it.
 */
export function monthGrid(year: number, month: number): { date: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    return { date: toLocalISODate(day), inMonth: day.getMonth() === month }
  })
}
