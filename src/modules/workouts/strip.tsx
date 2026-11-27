import { useNavigate } from '@core/api'
import { useExerciseIndex } from './data'
import { ExerciseMedia } from './media'

/**
 * A routine's or a workout's exercises as pictures. Each one opens the
 * exercise in Exercícios, enlarged, so every screen leads to the same card.
 */
export function ExerciseStrip({ ids, small = false, onOpen }: { ids: (string | null)[]; small?: boolean; onOpen?: (exerciseId: string) => void }) {
  const index = useExerciseIndex()
  const navigate = useNavigate()
  const shown = ids.map((id) => index.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e))
  if (shown.length === 0) return null
  return (
    <div className={`to-today__strip${small ? ' to-strip--small' : ''}`}>
      {shown.map((exercise, i) => (
        <button
          key={`${i}-${exercise.id}`}
          type="button"
          className="to-today__ex"
          title={exercise.name}
          onClick={(e) => {
            e.stopPropagation()
            if (onOpen) onOpen(exercise.id)
            else navigate(`library/${encodeURIComponent(exercise.id)}`)
          }}
        >
          <ExerciseMedia exercise={exercise} size="thumb" />
          {!small && <span>{exercise.name}</span>}
        </button>
      ))}
    </div>
  )
}
