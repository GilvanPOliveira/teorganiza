import type { CollectedProgress } from '@core/api'
import type { Goal } from './schema'

/** Where a goal stands: typed in, or followed from its source. */
export function goalProgress(goal: Goal, source?: CollectedProgress): { value: number; max: number; reached: boolean } {
  if (goal.source) {
    if (!source) return { value: 0, max: 1, reached: false }
    return { value: source.done, max: Math.max(source.total, 1), reached: source.total > 0 && source.done >= source.total }
  }
  return { value: goal.current, max: goal.target, reached: goal.current >= goal.target }
}
