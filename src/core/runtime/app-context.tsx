import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppContextValue, StorageState } from '@core/api/types'
import { getDeviceId } from '@core/device'
import { usePreferences, resolveTheme, savePreferences, type Preferences } from './preferences'
import { useSyncLifecycle, useSyncState } from './sync'

interface AppState extends AppContextValue {
  preferences: Preferences
  /** False until the stored preferences were read. */
  ready: boolean
  setPreferences: (patch: Partial<Preferences>) => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function AppProvider({ children }: { children: ReactNode }) {
  const { preferences, loaded } = usePreferences()
  const prefersDark = usePrefersDark()
  const theme = resolveTheme(preferences.theme, prefersDark)

  // Theme and accent live on <html>, so dialogs and the page background follow.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.accent = preferences.accent
    root.lang = preferences.locale
  }, [theme, preferences.accent, preferences.locale])

  useSyncLifecycle()
  const sync = useSyncState()
  // Read-only projection for modules: they may show sync state, never drive it.
  // kind === null is the evaluation state, not a third backend.
  const storage = useMemo<StorageState>(
    () => ({ kind: sync.kind, lastSyncAt: sync.lastSyncAt, pendingCount: sync.pendingCount }),
    [sync.kind, sync.lastSyncAt, sync.pendingCount],
  )
  const deviceId = useMemo(() => getDeviceId(), [])

  const value = useMemo<AppState>(
    () => ({
      locale: preferences.locale,
      theme,
      deviceId,
      storage,
      preferences,
      ready: loaded,
      setPreferences: savePreferences,
    }),
    [preferences, theme, deviceId, storage, loaded],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState(): AppState {
  const value = useContext(AppContext)
  if (!value) throw new Error('[TeOrganiza] AppProvider is missing above this tree.')
  return value
}

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => globalThis.matchMedia?.(DARK_QUERY).matches ?? true)
  useEffect(() => {
    const query = globalThis.matchMedia?.(DARK_QUERY)
    if (!query) return
    const onChange = () => setDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return dark
}
