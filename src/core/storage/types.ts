import type { Envelope, StorageKind } from '@core/api/types'

/**
 * A destination adapter knows only how to read and write partitions, and
 * whether the content changed since it was last read. It knows nothing
 * about merge, modules or schemas.
 *
 * Not implemented yet — this is the contract the next construction step
 * fills in, first with `drive`, then with `disk-web` and `disk-tauri`.
 */
export interface StorageAdapter {
  kind: StorageKind
  capabilities: {
    /** Supports the device lease in `_lock.json`. */
    lock: boolean
    /** The destination keeps its own file history. */
    versioning: boolean
  }

  init(): Promise<void>

  listPartitions(collectionPath: string): Promise<string[]>

  read(
    collectionPath: string,
    partition: string,
  ): Promise<{ records: Envelope<unknown>[]; etag: string } | null>

  /**
   * Rejects when the current etag differs from `expectedEtag`. That
   * rejection is not an error: it is the signal that someone wrote first,
   * and it is what makes silent overwrite impossible.
   */
  write(
    collectionPath: string,
    partition: string,
    records: Envelope<unknown>[],
    expectedEtag: string | null,
  ): Promise<{ etag: string }>

  /**
   * Reads a past version of a partition by its etag. Only for destinations
   * with `versioning`: it is how a write that landed on top of another
   * (see `ConcurrentWriteError`) gets the overwritten version back to merge.
   */
  readVersion?(
    collectionPath: string,
    partition: string,
    etag: string,
  ): Promise<Envelope<unknown>[] | null>

  /**
   * `takeOver` is the user's answer to "open on another device — take
   * over here?". The lock is soft: it never forbids, it only warns.
   */
  acquireLock?(device: DeviceLease, options?: { takeOver?: boolean }): Promise<LockResult>
  releaseLock?(): Promise<void>
}

export interface DeviceLease {
  deviceId: string
  nickname: string
}

export type LockResult =
  | { held: true }
  | { held: false; by: DeviceLease; since: string }
