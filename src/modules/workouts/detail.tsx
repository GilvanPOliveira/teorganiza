import { Star, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Attachments, Button, useCollection, useFormat, useT } from '@core/api'
import { BodyMap } from './BodyMap'
import { equipmentLabel, muscleLabel, type ExerciseDef } from './catalog'
import { useSessions, useTrainingSettings, withIds } from './data'
import { bestOf, lastEntry } from './logic'
import { ExerciseMedia } from './media'
import { PHOTOS } from './photos'
import type { CustomExercise } from './schema'

/** Picture, tags, how to do it, the muscles and your marks: one exercise at a glance. */
export function ExerciseDetail({ exercise }: { exercise: ExerciseDef }) {
  const t = useT()
  const format = useFormat()
  const sessions = withIds(useSessions()).filter((s) => s.finishedAt)
  const best = bestOf(sessions, { exerciseId: exercise.id, name: exercise.name })
  const last = lastEntry(sessions, { exerciseId: exercise.id, name: exercise.name })
  const lastDate = last ? sessions.find((s) => s.entries.includes(last))?.date : undefined
  const kind = t(`kind.${exercise.kind}`)

  return (
    <>
      <ExerciseMedia exercise={exercise} size="large" />
      <div className="to-exercise__tags">
        <span className="to-tag">{muscleLabel(exercise.muscle)}</span>
        <span className="to-tag">{equipmentLabel(exercise.equipment)}</span>
        {kind !== equipmentLabel(exercise.equipment) && <span className="to-tag">{kind}</span>}
        {exercise.perSide && <span className="to-tag">{t('library.perSide')}</span>}
      </div>
      {exercise.instructions && <p className="to-exsheet__howto">{exercise.instructions}</p>}
      <div className="to-exsheet__muscles">
        {/* Without a picture, the media above is already the body map. */}
        {(exercise.custom || PHOTOS.has(exercise.id)) && <BodyMap primary={[exercise.muscle]} secondary={exercise.secondary} size="small" />}
        <div className="to-stack to-stack--tight">
          <span>
            <strong>{t('library.main')}</strong> {muscleLabel(exercise.muscle)}
          </span>
          {exercise.secondary.length > 0 && (
            <span>
              <strong>{t('library.helps')}</strong> {exercise.secondary.map(muscleLabel).join(', ')}
            </span>
          )}
          {best.oneRepMax > 0 && <span>{t('library.best1rm', { kg: best.oneRepMax })}</span>}
          {exercise.kind === 'bodyweight' && best.reps > 0 && <span>{t('library.bestReps', { reps: best.reps })}</span>}
          {exercise.kind === 'time' && best.seconds > 0 && <span>{t('library.bestTime', { s: best.seconds })}</span>}
          {lastDate && <span className="to-muted">{t('library.last', { date: format.date(lastDate) })}</span>}
        </div>
      </div>
    </>
  )
}

/** The favorite star for one exercise. */
export function FavoriteButton({ exercise }: { exercise: ExerciseDef }) {
  const t = useT()
  const [settings, setSettings] = useTrainingSettings()
  const favorite = settings.favorites.includes(exercise.id)
  return (
    <button
      type="button"
      className={`to-iconbutton to-iconbutton--small${favorite ? ' active' : ''}`}
      aria-pressed={favorite}
      aria-label={t(favorite ? 'library.unfavorite' : 'library.favorite')}
      onClick={() => void setSettings({ favorites: favorite ? settings.favorites.filter((id) => id !== exercise.id) : [...settings.favorites, exercise.id] })}
    >
      <Star size={15} />
    </button>
  )
}

/**
 * Everything about one exercise in a dialog. Opened from the library, the
 * routine editor and the workout; `footer` adds the action of the place it
 * was opened from.
 */
export function ExerciseSheet({ exercise, onClose, footer }: { exercise: ExerciseDef; onClose: () => void; footer?: ReactNode }) {
  const t = useT()
  const { remove } = useCollection<CustomExercise>('exercises')

  return (
    <div className="to-palette__backdrop" onMouseDown={onClose}>
      <section className="to-palette to-exsheet" role="dialog" aria-modal="true" aria-label={exercise.name} onMouseDown={(e) => e.stopPropagation()}>
        <header className="to-nex__header">
          <strong>{exercise.name}</strong>
          <FavoriteButton exercise={exercise} />
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('action.close')} onClick={onClose}>
            <X size={15} />
          </button>
        </header>
        <div className="to-exsheet__body">
          <ExerciseDetail exercise={exercise} />
          {exercise.custom && (
            <>
              <h3 className="to-section-title">{t('library.media')}</h3>
              <Attachments collection="exercises" id={exercise.id.slice(2)} />
              <Button
                variant="danger"
                onClick={() => {
                  if (!confirm(t('library.removeConfirm', { name: exercise.name }))) return
                  void remove(exercise.id.slice(2))
                  onClose()
                }}
              >
                <Trash2 size={14} />
                {t('library.remove')}
              </Button>
            </>
          )}
        </div>
        {footer && <footer className="to-exsheet__foot">{footer}</footer>}
      </section>
    </div>
  )
}
