import Dexie, { type Table } from 'dexie'

/**
 * The bytes of the user's files, by content hash. A database of its own,
 * apart from the records: its shape never changes with the modules, and
 * keeping large values out of the record tables keeps those fast.
 */
interface BlobRow {
  hash: string
  blob: Blob
}

let db: (Dexie & { blobs: Table<BlobRow, string> }) | null = null

function blobs(): Table<BlobRow, string> {
  if (!db) {
    const instance = new Dexie('teorganiza-files') as Dexie & { blobs: Table<BlobRow, string> }
    instance.version(1).stores({ blobs: 'hash' })
    db = instance
  }
  return db.blobs
}

export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Stores the content and returns its hash. Storing the same bytes twice is a no-op. */
export async function putBlob(blob: Blob, knownHash?: string): Promise<string> {
  const hash = knownHash ?? (await hashBlob(blob))
  if (!(await blobs().get(hash))) await blobs().put({ hash, blob })
  return hash
}

export async function getBlob(hash: string): Promise<Blob | undefined> {
  return (await blobs().get(hash))?.blob
}

export async function localHashes(): Promise<Set<string>> {
  return new Set(await blobs().toCollection().primaryKeys())
}

/** Frees the bytes no live record points to any more. */
export async function pruneBlobs(keep: ReadonlySet<string>): Promise<number> {
  const orphans = [...(await localHashes())].filter((hash) => !keep.has(hash))
  await blobs().bulkDelete(orphans)
  return orphans.length
}
