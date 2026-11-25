import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate as useRouterNavigate, useParams as useRouterParams } from 'react-router-dom'
import type { AppContextValue, Envelope, EventPayload, Query } from '@core/api/types'
import * as repository from '@core/db/repository'
import { translate } from '@core/i18n/catalog'
import { collectionPath } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { emitEvent, qualify } from '@core/runtime/events'
import { useModuleId } from '@core/runtime/module-context'

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */

const EMPTY: never[] = []

/** Reactive: the screen re-renders on its own when a sync brings new data. */
export function useRecords<T>(collection: string, query?: Query<T>): Envelope<T>[] {
  const moduleId = useModuleId()
  const path = collectionPath(moduleId, collection)
  const signature = JSON.stringify(query ?? null)

  return (
    useLiveQuery(
      () => repository.readAll<T>(path, query),
      [path, signature],
      EMPTY as Envelope<T>[],
    ) ?? (EMPTY as Envelope<T>[])
  )
}

export function useRecord<T>(collection: string, id: string): Envelope<T> | undefined {
  const moduleId = useModuleId()
  const path = collectionPath(moduleId, collection)
  return useLiveQuery(() => repository.readOne<T>(path, id), [path, id])
}

export function useCount<T>(collection: string, query?: Query<T>): number {
  return useRecords<T>(collection, query).length
}

export interface CollectionWriter<T> {
  /** Pass only `data` — the core fills in the whole envelope. */
  create: (data: T) => Promise<string>
  update: (id: string, patch: Partial<T>) => Promise<void>
  /** Writes a tombstone. Nothing is ever physically removed. */
  remove: (id: string) => Promise<void>
}

export function useCollection<T>(collection: string): CollectionWriter<T> {
  const moduleId = useModuleId()
  const { deviceId } = useAppState()
  const path = collectionPath(moduleId, collection)

  return useMemo<CollectionWriter<T>>(
    () => ({
      create: (data) => repository.createRecord<T>(path, data, deviceId),
      update: (id, patch) => repository.updateRecord<T>(path, id, patch, deviceId),
      remove: (id) => repository.removeRecord<T>(path, id, deviceId),
    }),
    [path, deviceId],
  )
}

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

export function useEmit(): (event: string, payload?: EventPayload) => void {
  const moduleId = useModuleId()
  return useCallback(
    (event, payload = {}) => emitEvent(qualify(moduleId, event), payload),
    [moduleId],
  )
}

/* ------------------------------------------------------------------ *
 * Module settings
 * ------------------------------------------------------------------ */

interface StoredSettings {
  moduleId: string
  values: Record<string, unknown>
}

export function useSettings<S extends Record<string, unknown>>(
  defaults: S,
): [S, (patch: Partial<S>) => Promise<void>] {
  const moduleId = useModuleId()
  const { deviceId } = useAppState()
  const path = collectionPath('core', 'settings')
  const defaultsKey = JSON.stringify(defaults)

  const stored = useLiveQuery(async () => {
    const rows = await repository.readAll<StoredSettings>(path, {
      where: { moduleId },
      limit: 1,
    })
    return rows[0]
  }, [path, moduleId])

  const values = useMemo(
    () => ({ ...defaults, ...(stored?.data.values as Partial<S> | undefined) }) as S,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stored, defaultsKey],
  )

  const patch = useCallback(
    async (next: Partial<S>) => {
      if (stored) {
        await repository.updateRecord<StoredSettings>(
          path,
          stored.id,
          { values: { ...stored.data.values, ...next } },
          deviceId,
        )
      } else {
        await repository.createRecord<StoredSettings>(
          path,
          { moduleId, values: { ...defaults, ...next } },
          deviceId,
        )
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, moduleId, deviceId, stored, defaultsKey],
  )

  return [values, patch]
}

/* ------------------------------------------------------------------ *
 * App context — read only
 * ------------------------------------------------------------------ */

export function useAppContext(): AppContextValue {
  const { locale, theme, deviceId, storage } = useAppState()
  return { locale, theme, deviceId, storage }
}

/* ------------------------------------------------------------------ *
 * i18n and formatting
 * ------------------------------------------------------------------ */

export function useT(): (key: string, vars?: Record<string, unknown>) => string {
  const moduleId = useModuleId()
  const { locale } = useAppState()
  return useCallback(
    (key, vars) => translate(locale, moduleId, key, vars),
    [locale, moduleId],
  )
}

export interface Formatter {
  /** Amounts are integer cents everywhere. Never a float. */
  money: (cents: number) => string
  date: (iso: string) => string
  dateTime: (iso: string) => string
  relative: (iso: string) => string
}

const CURRENCY_BY_LOCALE: Record<string, string> = {
  'pt-BR': 'BRL',
  en: 'USD',
}

export function useFormat(): Formatter {
  const { locale } = useAppState()

  return useMemo<Formatter>(() => {
    const currency = CURRENCY_BY_LOCALE[locale] ?? 'USD'
    const money = new Intl.NumberFormat(locale, { style: 'currency', currency })
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short' })
    const dateTime = new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

    return {
      money: (cents) => money.format(cents / 100),
      date: (iso) => date.format(new Date(iso)),
      dateTime: (iso) => dateTime.format(new Date(iso)),
      relative: (iso) => {
        const minutes = Math.round((Date.parse(iso) - Date.now()) / 60000)
        if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
        const hours = Math.round(minutes / 60)
        if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
        return relative.format(Math.round(hours / 24), 'day')
      },
    }
  }, [locale])
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

/** Paths are relative to the module; the shell owns the prefix. */
export function useNavigate(): (path: string) => void {
  const moduleId = useModuleId()
  const navigate = useRouterNavigate()
  return useCallback(
    (path: string) => navigate(`/${moduleId}/${path}`.replace(/\/+$/, '') || '/'),
    [moduleId, navigate],
  )
}

export function useParams<T extends Record<string, string | undefined>>(): T {
  return useRouterParams() as T
}
