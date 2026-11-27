import { useCollection, useT } from '@core/api'
import type { ExerciseDef } from './catalog'
import { useRoutines, WEEKDAYS } from './data'
import { itemFromPlan, type ExercisePlan } from './logic'
import type { Routine } from './schema'

/**
 * Registering an exercise in the training plan: it goes into the routine
 * of each chosen weekday (made when the day has none), is updated where it
 * already is, and leaves the days no longer chosen.
 */
export function usePlanRegister() {
  const t = useT()
  const routines = useRoutines()
  const { create, update } = useCollection<Routine>('routines')

  const daysOf = (exerciseId: string) =>
    routines.filter((r) => r.data.weekday !== null && r.data.items.some((item) => item.exerciseId === exerciseId)).map((r) => r.data.weekday as number)

  const register = async (exercise: ExerciseDef, plan: ExercisePlan) => {
    let order = routines.length ? Math.max(...routines.map((r) => r.data.order)) + 1 : 0
    for (let day = 0; day < 7; day++) {
      const routine = routines.find((r) => r.data.weekday === day)
      const at = routine ? routine.data.items.findIndex((item) => item.exerciseId === exercise.id) : -1
      if (plan.days.includes(day)) {
        if (!routine) {
          await create({ name: t('sheet.dayRoutine', { day: WEEKDAYS[day] }), weekday: day, order: order++, items: [itemFromPlan(exercise.id, plan)] })
        } else if (at >= 0) {
          await update(routine.id, { items: routine.data.items.map((item, i) => (i === at ? itemFromPlan(exercise.id, plan, item) : item)) })
        } else {
          await update(routine.id, { items: [...routine.data.items, itemFromPlan(exercise.id, plan)] })
        }
      } else if (routine && at >= 0) {
        await update(routine.id, { items: routine.data.items.filter((_, i) => i !== at) })
      }
    }
  }

  // Everything the sheet shows: the weekday routines and the ones without a day.
  const count = routines.reduce((sum, r) => sum + r.data.items.length, 0)
  return { daysOf, register, count }
}

/**
 * Moving a routine to another weekday, or to none. The routine already on
 * that day takes the day it leaves, and a routine named after its day
 * ("Treino de Segunda") is renamed with it.
 */
export function useMoveRoutine() {
  const t = useT()
  const routines = useRoutines()
  const { update } = useCollection<Routine>('routines')
  const dayName = (day: number) => t('sheet.dayRoutine', { day: WEEKDAYS[day] })
  const renamed = (routine: Routine, to: number | null) =>
    routine.weekday !== null && to !== null && routine.name === dayName(routine.weekday) ? { name: dayName(to) } : {}

  return async (id: string, day: number | null) => {
    const routine = routines.find((r) => r.id === id)
    if (!routine || routine.data.weekday === day) return
    const from = routine.data.weekday
    if (day !== null) {
      const other = routines.find((r) => r.id !== id && r.data.weekday === day)
      if (other) await update(other.id, { weekday: from, ...renamed(other.data, from) })
    }
    await update(id, { weekday: day, ...renamed(routine.data, day) })
  }
}
