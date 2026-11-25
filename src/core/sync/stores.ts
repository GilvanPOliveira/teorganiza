import Dexie, { type Table } from 'dexie'
import type { Envelope } from '@core/api/types'
import { openDatabase, table } from '@core/db/database'
import { canonical } from './merge'
import type { BaseStore, LocalChange, LocalStore } from './engine'
import type { PartitionState } from './types'

/**
 * The working copy as sync sees it: raw rows, tombstones included, never
 * migrated — what goes back to the destination is what was there, so a
 * device on an older version of a module can still read it.
 */
export const dexieLocalStore: LocalStore = {
  async read(path) {
    return table<unknown>(path).toArray()
  },

  async commit(path, changes: LocalChange[]) {
    if (changes.length === 0) return
    const rows = table<unknown>(path)
    await openDatabase().transaction('rw', rows, async () => {
      for (const { before, after } of changes) {
        const id = (after ?? before)!.id
        const current = await rows.get(id)
        const untouched = before === undefined ? current === undefined : current !== undefined && canonical(current) === canonical(before)
        if (!untouched) continue // edited while syncing: stays pending
        if (after) await rows.put(after)
        else await rows.delete(id)
      }
    })
  },
}

interface BaseRow {
  key: string // '<collectionPath>#<partition>'
  path: string
  partition: string
  state: PartitionState
}

interface MetaRow {
  key: string
  value: unknown
}

/**
 * Sync state lives in its own database, apart from the working copy: it
 * is not user data, it is bookkeeping about one destination, and dropping
 * it (disconnecting) must never touch a single record.
 */
class SyncDatabase extends Dexie {
  bases!: Table<BaseRow, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('teorganiza-sync')
    this.version(1).stores({ bases: 'key, path', meta: 'key' })
  }
}

let syncDb: SyncDatabase | null = null
function db(): SyncDatabase {
  return (syncDb ??= new SyncDatabase())
}

export const dexieBaseStore: BaseStore & {
  clear(): Promise<void>
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
} = {
  async load(path) {
    const rows = await db().bases.where('path').equals(path).toArray()
    return new Map(rows.map((row) => [row.partition, row.state]))
  },
  async save(path, partition, state) {
    await db().bases.put({ key: `${path}#${partition}`, path, partition, state })
  },
  async isConnected() {
    return (await db().meta.get('connected'))?.value === true
  },
  async markConnected() {
    await db().meta.put({ key: 'connected', value: true })
  },
  /** Forgets everything about the destination. The working copy stays. */
  async clear() {
    await db().transaction('rw', db().bases, db().meta, async () => {
      await db().bases.clear()
      await db().meta.clear()
    })
  },
  async getMeta<T>(key: string) {
    return (await db().meta.get(key))?.value as T | undefined
  },
  async setMeta(key, value) {
    await db().meta.put({ key, value })
  },
}

/** Rows with local edits not yet sent: the queue that must never be lost. */
export async function countPending(paths: string[]): Promise<number> {
  let count = 0
  for (const path of paths) count += await table<unknown>(path).filter((r: Envelope<unknown>) => r.rev > 0).count()
  return count
}

/** Live records on this device — what is at risk with no destination. */
export async function countLive(paths: string[]): Promise<number> {
  let count = 0
  for (const path of paths) count += await table<unknown>(path).filter((r) => r.deletedAt === null).count()
  return count
}

/** Only for tests. */
export async function resetSyncDatabase(): Promise<void> {
  await dexieBaseStore.clear()
}
