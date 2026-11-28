import type { Signal } from '@core/api'
import type { Routine, Session } from './schema'

/**
 * Whether today is a training day, for meals to plan around it: 1 when a
 * workout was finished today, 2 when a routine is set for today's weekday.
 */
export function trainingSignal(sessions: readonly Session[], routines: readonly Routine[], today: string): Signal | null {
  if (sessions.some((s) => s.date === today && s.finishedAt)) return { key: 'training', value: 1, date: today }
  const weekday = new Date(`${today}T12:00:00`).getDay()
  if (routines.some((r) => r.weekday === weekday && r.items.length > 0)) return { key: 'training', value: 2, date: today }
  return null
}
