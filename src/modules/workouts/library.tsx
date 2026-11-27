import { useMemo, useState } from 'react'
import { Accessibility, Plus, Star } from 'lucide-react'
import { Button, Card, useCollection, useT } from '@core/api'
import { BodyMap } from './BodyMap'
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel, type Equipment, type ExerciseDef, type ExerciseKind, type Muscle } from './catalog'
import { useExerciseIndex, useSessions, useTrainingSettings, withIds } from './data'
import { ExerciseSheet } from './detail'
import { entryFor } from './logic'
import { ExerciseMedia } from './media'
import { EMPTY_FILTER, ExerciseFilters, filterExercises, type ExerciseFilter } from './picker'
import type { CustomExercise, Session } from './schema'

const KINDS: ExerciseKind[] = ['weight', 'bodyweight', 'time', 'cardio']

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
