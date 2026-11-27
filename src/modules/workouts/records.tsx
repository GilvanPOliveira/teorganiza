import { useMemo } from 'react'
import { useNavigate, useT } from '@core/api'
import { useExerciseIndex, useSessions, withIds } from './data'
import { bestOf } from './logic'
import { ExerciseMedia } from './media'

interface Mark {
  key: string
  exerciseId: string | null
  name: string
  kind: 'weight' | 'bodyweight' | 'time'
  value: number
}

/**
 * Personal bests from every finished workout: estimated 1RM for loaded
 * lifts, most reps for body-weight work, longest hold for timed work.
 */
export function useRecordsList(limit = 12): Mark[] {
  const sessions = withIds(useSessions()).filter((s) => s.finishedAt)
  return useMemo(() => {
    const seen = new Map<string, Mark>()
    for (const s of sessions) {
      for (const entry of s.entries) {
        const key = entry.exerciseId ?? entry.name.trim().toLocaleLowerCase()
        if (seen.has(key) || entry.kind === 'cardio') continue
        const best = bestOf(sessions, entry)
        const value = entry.kind === 'weight' ? best.oneRepMax : entry.kind === 'bodyweight' ? best.reps : best.seconds
        seen.set(key, { key, exerciseId: entry.exerciseId, name: entry.name, kind: entry.kind, value })
      }
    }
    const order = { weight: 0, bodyweight: 1, time: 2 }
    return [...seen.values()]
      .filter((m) => m.value > 0)
      .sort((a, b) => order[a.kind] - order[b.kind] || b.value - a.value)
      .slice(0, limit)
  }, [sessions, limit])
}

/** The records as rows with the exercise's picture; each opens the exercise. */
export function RecordsList({ marks }: { marks: Mark[] }) {
  const t = useT()
  const index = useExerciseIndex()
  const navigate = useNavigate()
  return (
    <ul className="to-records">
      {marks.map((mark) => {
        const def = index.get(mark.exerciseId)
        return (
          <li key={mark.key}>
            <button type="button" className="to-records__row" onClick={() => def && navigate(`library/${encodeURIComponent(def.id)}`)} disabled={!def}>
              {def ? <ExerciseMedia exercise={def} size="thumb" /> : <span className="to-records__nopic" />}
              <span className="to-records__name">{mark.name}</span>
              <strong>
                {mark.kind === 'weight'
                  ? t('records.oneRepMax', { kg: mark.value })
                  : mark.kind === 'bodyweight'
                    ? t('records.reps', { reps: mark.value })
                    : t('records.seconds', { s: mark.value })}
              </strong>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
