import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AppContextValue, StorageState } from '@core/api/types'
import { getDeviceId } from '@core/device'
import { DEFAULT_LOCALE } from '@core/i18n/catalog'

interface AppState extends AppContextValue {
  setLocale: (locale: string) => void
  setTheme: (theme: 'light' | 'dark') => void
}

const AppContext = createContext<AppState | null>(null)

/** No destination yet: the evaluation state, not a third backend. */
const INITIAL_STORAGE: StorageState = {
  kind: null,
  lastSyncAt: null,
  pendingCount: 0,
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(DEFAULT_LOCALE)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const [storage] = useState<StorageState>(INITIAL_STORAGE)
  const deviceId = useMemo(() => getDeviceId(), [])

  const value = useMemo<AppState>(
    () => ({ locale, theme, deviceId, storage, setLocale, setTheme }),
    [locale, theme, deviceId, storage],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState(): AppState {
  const value = useContext(AppContext)
  if (!value) throw new Error('[TeOrganiza] AppProvider is missing above this tree.')
  return value
}
