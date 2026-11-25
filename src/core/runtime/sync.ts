import { useEffect, useSyncExternalStore } from 'react'
import { createRecord, readAll } from '@core/db/repository'
import { getDeviceId, getDeviceNickname } from '@core/device'
import { getCollections } from '@core/registry/registry'
import { DriveAdapter } from '@core/storage/drive'
import { GoogleAuth, googleClientId } from '@core/storage/google-auth'
import { SyncController, type SyncPolicy, type SyncState } from '@core/sync/controller'
import { countLive, countPending, dexieBaseStore, dexieLocalStore } from '@core/sync/stores'
import { readPreferences } from './preferences'

const DEFAULT_POLICY: SyncPolicy = 'on-leave'
/** Local edits do not notify sync; the counters catch up at this pace. */
const COUNT_REFRESH_MS = 15_000

let controller: SyncController | null = null

/**
 * The one sync controller of the app. Core-only: `@core/api` exposes the
 * resulting state through `useAppContext().storage`, never this object.
 */
export function getSyncController(): SyncController {
  if (controller) return controller
  const clientId = googleClientId()
  const paths = () => getCollections().map((c) => c.path)

  controller = new SyncController({
    auth: clientId ? new GoogleAuth(clientId) : null,
    createAdapter: (auth) => new DriveAdapter({ getAccessToken: () => auth.getAccessToken() }),
    local: dexieLocalStore,
    bases: dexieBaseStore,
    collections: () =>
      getCollections().map(({ path, def }) => ({
        path,
        describe: def.describe,
        partition: def.partition,
      })),
    counts: {
      pending: () => countPending(paths()),
      live: () => countLive(paths()),
    },
    device: () => ({ deviceId: getDeviceId(), nickname: getDeviceNickname() }),
    policy: readPolicy,
    persist: async () => (await navigator.storage?.persist?.()) ?? false,
  })
  return controller
}

export function useSyncState(): SyncState {
  const sync = getSyncController()
  return useSyncExternalStore(
    (listener) => sync.subscribe(listener),
    () => sync.getState(),
  )
}

/**
 * Mounted once, by the app provider: starts sync, hooks `visibilitychange`
 * (not `beforeunload`, which gives no time for a request and often does
 * not fire on phones) and keeps the counters fresh.
 */
export function useSyncLifecycle(): void {
  useEffect(() => {
    const sync = getSyncController()
    void sync
      .start()
      .then(registerThisDevice)
      .then(() => sync.refreshCounts())

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void sync.handleHidden()
      else void sync.handleVisible()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const counts = setInterval(() => void sync.refreshCounts(), COUNT_REFRESH_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(counts)
    }
  }, [])
}

async function readPolicy(): Promise<SyncPolicy> {
  return (await readPreferences()).syncPolicy ?? DEFAULT_POLICY
}

/**
 * Known devices travel with the data, so the conflict dialog and the lock
 * notice can name a device instead of showing an id.
 */
let registration: Promise<void> | null = null

function registerThisDevice(): Promise<void> {
  // Once per page: effects can run twice (StrictMode), and two concurrent
  // checks would both find the device missing.
  return (registration ??= registerOnce())
}

async function registerOnce(): Promise<void> {
  const deviceId = getDeviceId()
  const known = await readAll<{ deviceId: string }>('core/devices', { where: { deviceId } })
  if (known.length > 0) return
  await createRecord(
    'core/devices',
    { deviceId, nickname: getDeviceNickname(), lastSeenAt: new Date().toISOString() },
    deviceId,
  )
}
