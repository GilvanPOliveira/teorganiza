import { useMemo, useState } from 'react'
import { Accessibility, Plus, Star, Trash2, X } from 'lucide-react'
import { Attachments, Button, Card, useCollection, useFormat, useT } from '@core/api'
import { BodyMap } from './BodyMap'
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel, type Equipment, type ExerciseDef, type ExerciseKind, type Muscle } from './catalog'
import { useExerciseIndex, useSessions, useTrainingSettings, withIds } from './data'
import { bestOf, entryFor, lastEntry } from './logic'
import { ExerciseMedia } from './media'
import { PHOTOS } from './photos'
import { EMPTY_FILTER, ExerciseFilters, filterExercises, type ExerciseFilter } from './picker'
import type { CustomExercise, Session } from './schema'

const KINDS: ExerciseKind[] = ['weight', 'bodyweight', 'time', 'cardio']

/** Everything about one exercise: picture, muscles, how to do it, your marks. */
function ExerciseSheet({ exercise, onClose }: { exercise: ExerciseDef; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const [settings, setSettings] = useTrainingSettings()
  const sessions = withIds(useSessions()).filter((s) => s.finishedAt)
  const { remove } = useCollection<CustomExercise>('exercises')
  const favorite = settings.favorites.includes(exercise.id)
  const best = bestOf(sessions, { exerciseId: exercise.id, name: exercise.name })
  const last = lastEntry(sessions, { exerciseId: exercise.id, name: exercise.name })
  const lastDate = last ? sessions.find((s) => s.entries.includes(last))?.date : undefined

  return (
    <div className="to-palette__backdrop" onMouseDown={onClose}>
      <section className="to-palette to-exsheet" role="dialog" aria-modal="true" aria-label={exercise.name} onMouseDown={(e) => e.stopPropagation()}>
        <header className="to-nex__header">
          <strong>{exercise.name}</strong>
          <button
            type="button"
            className={`to-iconbutton to-iconbutton--small${favorite ? ' active' : ''}`}
            aria-pressed={favorite}
            aria-label={t(favorite ? 'library.unfavorite' : 'library.favorite')}
            onClick={() =>
              void setSettings({ favorites: favorite ? settings.favorites.filter((id) => id !== exercise.id) : [...settings.favorites, exercise.id] })
            }
          >
            <Star size={15} />
          </button>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('action.close')} onClick={onClose}>
            <X size={15} />
          </button>
        </header>
        <div className="to-exsheet__body">
          <ExerciseMedia exercise={exercise} size="large" />
          <div className="to-exercise__tags">
            <span className="to-tag">{muscleLabel(exercise.muscle)}</span>
            <span className="to-tag">{equipmentLabel(exercise.equipment)}</span>
            {t(`kind.${exercise.kind}`) !== equipmentLabel(exercise.equipment) && <span className="to-tag">{t(`kind.${exercise.kind}`)}</span>}
            {exercise.perSide && <span className="to-tag">{t('library.perSide')}</span>}
          </div>
          {exercise.instructions && <p>{exercise.instructions}</p>}
          <div className="to-exsheet__muscles">
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
      </section>
    </div>
  )
}

function CustomForm({ onDone }: { onDone: () => void }) {
  const t = useT()
  const { create } = useCollection<CustomExercise>('exercises')
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<Muscle>('peito')
  const [equipment, setEquipment] = useState<Equipment>('halteres')
  const [kind, setKind] = useState<ExerciseKind>('weight')
  const [perSide, setPerSide] = useState(false)
  const [instructions, setInstructions] = useState('')
  return (
    <Card title={t('library.newTitle')}>
      <form
        className="to-stack to-stack--tight"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await create({ name: name.trim(), muscle, secondary: [], equipment, kind, perSide, compound: false, instructions: instructions.trim() })
          onDone()
        }}
      >
        <input className="to-field__input" value={name} placeholder={t('library.newName')} aria-label={t('library.newName')} onChange={(e) => setName(e.target.value)} />
        <div className="to-toolbar">
          <select className="to-field__input" value={muscle} aria-label={t('library.muscle')} onChange={(e) => setMuscle(e.target.value as Muscle)}>
            {MUSCLES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <select className="to-field__input" value={equipment} aria-label={t('library.equipment')} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <select className="to-field__input" value={kind} aria-label={t('library.kind')} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </select>
          <label className="to-inline-field">
            <input type="checkbox" checked={perSide} onChange={(e) => setPerSide(e.target.checked)} />
            <span>{t('library.perSide')}</span>
          </label>
        </div>
        <textarea className="to-field__input" rows={2} value={instructions} placeholder={t('library.newInstructions')} aria-label={t('library.newInstructions')} onChange={(e) => setInstructions(e.target.value)} />
        <p className="to-muted">{t('library.mediaHint')}</p>
        <div className="to-toolbar">
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {t('library.create')}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            {t('action.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function LibraryScreen() {
  const t = useT()
  const { all } = useExerciseIndex()
  const [settings] = useTrainingSettings()
  const sessions = useSessions()
  const { update } = useCollection<Session>('sessions')
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER)
  const [creating, setCreating] = useState(false)
  const [byMuscle, setByMuscle] = useState(false)
  const [open, setOpen] = useState<ExerciseDef | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const shown = useMemo(() => filterExercises(all, filter, settings.favorites), [all, filter, settings.favorites])
  const active = sessions.find((s) => !s.data.finishedAt)

  const addToWorkout = (exercise: ExerciseDef) => {
    if (!active) return
    const finished = withIds(sessions).filter((s) => s.finishedAt)
    void update(active.id, { entries: [...active.data.entries, entryFor(exercise, finished, undefined, settings.rest)] })
    setAdded(exercise.id)
    window.setTimeout(() => setAdded(null), 1500)
  }

  return (
    <div className="to-stack">
      <div className="to-toolbar">
        <span className="to-muted">{t('library.count', { count: all.length })}</span>
        <span className="to-toolbar to-toolbar--tight to-push">
          <button type="button" className={`to-chip${byMuscle ? ' is-active' : ''}`} onClick={() => setByMuscle((v) => !v)}>
            <Accessibility size={13} /> {t('library.byMuscle')}
          </button>
        </span>
      </div>

      {byMuscle && (
        <section className="to-panel to-bodypick">
          <BodyMap
            primary={filter.muscle === 'all' ? [] : [filter.muscle]}
            size="large"
            onPickMuscle={(muscle) => setFilter({ ...filter, muscle: filter.muscle === muscle ? 'all' : muscle })}
          />
          <p className="to-muted">{filter.muscle === 'all' ? t('library.tapMuscle') : t('library.showing', { muscle: muscleLabel(filter.muscle) })}</p>
        </section>
      )}

      <ExerciseFilters filter={filter} onChange={setFilter} />

      {creating && <CustomForm onDone={() => setCreating(false)} />}

      <div className="to-exgrid">
        {!creating && (
          <button type="button" className="to-excard to-excard--new" onClick={() => setCreating(true)}>
            <span className="to-excard__thumb to-excard__thumb--new">
              <Plus size={20} />
            </span>
            <span className="to-excard__text">
              <strong>{t('library.new')}</strong>
              <span className="to-muted">{t('library.newHint')}</span>
            </span>
          </button>
        )}
        {shown.slice(0, 160).map((exercise) => (
          <div key={exercise.id} className="to-excard">
            <button type="button" className="to-excard__open" onClick={() => setOpen(exercise)}>
              <ExerciseMedia exercise={exercise} size="thumb" />
              <span className="to-excard__text">
                <strong>
                  {settings.favorites.includes(exercise.id) && <Star size={11} className="to-excard__star" />} {exercise.name}
                </strong>
                <span className="to-muted">
                  {muscleLabel(exercise.muscle)} · {equipmentLabel(exercise.equipment)}
                  {exercise.custom ? ` · ${t('library.custom')}` : ''}
                </span>
              </span>
            </button>
            {active && (
              <button type="button" className={`to-excard__add${added === exercise.id ? ' is-done' : ''}`} aria-label={t('library.addToWorkout', { name: exercise.name })} onClick={() => addToWorkout(exercise)}>
                <Plus size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      {shown.length === 0 && <p className="to-muted">{t('library.none')}</p>}

      {open && <ExerciseSheet exercise={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
