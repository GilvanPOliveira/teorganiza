import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'
import { useNavigate, useT } from '@core/api'
import { useExerciseIndex, useGuidance } from './data'
import { flagsFor } from './guidance'
import { ExerciseMedia } from './media'

/**
 * A routine's or a workout's exercises as pictures. Each one opens the
 * exercise in Exercícios, enlarged, so every screen leads to the same card.
 *
 * When they don't all fit, the side that hides more pictures fades out and
 * shows an arrow, so it is clear there is more and one click reveals it.
 * The mouse wheel scrolls it sideways too (core/wheelScroll).
 */
export function ExerciseStrip({ ids, small = false, onOpen }: { ids: (string | null)[]; small?: boolean; onOpen?: (exerciseId: string) => void }) {
  const index = useExerciseIndex()
  const t = useT()
  const guidance = useGuidance()
  const navigate = useNavigate()
  const shown = ids.map((id) => index.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e))
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ before: false, after: false })

  const measure = useCallback(() => {
    const strip = ref.current
    if (!strip) return
    const max = strip.scrollWidth - strip.clientWidth
    const before = max > 1 && strip.scrollLeft > 1
    const after = max > 1 && strip.scrollLeft < max - 1
    setMore((m) => (m.before === before && m.after === after ? m : { before, after }))
  }, [])

  useEffect(() => {
    const strip = ref.current
    if (!strip) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    for (const child of Array.from(strip.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [measure, shown.length])

  const step = (e: React.MouseEvent, direction: 1 | -1) => {
    e.stopPropagation()
    const strip = ref.current
    if (strip)
      strip.scrollBy({
        left: direction * strip.clientWidth * 0.8,
        behavior: 'smooth',
      })
  }

  if (shown.length === 0) return null
  return (
    <div className={`to-strip${small ? ' to-strip--compact' : ''}${more.before ? ' has-before' : ''}${more.after ? ' has-after' : ''}`}>
      <div ref={ref} className={`to-today__strip${small ? ' to-strip--small' : ''}`} onScroll={measure}>
        {shown.map((exercise, i) => {
          // Marked when the person's restrictions touch it: red to avoid, amber to do with care.
          const flags = flagsFor(exercise.id, guidance)
          const level = flags[0]?.level
          const why = (wanted: 'avoid' | 'caution') =>
            flags
              .filter((f) => f.level === wanted)
              .map((f) => t(`flag.${f.restriction}`))
              .join(', ')
          const title = [exercise.name, why('avoid') && t('flag.avoid', { what: why('avoid') }), why('caution') && t('flag.caution', { what: why('caution') })].filter(Boolean).join(' — ')
          return (
            <button
              key={`${i}-${exercise.id}`}
              type="button"
              className={`to-today__ex${level ? ` is-${level}` : ''}`}
              title={title}
              onClick={(e) => {
                e.stopPropagation()
                if (onOpen) onOpen(exercise.id)
                else navigate(`library/${encodeURIComponent(exercise.id)}`)
              }}
            >
              <ExerciseMedia exercise={exercise} size="thumb" />
              {level && (
                <span className="to-today__flag" aria-label={title}>
                  <TriangleAlert size={small ? 9 : 11} />
                </span>
              )}
              {!small && <span>{exercise.name}</span>}
            </button>
          )
        })}
      </div>
      <button type="button" className="to-strip__arrow to-strip__arrow--before" aria-label="Anteriores" tabIndex={-1} onClick={(e) => step(e, -1)}>
        <ChevronLeft size={small ? 14 : 18} />
      </button>
      <button type="button" className="to-strip__arrow to-strip__arrow--after" aria-label="Próximos" tabIndex={-1} onClick={(e) => step(e, 1)}>
        <ChevronRight size={small ? 14 : 18} />
      </button>
    </div>
  )
}
