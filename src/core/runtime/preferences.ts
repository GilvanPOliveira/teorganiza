import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Envelope } from '@core/api/types'
import { ACCENTS } from '@core/collections'
import * as repository from '@core/db/repository'
import { getDeviceId } from '@core/device'
import { DEFAULT_LOCALE } from '@core/i18n/catalog'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type Accent = (typeof ACCENTS)[number]
export type Navigation = 'dock' | 'sidebar'
export type SyncPolicyChoice = 'manual' | 'on-leave' | 'periodic' | 'always'

export interface Preferences {
  theme: ThemeChoice
  locale: string
  syncPolicy: SyncPolicyChoice
  accent: Accent
  navigation: Navigation
  disabledModules: string[]
}

const PATH = 'core/preferences'

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  locale: DEFAULT_LOCALE,
  syncPolicy: 'on-leave',
  accent: 'blue',
  navigation: 'dock',
  disabledModules: [],
}

export { ACCENTS }

/** Fills what an older record does not carry. */
export function withDefaults(stored: Partial<Preferences> | undefined): Preferences {
  return { ...DEFAULT_PREFERENCES, ...stripUndefined(stored ?? {}) }
}

/**
 * One record per user, synced like any other — that is what makes the
 * theme and the enabled modules follow you to the next device. Two devices
 * creating it offline produce two records; the oldest wins on read, so the
 * choice is stable everywhere.
 */
async function readRecord(): Promise<Envelope<Partial<Preferences>> | undefined> {
  const rows = await repository.readAll<Partial<Preferences>>(PATH)
  return rows.sort((a, b) => a.id.localeCompare(b.id))[0]
}

export async function readPreferences(): Promise<Preferences> {
  return withDefaults((await readRecord())?.data)
}

export async function savePreferences(patch: Partial<Preferences>): Promise<void> {
  const deviceId = getDeviceId()
  const current = await readRecord()
  if (current) {
    await repository.updateRecord<Partial<Preferences>>(PATH, current.id, patch, deviceId)
  } else {
    await repository.createRecord<Preferences>(PATH, { ...DEFAULT_PREFERENCES, ...patch }, deviceId)
  }
}

/** `loaded` is false until the database answered, so nothing flashes. */
export function usePreferences(): { preferences: Preferences; loaded: boolean } {
  const result = useLiveQuery(async () => ({ data: (await readRecord())?.data }), [])
  return { preferences: withDefaults(result?.data), loaded: result !== undefined }
}

export function useSavePreferences(): (patch: Partial<Preferences>) => Promise<void> {
  return useCallback((patch) => savePreferences(patch), [])
}

export function isModuleEnabled(preferences: Preferences, moduleId: string): boolean {
  return !preferences.disabledModules.includes(moduleId)
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): 'light' | 'dark' {
  if (choice === 'system') return prefersDark ? 'dark' : 'light'
  return choice
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}
