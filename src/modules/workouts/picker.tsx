import { Search, Star } from 'lucide-react'
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
