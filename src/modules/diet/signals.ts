import type { Signal } from '@core/api'
import type { Meal } from './schema'

/**
 * The past week's average intake (kcal, and protein as the second value),
 * over the days anything was logged, today left out because it is not
 * over yet. Fewer than 3 logged days say too little, so nothing is offered.
 */
export function intakeSignal(meals: readonly Meal[], today: string): Signal | null {
  const start = new Date(`${today}T12:00:00`)
  start.setDate(start.getDate() - 7)
  const from = start.toISOString().slice(0, 10)
  const byDay = new Map<string, { kcal: number; protein: number }>()
  for (const meal of meals) {
    if (meal.date < from || meal.date >= today) continue
    const day = byDay.get(meal.date) ?? { kcal: 0, protein: 0 }
    day.kcal += meal.kcal
    day.protein += meal.protein
    byDay.set(meal.date, day)
  }
  if (byDay.size < 3) return null
  const days = [...byDay.values()]
  const avg = (pick: (d: { kcal: number; protein: number }) => number) => Math.round(days.reduce((n, d) => n + pick(d), 0) / days.length)
  const last = [...byDay.keys()].sort().at(-1)!
  return { key: 'intake', value: avg((d) => d.kcal), value2: avg((d) => d.protein), date: last, days: days.length }
}
