import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Plus, Search, Star, X } from 'lucide-react'
import { useT } from '@core/api'
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel, searchKey, type Equipment, type ExerciseDef, type Muscle } from './catalog'
import { useExerciseIndex, useTrainingSettings } from './data'
import { ExerciseDetail, FavoriteButton } from './detail'
import { ExerciseMedia } from './media'

export interface ExerciseFilter {
  query: string
  muscle: Muscle | 'all'
  equipment: Equipment | 'all'
  favorites: boolean
}

export function filterExercises(list: ExerciseDef[], filter: ExerciseFilter, favorites: string[]): ExerciseDef[] {
  const words = searchKey(filter.query).split(/\s+/).filter(Boolean)
  return list.filter((exercise) => {
    if (filter.favorites && !favorites.includes(exercise.id)) return false
    if (filter.muscle !== 'all' && exercise.muscle !== filter.muscle && !exercise.secondary.includes(filter.muscle)) return false
    if (filter.equipment !== 'all' && exercise.equipment !== filter.equipment) return false
    const haystack = searchKey(`${exercise.name} ${muscleLabel(exercise.muscle)} ${equipmentLabel(exercise.equipment)}`)
    return words.every((word) => haystack.includes(word))
  })
}

/** Search, muscle chips, equipment and favorites. Shared by the picker and the library. */
export function ExerciseFilters({ filter, onChange }: { filter: ExerciseFilter; onChange: (f: ExerciseFilter) => void }) {
  const t = useT()
  return (
    <div className="to-stack to-stack--tight">
      <div className="to-toolbar">
        <label className="to-search to-search--wide">
          <Search size={15} aria-hidden />
          <input
            className="to-search__input"
            value={filter.query}
            placeholder={t('library.search')}
            aria-label={t('library.search')}
            onChange={(e) => onChange({ ...filter, query: e.target.value })}
          />
        </label>
        <select
          className="to-field__input"
          value={filter.equipment}
          aria-label={t('library.equipment')}
          onChange={(e) => onChange({ ...filter, equipment: e.target.value as ExerciseFilter['equipment'] })}
        >
          <option value="all">{t('library.anyEquipment')}</option>
          {EQUIPMENT.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`to-chip${filter.favorites ? ' is-active' : ''}`}
          onClick={() => onChange({ ...filter, favorites: !filter.favorites })}
        >
          <Star size={12} /> {t('library.favorites')}
        </button>
      </div>
      <div className="to-chips">
        <button type="button" className={`to-chip${filter.muscle === 'all' ? ' is-active' : ''}`} onClick={() => onChange({ ...filter, muscle: 'all' })}>
          {t('library.allMuscles')}
        </button>
        {MUSCLES.map((muscle) => (
          <button
            key={muscle.id}
            type="button"
            className={`to-chip${filter.muscle === muscle.id ? ' is-active' : ''}`}
            onClick={() => onChange({ ...filter, muscle: muscle.id })}
          >
            {muscle.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export const EMPTY_FILTER: ExerciseFilter = { query: '', muscle: 'all', equipment: 'all', favorites: false }

/**
 * Choosing exercises: a grid of pictures. Tapping a card shows the
 * exercise (moving photo, muscles, how to do it); the round button picks
 * it. With `multiple`, several are picked and added together.
 */
export function ExercisePicker({
  title,
  onPick,
  onClose,
  multiple = false,
}: {
  title: string
  onPick: (exercises: ExerciseDef[]) => void
  onClose: () => void
  multiple?: boolean
}) {
  const t = useT()
  const { all, get } = useExerciseIndex()
  const [settings] = useTrainingSettings()
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER)
  const [chosen, setChosen] = useState<string[]>([])
  const [preview, setPreview] = useState<ExerciseDef | null>(null)
  const shown = useMemo(() => filterExercises(all, filter, settings.favorites).slice(0, 90), [all, filter, settings.favorites])

  const isChosen = (id: string) => chosen.includes(id)
  const choose = (exercise: ExerciseDef) => {
    if (!multiple) return onPick([exercise])
    setChosen((list) => (list.includes(exercise.id) ? list.filter((id) => id !== exercise.id) : [...list, exercise.id]))
  }
  const confirmChosen = () => onPick(chosen.map((id) => get(id)).filter((e): e is ExerciseDef => Boolean(e)))

  return (
    <div className="to-palette__backdrop" onMouseDown={onClose}>
      <section className="to-palette to-picker" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <header className="to-nex__header">
          {preview ? (
            <>
              <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('picker.back')} onClick={() => setPreview(null)}>
                <ArrowLeft size={15} />
              </button>
              <strong>{preview.name}</strong>
              <FavoriteButton exercise={preview} />
            </>
          ) : (
            <strong>{title}</strong>
          )}
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('action.close')} onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="to-picker__body">
          {preview ? (
            <ExerciseDetail exercise={preview} />
          ) : (
            <>
              <ExerciseFilters filter={filter} onChange={setFilter} />
              <p className="to-muted to-picker__hint">{t(multiple ? 'picker.hintMany' : 'picker.hint')}</p>
              <div className="to-exgrid to-exgrid--picker">
                {shown.map((exercise) => (
                  <div key={exercise.id} className={`to-excard${isChosen(exercise.id) ? ' is-chosen' : ''}`}>
                    <button type="button" className="to-excard__open" onClick={() => setPreview(exercise)}>
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
                    <button
                      type="button"
                      className={`to-excard__add${isChosen(exercise.id) ? ' is-done' : ''}`}
                      aria-pressed={multiple ? isChosen(exercise.id) : undefined}
                      aria-label={t('picker.pick', { name: exercise.name })}
                      onClick={() => choose(exercise)}
                    >
                      {isChosen(exercise.id) ? <Check size={15} /> : <Plus size={15} />}
                    </button>
                  </div>
                ))}
              </div>
              {shown.length === 0 && <p className="to-muted">{t('library.none')}</p>}
            </>
          )}
        </div>

        {preview ? (
          <footer className="to-picker__foot">
            <button
              type="button"
              className="to-pill"
              onClick={() => {
                choose(preview)
                setPreview(null)
              }}
            >
              {multiple && isChosen(preview.id) ? <X size={14} /> : <Check size={14} />}
              {t(multiple ? (isChosen(preview.id) ? 'picker.unselect' : 'picker.select') : 'picker.choose')}
            </button>
          </footer>
        ) : (
          multiple &&
          chosen.length > 0 && (
            <footer className="to-picker__foot">
              <span className="to-picker__chosen">
                {chosen.map((id) => {
                  const exercise = get(id)
                  return exercise ? <ExerciseMedia key={id} exercise={exercise} size="thumb" /> : null
                })}
              </span>
              <button type="button" className="to-pill" onClick={confirmChosen}>
                <Plus size={14} /> {t('picker.add', { count: chosen.length })}
              </button>
            </footer>
          )
        )}
      </section>
    </div>
  )
}
