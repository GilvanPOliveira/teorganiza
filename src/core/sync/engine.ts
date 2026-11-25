import type { Envelope } from '@core/api/types'
import { ConcurrentWriteError, EtagMismatchError } from '@core/storage/errors'
import type { StorageAdapter } from '@core/storage/types'
import { applyResolutions, canonical, mergePartition, type ConflictChoice } from './merge'
import type { Conflict, MergeResult, PartitionState } from './types'

type Rec = Envelope<unknown>

export const DEFAULT_PARTITION = 'all'
const MAX_ATTEMPTS = 5

/** The working copy, as seen by sync: every row, tombstones included. */
export interface LocalStore {
  read(collectionPath: string): Promise<Rec[]>
  /**
   * Applies each change only if the row still equals `before` — an edit
   * made while sync was running is never overwritten; it simply stays
   * pending for the next round. `after: null` removes the row, used only
   * when the user chose to import the destination over this device.
   */
  commit(collectionPath: string, changes: LocalChange[]): Promise<void>
}

export interface LocalChange {
  before: Rec | undefined
  after: Rec | null
}

/** Per partition: what the destination held at the last successful sync. */
export interface BaseStore {
  load(collectionPath: string): Promise<Map<string, PartitionState>>
  save(collectionPath: string, partition: string, state: PartitionState): Promise<void>
  /** True once this device completed a first sync with this destination. */
  isConnected(): Promise<boolean>
  markConnected(): Promise<void>
}

export interface SyncCollection {
  path: string
  describe: (record: Rec) => string
  partition?: (record: Rec) => string
}

/**
 * First connection of a device that already has data to a destination
 * that already has data: there is no base, so the app does not guess.
 */
export type FirstSyncChoice = 'import' | 'send' | 'merge'

export type SyncOutcome =
  | { status: 'first-sync' }
  | { status: 'done'; pulled: number; pushed: number; conflicts: Conflict[] }

export interface SyncOptions {
  /** The user's answers from the conflict dialog, by record id. */
  resolutions?: ReadonlyMap<string, ConflictChoice>
  firstSync?: FirstSyncChoice
}

interface RemotePartition {
  records: Rec[]
  etag: string
}

/**
 * Pull and push as one operation, per collection.
 *
 * The unit is the collection, not the file: a record can move between
 * partitions (a transaction whose date changes month), and only a view of
 * the whole collection can tell a move from a delete and an add. After the
 * merge the records are re-partitioned, and only partitions whose content
 * changed are written — each one whole, each one advancing its own base
 * and etag only after it succeeded.
 *
 * A collection with an undecided conflict is not written at all; the
 * others go ahead.
 */
export class SyncEngine {
  constructor(
    private readonly adapter: StorageAdapter,
    private readonly local: LocalStore,
    private readonly bases: BaseStore,
    private readonly collections: () => SyncCollection[],
  ) {}

  async syncAll(options: SyncOptions = {}): Promise<SyncOutcome> {
    const collections = this.collections()
    let firstSync = options.firstSync

    if (!(await this.bases.isConnected()) && !firstSync) {
      if ((await this.hasLocalData(collections)) && (await this.hasRemoteData(collections))) {
        return { status: 'first-sync' }
      }
      // One side is empty: there is nothing to confuse, a plain merge is exact.
      firstSync = 'merge'
    }

    let pulled = 0
    let pushed = 0
    const conflicts: Conflict[] = []
    for (const collection of collections) {
      const result = await this.syncCollection(collection, options.resolutions, firstSync)
      pulled += result.pulled
      pushed += result.pushed
      conflicts.push(...result.conflicts)
    }

    // Even with conflicts left open: the collections that synced now have a
    // base, and the ones that did not merge against an empty base next time
    // — which is exactly what "merge" means on a first sync.
    if (firstSync) await this.bases.markConnected()
    return { status: 'done', pulled, pushed, conflicts }
  }

  private async syncCollection(
    collection: SyncCollection,
    resolutions: ReadonlyMap<string, ConflictChoice> = new Map(),
    firstSync: FirstSyncChoice | undefined,
  ): Promise<{ pulled: number; pushed: number; conflicts: Conflict[] }> {
    // Versions that were overwritten by a racing write, to merge back in.
    const recovered = new Map<string, Rec[]>()

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.attempt(collection, resolutions, firstSync, recovered)
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS) throw error
        if (error instanceof ConcurrentWriteError) {
          const partition = error.path.slice(collection.path.length + 1)
          const theirs = await this.adapter.readVersion?.(collection.path, partition, error.overwritten)
          if (theirs) recovered.set(partition, theirs)
          continue
        }
        if (error instanceof EtagMismatchError) continue
        throw error
      }
    }
  }

  private async attempt(
    collection: SyncCollection,
    resolutions: ReadonlyMap<string, ConflictChoice>,
    firstSync: FirstSyncChoice | undefined,
    recovered: Map<string, Rec[]>,
  ) {
    const { path } = collection
    const bases = firstSync ? new Map<string, PartitionState>() : await this.bases.load(path)
    const remoteParts = await this.readRemote(path)

    // After a lost race the destination holds our write, merged from the
    // old base. Merging the overwritten version against that same base is
    // a plain three-way merge of "ours" and "theirs".
    for (const [partition, theirs] of recovered) {
      const current = remoteParts.get(partition)
      if (current) remoteParts.set(partition, { records: theirs, etag: current.etag })
    }

    const base = flatten([...bases.values()].map((b) => b.base))
    const remote = flatten([...remoteParts.values()].map((p) => p.records))
    const local = await this.local.read(path)
    const localById = new Map(local.map((r) => [r.id, r]))

    let result: MergeResult
    if (firstSync === 'import') result = { merged: remote, conflicts: [] }
    else if (firstSync === 'send') result = { merged: local, conflicts: [] }
    else result = mergePartition(base, local, remote, { collectionPath: path, describe: collection.describe })

    const open = result.conflicts.filter((c) => !resolutions.has(c.id))
    if (open.length > 0) return { pulled: 0, pushed: 0, conflicts: open }
    const final = applyResolutions(result, resolutions)

    let pulled = 0
    if (firstSync === 'import') {
      const kept = new Set(final.map((r) => r.id))
      const dropped = local.filter((r) => !kept.has(r.id)).map((r) => ({ before: r, after: null }))
      await this.local.commit(path, dropped)
      pulled += dropped.length
    }

    // Re-partition. Partitions that end up empty are still written, so a
    // record that moved out does not linger in its old file.
    const desired = new Map<string, Rec[]>()
    for (const partition of remoteParts.keys()) desired.set(partition, [])
    for (const record of final) {
      const partition = collection.partition?.(record) ?? DEFAULT_PARTITION
      const list = desired.get(partition) ?? []
      list.push({ ...record, rev: 0 })
      desired.set(partition, list)
    }

    let pushed = 0
    for (const [partition, records] of [...desired].sort(([a], [b]) => a.localeCompare(b))) {
      records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      const current = remoteParts.get(partition)
      let etag: string

      if (current && !recovered.has(partition) && sameRecords(current.records, records)) {
        etag = current.etag
      } else if (!current && records.length === 0) {
        continue
      } else {
        etag = (await this.adapter.write(path, partition, records, current?.etag ?? null)).etag
        pushed++
      }
      recovered.delete(partition)
      await this.bases.save(path, partition, { base: records, etag })

      // Only now does this device's copy reflect it: rows taken from the
      // destination arrive, rows that were sent stop being pending.
      const changes: LocalChange[] = []
      for (const record of records) {
        const before = localById.get(record.id)
        if (before && canonical(before) === canonical(record)) continue
        if (!before || canonical({ ...before, rev: 0 }) !== canonical(record)) pulled++
        changes.push({ before, after: record })
      }
      await this.local.commit(path, changes)
    }

    return { pulled, pushed, conflicts: [] }
  }

  private async readRemote(path: string): Promise<Map<string, RemotePartition>> {
    const parts = new Map<string, RemotePartition>()
    for (const partition of await this.adapter.listPartitions(path)) {
      const read = await this.adapter.read(path, partition)
      if (read) parts.set(partition, read)
    }
    return parts
  }

  private async hasLocalData(collections: SyncCollection[]): Promise<boolean> {
    for (const c of collections) if ((await this.local.read(c.path)).length > 0) return true
    return false
  }

  private async hasRemoteData(collections: SyncCollection[]): Promise<boolean> {
    for (const c of collections) {
      for (const partition of await this.adapter.listPartitions(c.path)) {
        if (((await this.adapter.read(c.path, partition))?.records.length ?? 0) > 0) return true
      }
    }
    return false
  }
}

/**
 * One record per id. The same id in two files means a move raced with
 * something; the most recently updated copy wins, and the re-partitioning
 * that follows rewrites the stale file without it.
 */
function flatten(groups: Rec[][]): Rec[] {
  const byId = new Map<string, Rec>()
  for (const record of groups.flat()) {
    const seen = byId.get(record.id)
    if (!seen || record.updatedAt > seen.updatedAt) byId.set(record.id, record)
  }
  return [...byId.values()]
}

function sameRecords(a: Rec[], b: Rec[]): boolean {
  if (a.length !== b.length) return false
  const sorted = [...a].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  return canonical(sorted) === canonical(b)
}
