import { useState, type ReactNode } from 'react'
import { Minus, Plus, Search } from 'lucide-react'
import { useT } from '@core/api'
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel, searchKey, type Equipment, type ExerciseDef, type Muscle } from './catalog'

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

/**
 * Search, equipment and the buttons beside them; favorites, all and the
 * count; and the muscles, folded away under "Recolher" until wanted.
 */
export function ExerciseFilters({
  filter,
  onChange,
  actions,
  count,
}: {
  filter: ExerciseFilter
  onChange: (f: ExerciseFilter) => void
  /** Buttons after the equipment select. */
  actions?: ReactNode
  /** The count shown after the favorites and all chips. */
  count?: ReactNode
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const everything = filter.muscle === 'all' && !filter.favorites
  return (
    <div className="to-filters">
      <div className="to-filters__row">
        <label className="to-search to-filters__search">
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
          className="to-field__input to-filters__select"
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
        {actions}
      </div>

      <div className="to-filters__row">
        <button type="button" className={`to-chip${filter.favorites ? ' is-active' : ''}`} aria-pressed={filter.favorites} onClick={() => onChange({ ...filter, favorites: !filter.favorites })}>
          {t('library.favorites')}
        </button>
        <button type="button" className={`to-chip${everything ? ' is-active' : ''}`} aria-pressed={everything} onClick={() => onChange({ ...filter, muscle: 'all', favorites: false })}>
          {t('library.allMuscles')}
        </button>
        {!open && filter.muscle !== 'all' && (
          <button type="button" className="to-chip is-active" onClick={() => onChange({ ...filter, muscle: 'all' })}>
            {muscleLabel(filter.muscle)} ×
          </button>
        )}
        {count && <span className="to-muted to-filters__count">{count}</span>}
      </div>

      <button type="button" className="to-filters__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {t('library.fold')} {open ? <Minus size={14} /> : <Plus size={14} />}
      </button>
      {open && (
        <div className="to-chips">
          {MUSCLES.map((muscle) => (
            <button
              key={muscle.id}
              type="button"
              className={`to-chip${filter.muscle === muscle.id ? ' is-active' : ''}`}
              aria-pressed={filter.muscle === muscle.id}
              onClick={() => onChange({ ...filter, muscle: filter.muscle === muscle.id ? 'all' : muscle.id })}
            >
              {muscle.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const EMPTY_FILTER: ExerciseFilter = { query: '', muscle: 'all', equipment: 'all', favorites: false }
