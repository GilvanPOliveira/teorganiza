import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Envelope, Query } from '@core/api/types'
import * as repository from '@core/db/repository'
import { collectionPath } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'

const EMPTY: never[] = []

/**
 * The shell's own access to the core collections. Same envelope, same
 * repository, same sync as any module — the shell is simply not inside a
 * module scope, so it addresses its collections explicitly.
 */
export function useCoreRecords<T>(collection: string, query?: Query<T>): Envelope<T>[] {
  const path = collectionPath('core', collection)
  const signature = JSON.stringify(query ?? null)

  return (
    useLiveQuery(
      () => repository.readAll<T>(path, query),
      [path, signature],
      EMPTY as Envelope<T>[],
    ) ?? (EMPTY as Envelope<T>[])
  )
}

export function useCoreWriter<T>(collection: string) {
  const { deviceId } = useAppState()
  const path = collectionPath('core', collection)

  const create = useCallback(
    (data: T) => repository.createRecord<T>(path, data, deviceId),
    [path, deviceId],
  )
  const update = useCallback(
    (id: string, patch: Partial<T>) => repository.updateRecord<T>(path, id, patch, deviceId),
    [path, deviceId],
  )
  const remove = useCallback(
    (id: string) => repository.removeRecord<T>(path, id, deviceId),
    [path, deviceId],
  )

  return useMemo(() => ({ create, update, remove }), [create, update, remove])
}
