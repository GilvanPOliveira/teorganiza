import { useEffect, useRef } from 'react'
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
  const ref = useRef<HTMLDivElement>(null)

  // When the pictures do not fit, the mouse wheel scrolls them sideways instead of the page.
  useEffect(() => {
    const strip = ref.current
    if (!strip) return
    const onWheel = (e: WheelEvent) => {
      if (strip.scrollWidth <= strip.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const max = strip.scrollWidth - strip.clientWidth
      const next = Math.min(max, Math.max(0, strip.scrollLeft + e.deltaY))
      if (next === strip.scrollLeft) return
      e.preventDefault()
      strip.scrollLeft = next
    }
    strip.addEventListener('wheel', onWheel, { passive: false })
    return () => strip.removeEventListener('wheel', onWheel)
  }, [shown.length])

  if (shown.length === 0) return null
  return (
    <div ref={ref} className={`to-today__strip${small ? ' to-strip--small' : ''}`}>
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
