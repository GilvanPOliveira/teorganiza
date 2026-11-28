import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import * as repository from '@core/db/repository'
import { collectionPath } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { EMPTY_PROFILE, profileFacts, type Measurement, type Profile, type ProfileFacts, type WeightEntry } from '@core/profile'
import { toLocalISODate } from './dates'
import type { Envelope } from './types'

const PROFILE_PATH = collectionPath('core', 'profile')
const WEIGHTS_PATH = collectionPath('core', 'weights')
const MEASURES_PATH = collectionPath('core', 'measurements')
const NO_MEASURES: Envelope<Measurement>[] = []
const NO_WEIGHTS: Envelope<WeightEntry>[] = []

export interface UseProfile {
  profile: Profile
  /** Newest first. */
  weights: Envelope<WeightEntry>[]
  facts: ProfileFacts
  /** False until anything at all has been filled in. */
  filled: boolean
  save: (patch: Partial<Profile>) => Promise<void>
  addWeight: (entry: WeightEntry) => Promise<void>
  removeWeight: (id: string) => Promise<void>
  /** Body measures (tape and composition), newest first. */
  measures: Envelope<Measurement>[]
  /** An assessment: several measures on one date; one per measure per day. */
  addMeasures: (date: string, values: Partial<Record<Measurement['key'], number>>) => Promise<void>
  removeMeasure: (id: string) => Promise<void>
}

/**
 * Meus dados, readable by every module: the one piece of personal data the
 * modules share, so none of them asks for age, height or weight again.
 */
export function useProfile(): UseProfile {
  const { deviceId } = useAppState()
  const stored = useLiveQuery(async () => (await repository.readAll<Profile>(PROFILE_PATH, { limit: 1 }))[0], [])
  const weights =
    useLiveQuery(() => repository.readAll<WeightEntry>(WEIGHTS_PATH, { sort: { field: 'date', dir: 'desc' } }), [], NO_WEIGHTS) ??
    NO_WEIGHTS

  const measures =
    useLiveQuery(() => repository.readAll<Measurement>(MEASURES_PATH, { sort: { field: 'date', dir: 'desc' } }), [], NO_MEASURES) ??
    NO_MEASURES

  const profile = useMemo(() => ({ ...EMPTY_PROFILE, ...stored?.data }), [stored])
  const today = toLocalISODate(new Date())
  const facts = useMemo(() => profileFacts(profile, weights.map((w) => w.data), today, measures.map((m) => m.data)), [profile, weights, today, measures])
  const filled =
    weights.length > 0 || Object.entries(profile).some(([key, value]) => (key === 'restrictions' ? value !== '' : key === 'flags' ? (value as unknown[]).length > 0 : value !== null))

  const save = useCallback(
    async (patch: Partial<Profile>) => {
      if (stored) await repository.updateRecord<Profile>(PROFILE_PATH, stored.id, patch, deviceId)
      else await repository.createRecord<Profile>(PROFILE_PATH, { ...EMPTY_PROFILE, ...patch }, deviceId)
    },
    [stored, deviceId],
  )

  /** One weighing per day: a second one the same day replaces it. */
  const addWeight = useCallback(
    async (entry: WeightEntry) => {
      const same = weights.find((w) => w.data.date === entry.date)
      if (same) await repository.updateRecord<WeightEntry>(WEIGHTS_PATH, same.id, entry, deviceId)
      else await repository.createRecord<WeightEntry>(WEIGHTS_PATH, entry, deviceId)
    },
    [weights, deviceId],
  )

  const removeWeight = useCallback((id: string) => repository.removeRecord<WeightEntry>(WEIGHTS_PATH, id, deviceId), [deviceId])

  const addMeasures = useCallback(
    async (date: string, values: Partial<Record<Measurement['key'], number>>) => {
      for (const [key, value] of Object.entries(values) as [Measurement['key'], number][]) {
        const same = measures.find((m) => m.data.date === date && m.data.key === key)
        if (same) await repository.updateRecord<Measurement>(MEASURES_PATH, same.id, { value }, deviceId)
        else await repository.createRecord<Measurement>(MEASURES_PATH, { date, key, value }, deviceId)
      }
    },
    [measures, deviceId],
  )

  const removeMeasure = useCallback((id: string) => repository.removeRecord<Measurement>(MEASURES_PATH, id, deviceId), [deviceId])

  return { profile, weights, facts, filled, save, addWeight, removeWeight, measures, addMeasures, removeMeasure }
}
