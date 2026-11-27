import { useMemo } from 'react'
import { useRecords, useSettings, type Envelope } from '@core/api'
import { CATALOG, type ExerciseDef } from './catalog'
import type { PlanSettings } from './logic'
import type { CustomExercise, Routine, Session } from './schema'

export interface TrainingSettings extends PlanSettings, Record<string, unknown> {
  /** How effort is logged next to each set. */
  effort: 'none' | 'rir' | 'rpe'
  /** Default rest between sets, in seconds. */
  rest: number
  /** Exercise ids marked as favorites. */
  favorites: string[]
  /** Smallest load step on the bar, for warm-ups and rounding. */
  step: number
  sound: boolean
}

export const TRAINING_DEFAULTS: TrainingSettings = {
  mode: 'week',
  rotation: [],
  moved: {},
  effort: 'none',
  rest: 90,
  favorites: [],
  step: 2.5,
  sound: true,
}

export function useTrainingSettings() {
  return useSettings<TrainingSettings>(TRAINING_DEFAULTS)
}

/** A custom exercise's id, as entries and routines refer to it. */
export const customId = (recordId: string) => `c:${recordId}`

/** The catalog and the user's own exercises, as one list and one lookup. */
export function useExerciseIndex() {
  const custom = useRecords<CustomExercise>('exercises')
  return useMemo(() => {
    const own: ExerciseDef[] = custom.map((row) => ({ ...row.data, id: customId(row.id), custom: true }))
    const all = [...own, ...CATALOG].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const byId = new Map(all.map((exercise) => [exercise.id, exercise]))
    return { all, get: (id: string | null) => (id ? byId.get(id) : undefined) }
  }, [custom])
}

export function useSessions(): Envelope<Session>[] {
  return useRecords<Session>('sessions', { sort: { field: 'date', dir: 'desc' } })
}

export function useRoutines(): Envelope<Routine>[] {
  return useRecords<Routine>('routines', { sort: { field: 'order', dir: 'asc' } })
}

/** Sessions with their record id inside, as the pure helpers expect them. */
export function withIds(sessions: Envelope<Session>[]): (Session & { id: string })[] {
  return sessions.map((row) => ({ ...row.data, id: row.id }))
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
