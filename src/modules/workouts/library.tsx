import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Star, Trash2 } from 'lucide-react'
import { Attachments, Badge, Button, Card, useCollection, useFormat, useT } from '@core/api'
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel, type Equipment, type ExerciseDef, type ExerciseKind, type Muscle } from './catalog'
import { useExerciseIndex, useSessions, useTrainingSettings, withIds } from './data'
import { bestOf, lastEntry } from './logic'
import { EMPTY_FILTER, ExerciseFilters, filterExercises, type ExerciseFilter } from './picker'
import type { CustomExercise } from './schema'

const KINDS: ExerciseKind[] = ['weight', 'bodyweight', 'time', 'cardio']

function ExerciseRow({ exercise }: { exercise: ExerciseDef }) {
  const t = useT()
  const format = useFormat()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useTrainingSettings()
  const sessions = withIds(useSessions()).filter((s) => s.finishedAt)
  const { remove } = useCollection<CustomExercise>('exercises')
  const favorite = settings.favorites.includes(exercise.id)
  const best = open ? bestOf(sessions, { exerciseId: exercise.id, name: exercise.name }) : null
  const last = open ? lastEntry(sessions, { exerciseId: exercise.id, name: exercise.name }) : undefined
  const lastDate = last ? sessions.find((s) => s.entries.includes(last))?.date : undefined

  return (
    <li className="to-list__item to-list__item--wrap">
      <button type="button" className="to-list__main to-rowbutton" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="to-list__title">{exercise.name}</span>
        <span className="to-list__meta">
          <span>{muscleLabel(exercise.muscle)}</span>
          <span>{equipmentLabel(exercise.equipment)}</span>
          {exercise.custom && <Badge>{t('library.custom')}</Badge>}
        </span>
      </button>
      <div className="to-list__actions">
        <button
          type="button"
          className={`to-iconbutton to-iconbutton--small${favorite ? ' active' : ''}`}
          aria-pressed={favorite}
          aria-label={t(favorite ? 'library.unfavorite' : 'library.favorite')}
          onClick={() =>
            void setSettings({
              favorites: favorite ? settings.favorites.filter((id) => id !== exercise.id) : [...settings.favorites, exercise.id],
            })
          }
        >
          <Star size={14} />
        </button>
        {open ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
      </div>
      {open && (
        <div className="to-list__extra to-stack to-stack--tight">
          {exercise.instructions && <p>{exercise.instructions}</p>}
          <span className="to-list__meta">
            <span>{t(`kind.${exercise.kind}`)}</span>
            {exercise.secondary.length > 0 && <span>{t('library.secondary', { list: exercise.secondary.map(muscleLabel).join(', ') })}</span>}
            {exercise.perSide && <span>{t('library.perSide')}</span>}
          </span>
          {best && (best.oneRepMax > 0 || best.reps > 0 || best.seconds > 0) && (
            <span className="to-list__meta">
              {best.oneRepMax > 0 && <Badge tone="positive">{t('library.best1rm', { kg: best.oneRepMax })}</Badge>}
              {exercise.kind === 'bodyweight' && best.reps > 0 && <Badge tone="positive">{t('library.bestReps', { reps: best.reps })}</Badge>}
              {exercise.kind === 'time' && best.seconds > 0 && <Badge tone="positive">{t('library.bestTime', { s: best.seconds })}</Badge>}
              {lastDate && <span>{t('library.last', { date: format.date(lastDate) })}</span>}
            </span>
          )}
          {exercise.custom && (
            <>
              <Attachments collection="exercises" id={exercise.id.slice(2)} />
              <div className="to-toolbar">
                <Button variant="danger" onClick={() => confirm(t('library.removeConfirm', { name: exercise.name })) && void remove(exercise.id.slice(2))}>
                  <Trash2 size={14} />
                  {t('library.remove')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
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
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER)
  const [creating, setCreating] = useState(false)
  const shown = useMemo(() => filterExercises(all, filter, settings.favorites), [all, filter, settings.favorites])

  return (
    <div className="to-stack">
      {creating ? (
        <CustomForm onDone={() => setCreating(false)} />
      ) : (
        <div className="to-toolbar">
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} />
            {t('library.new')}
          </Button>
          <span className="to-muted">{t('library.count', { count: all.length })}</span>
        </div>
      )}
      <ExerciseFilters filter={filter} onChange={setFilter} />
      <ul className="to-list">
        {shown.slice(0, 150).map((exercise) => (
          <ExerciseRow key={exercise.id} exercise={exercise} />
        ))}
      </ul>
      {shown.length === 0 && <p className="to-muted">{t('library.none')}</p>}
    </div>
  )
}
