import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { fileCategory, useBlobUrl, useFiles } from '@core/api'
import { BodyMap } from './BodyMap'
import type { ExerciseDef } from './catalog'
import { PHOTOS } from './photos'

/** The first image or video the user attached to a custom exercise. */
function useOwnMedia(exercise: ExerciseDef) {
  const files = useFiles(exercise.custom ? { path: 'workouts/exercises', id: exercise.id.slice(2) } : null)
  const own = exercise.custom ? files.find((f) => ['image', 'video'].includes(fileCategory(f.data))) : undefined
  const url = useBlobUrl(own?.data.hash ?? null)
  return own && url ? { url, video: fileCategory(own.data) === 'video' } : null
}

/**
 * How an exercise is shown: its photo pair played as a two-frame motion,
 * the user's own photo or video for a custom exercise, or the worked
 * muscles on the body when there is no picture.
 */
export function ExerciseMedia({ exercise, size }: { exercise: ExerciseDef; size: 'thumb' | 'large' }) {
  const own = useOwnMedia(exercise)
  const photo = !exercise.custom && PHOTOS.has(exercise.id)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!photo || !playing || size === 'thumb') return
    const timer = window.setInterval(() => setFrame((f) => 1 - f), 1100)
    return () => window.clearInterval(timer)
  }, [photo, playing, size])

  let content
  if (own) {
    content = own.video ? (
      <video className="to-media__img" src={own.url} autoPlay={size === 'large'} loop muted playsInline />
    ) : (
      <img className="to-media__img" src={own.url} alt="" />
    )
  } else if (photo) {
    content = (
      <>
        <img className="to-media__img" src={`/exercises/${exercise.id}/0.jpg`} alt="" loading="lazy" hidden={frame !== 0} />
        <img className="to-media__img" src={`/exercises/${exercise.id}/1.jpg`} alt="" loading="lazy" hidden={frame !== 1} />
      </>
    )
  } else {
    content = <BodyMap primary={[exercise.muscle]} secondary={exercise.secondary} size={size === 'thumb' ? 'tiny' : 'large'} />
  }

  return (
    <div className={`to-media to-media--${size}${photo || own ? ' has-picture' : ''}`} aria-hidden={size === 'thumb'}>
      {content}
      {photo && size === 'large' && (
        <button type="button" className="to-media__toggle" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pausar' : 'Animar'}>
          {playing ? <Pause size={12} /> : <Play size={12} />}
          {playing ? 'pausar' : 'animar'}
        </button>
      )}
    </div>
  )
}
