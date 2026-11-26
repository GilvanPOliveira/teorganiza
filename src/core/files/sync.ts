import type { StorageAdapter } from '@core/storage/types'
import { getBlob, localHashes, putBlob } from './blobs'

export interface BlobSyncResult {
  sent: number
  received: number
  /** Files whose record arrived but whose bytes are nowhere yet. */
  missing: number
}

/**
 * Brings file contents in line with the file records. Content is addressed
 * by its hash, so there is nothing to merge: a hash either exists at a
 * place or it does not. Runs after the records sync, which is what decides
 * which hashes are wanted at all.
 */
export async function syncBlobs(adapter: StorageAdapter, wanted: ReadonlySet<string>): Promise<BlobSyncResult> {
  const result: BlobSyncResult = { sent: 0, received: 0, missing: 0 }
  if (!adapter.listBlobs || !adapter.readBlob || !adapter.writeBlob) return result

  const remote = new Set(await adapter.listBlobs())
  const local = await localHashes()

  for (const hash of wanted) {
    if (local.has(hash) && !remote.has(hash)) {
      const blob = await getBlob(hash)
      if (blob) {
        await adapter.writeBlob(hash, blob)
        result.sent++
      }
    } else if (!local.has(hash) && remote.has(hash)) {
      const blob = await adapter.readBlob(hash)
      if (blob) {
        await putBlob(blob, hash)
        result.received++
      } else {
        result.missing++
      }
    } else if (!local.has(hash)) {
      result.missing++
    }
  }
  return result
}
