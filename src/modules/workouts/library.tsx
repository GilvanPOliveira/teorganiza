import { FileText } from 'lucide-react'
import { useCollection, useNavigate, useT } from '@core/api'
import { ExerciseBrowser } from './browser'
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

/** The button that opens the training sheet, with how many exercises it has. */
export function SheetButton({ count }: { count: number }) {
  const t = useT()
  const navigate = useNavigate()
  return (
    <button type="button" className="to-chip is-active" onClick={() => navigate('sheet')}>
      <FileText size={13} /> {t('library.sheet', { count })}
    </button>
  )
}

/** Every exercise, each one registered in the plan from its own card. */
export function LibraryScreen() {
  const t = useT()
  const { daysOf, register, count } = usePlanRegister()
  return (
    <ExerciseBrowser
      toolbar={<SheetButton count={count} />}
      action={{ label: t('library.register'), withDays: true, keepOpen: true, onAdd: (exercise, plan) => void register(exercise, plan), daysOf }}
    />
  )
}
