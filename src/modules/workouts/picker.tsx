import { useMemo, useState } from 'react'
import { Search, Star, X } from 'lucide-react'
import { Badge, useT } from '@core/api'
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel, searchKey, type Equipment, type ExerciseDef, type Muscle } from './catalog'
import { useExerciseIndex, useTrainingSettings } from './data'

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

/** A dialog to choose one exercise. */
export function ExercisePicker({ onPick, onClose, title }: { onPick: (exercise: ExerciseDef) => void; onClose: () => void; title: string }) {
  const t = useT()
  const { all } = useExerciseIndex()
  const [settings] = useTrainingSettings()
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER)
  const shown = useMemo(() => filterExercises(all, filter, settings.favorites).slice(0, 80), [all, filter, settings.favorites])

  return (
    <div className="to-palette__backdrop" onMouseDown={onClose}>
      <section className="to-palette to-picker" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <header className="to-nex__header">
          <strong>{title}</strong>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('action.close')} onClick={onClose}>
            <X size={15} />
          </button>
        </header>
        <div className="to-picker__body">
          <ExerciseFilters filter={filter} onChange={setFilter} />
          <ul className="to-list">
            {shown.map((exercise) => (
              <li key={exercise.id} className="to-list__item">
                <button type="button" className="to-list__main to-rowbutton" onClick={() => onPick(exercise)}>
                  <span className="to-list__title">
                    {settings.favorites.includes(exercise.id) && <Star size={12} aria-hidden />} {exercise.name}
                  </span>
                  <span className="to-list__meta">
                    <span>{muscleLabel(exercise.muscle)}</span>
                    <span>{equipmentLabel(exercise.equipment)}</span>
                    {exercise.custom && <Badge>{t('library.custom')}</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="to-muted">{t('library.none')}</p>}
        </div>
      </section>
    </div>
  )
}
