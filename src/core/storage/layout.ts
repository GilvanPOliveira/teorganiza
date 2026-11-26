import type { Envelope } from '@core/api/types'

/**
 * The layout every destination shares, so a TeOrganiza folder can move
 * from Google Drive to a local folder (or the other way) by copying it:
 *
 *   TeOrganiza/_lock.json
 *   TeOrganiza/<module>/<collection>/<partition>.json
 *
 * Each file is `{ "schemaVersion": n, "records": [...] }` — readable,
 * diffable and openable in a text editor without the app.
 */
export const ROOT_NAME = 'TeOrganiza'
export const LOCK_FILE = '_lock.json'
/** File contents, one per hash. The `_` keeps it apart from module folders. */
export const FILES_FOLDER = '_files'

export function isBlobName(name: string): boolean {
  return /^[0-9a-f]{64}$/.test(name)
}

export interface PartitionFile {
  schemaVersion: number
  records: Envelope<unknown>[]
}

export function partitionFile(records: Envelope<unknown>[]): PartitionFile {
  return {
    schemaVersion: records.reduce((max, r) => Math.max(max, r.schemaVersion), 0),
    records,
  }
}

/** Partition names become file names; `_` and `.` are kept for the app. */
export function fileName(partition: string): string {
  if (!/^[\w.-]+$/.test(partition) || partition.startsWith('_') || partition.startsWith('.')) {
    throw new Error(`Invalid partition name: ${partition}`)
  }
  return `${partition}.json`
}

export function parsePartition(body: unknown): Envelope<unknown>[] {
  const records = (body as Partial<PartitionFile> | null)?.records
  if (!Array.isArray(records)) throw new Error('Partition file has no records array')
  return records
}
