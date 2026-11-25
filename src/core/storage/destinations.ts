import type { StorageKind } from '@core/api/types'
import { DiskWebAdapter, type DirectoryLike } from './disk-web'
import { ROOT_NAME } from './layout'
import type { StorageAdapter } from './types'

/**
 * Where the data goes, seen from the sync controller. Each destination
 * hides its own way of getting access — a Google token, a folder
 * permission — behind the same four questions.
 */
export interface Destination {
  readonly kind: StorageKind
  /** Usable right now, without asking the user for anything. */
  isReady(): Promise<boolean>
  /**
   * Gets access. Call only from a click: it may open the Google popup, the
   * folder picker or the browser's permission prompt. Throws when the user
   * cancels.
   */
  connect(): Promise<void>
  /** Only after `isReady()` or `connect()` succeeded. */
  createAdapter(): Promise<StorageAdapter>
  /** Ends this session's access; the destination stays chosen. */
  signOut(): void
  /** "Desconectar": forget the destination entirely. Never deletes its files. */
  forget(): Promise<void>
  /** A short name to show, e.g. the folder the user picked. */
  label(): Promise<string | null>
  /** Drive only: revoke the app's access at Google. */
  revoke?(): Promise<void>
}

/* ------------------------------------------------------------------ *
 * Google Drive
 * ------------------------------------------------------------------ */

export interface TokenAuth {
  readonly connected: boolean
  connect(): Promise<void>
  getAccessToken(): Promise<string>
  signOut(): void
  revoke(): Promise<void>
}

export function driveDestination(
  auth: TokenAuth,
  createAdapter: (auth: TokenAuth) => StorageAdapter,
): Destination {
  return {
    kind: 'drive',
    isReady: async () => auth.connected,
    connect: () => auth.connect(),
    createAdapter: async () => createAdapter(auth),
    signOut: () => auth.signOut(),
    forget: async () => auth.signOut(),
    label: async () => null,
    revoke: () => auth.revoke(),
  }
}

/* ------------------------------------------------------------------ *
 * A folder on this computer (File System Access API)
 * ------------------------------------------------------------------ */

type PermissionAnswer = 'granted' | 'denied' | 'prompt'

/** A directory handle as the browser gives it, with its permission calls. */
export interface FolderHandle extends DirectoryLike {
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionAnswer>
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionAnswer>
}

interface StoredFolder {
  /** The TeOrganiza folder itself. */
  root: FolderHandle
  /** What the user picked, for display. */
  picked: string
}

export interface FolderStore {
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
}

const META_FOLDER = 'folder'
const READ_WRITE = { mode: 'readwrite' } as const

/** True where the browser can open a folder for writing (Chrome, Edge). */
export function folderPickerAvailable(): boolean {
  return typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
}

/**
 * The handle survives in IndexedDB; the permission does not always. After
 * a reload the browser usually asks again, so — like an expired Google
 * token — the app waits for a click instead of prompting on its own.
 */
export function folderDestination(
  store: FolderStore,
  pick: () => Promise<FolderHandle> = defaultPicker,
): Destination {
  const read = () => store.getMeta<StoredFolder | null>(META_FOLDER)

  return {
    kind: 'disk-web',

    async isReady() {
      const stored = await read()
      if (!stored) return false
      // No permission API at all (tests, older engines): the handle is enough.
      const answer = (await stored.root.queryPermission?.(READ_WRITE)) ?? 'granted'
      return answer === 'granted'
    },

    async connect() {
      const stored = await read()
      if (stored) {
        const answer = (await stored.root.requestPermission?.(READ_WRITE)) ?? 'granted'
        if (answer !== 'granted') throw new Error('Folder access was not allowed')
        return
      }
      const picked = await pick()
      const root = picked.name === ROOT_NAME
        ? picked
        : ((await picked.getDirectoryHandle(ROOT_NAME, { create: true })) as FolderHandle)
      await store.setMeta(META_FOLDER, { root, picked: picked.name } satisfies StoredFolder)
    },

    async createAdapter() {
      const stored = await read()
      if (!stored) throw new Error('No folder chosen')
      return new DiskWebAdapter({ root: stored.root })
    },

    signOut() {
      // A folder permission cannot be dropped by the page; nothing to do.
    },

    async forget() {
      await store.setMeta(META_FOLDER, null)
    },

    async label() {
      return (await read())?.picked ?? null
    },
  }
}

async function defaultPicker(): Promise<FolderHandle> {
  const picker = (globalThis as {
    showDirectoryPicker?: (options: { id: string; mode: 'readwrite' }) => Promise<FolderHandle>
  }).showDirectoryPicker
  if (!picker) throw new Error('This browser cannot open folders')
  return picker({ id: 'teorganiza', mode: 'readwrite' })
}
