import { useNavigate, useParams, useT } from '@core/api'
import { ExerciseBrowser } from './browser'
import { useKeepPlanHistory } from './plans'
import { usePlanRegister } from './register'

/** The button that opens the training sheet, with how many exercises it has. */
export function SheetButton({ count }: { count: number }) {
  const t = useT()
  const navigate = useNavigate()
  return (
    <button type="button" className="to-filters__btn to-filters__btn--accent" onClick={() => navigate('sheet')}>
      {t('library.sheet', { count })}
    </button>
  )
}

/** Every exercise, each one registered in the plan from its own card. */
export function LibraryScreen() {
  const t = useT()
  const { daysOf, register, count } = usePlanRegister()
  useKeepPlanHistory()
  // Hoje, Rotinas and Histórico link here with an exercise to show enlarged.
  const { exerciseId } = useParams<{ exerciseId?: string }>()
  return (
    <ExerciseBrowser
      key={exerciseId ?? 'all'}
      initialOpen={exerciseId}
      toolbar={<SheetButton count={count} />}
      action={{ label: t('library.register'), withDays: true, keepOpen: true, onAdd: (exercise, plan) => void register(exercise, plan), daysOf }}
    />
  )
}
