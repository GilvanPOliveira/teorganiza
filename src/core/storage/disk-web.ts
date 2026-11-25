import type { Envelope } from '@core/api/types'
import { evaluateLease, nextLease, parseLease, releasedLease, type Lease } from '@core/sync/lock'
import { AuthExpiredError, EtagMismatchError } from './errors'
import { fileName, LOCK_FILE, parsePartition, partitionFile } from './layout'
import type { DeviceLease, LockResult, StorageAdapter } from './types'

/**
 * The slice of the File System Access API this adapter uses. Typed here,
 * not taken from lib.dom, so tests can hand it an in-memory folder.
 */
export interface DirectoryLike {
  readonly name: string
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryLike>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileLike>
  values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string }>
}

export interface FileLike {
  getFile(): Promise<{ text(): Promise<string> }>
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
}

export interface DiskWebOptions {
  /** The `TeOrganiza` folder itself, already resolved by the destination. */
  root: DirectoryLike
  now?: () => Date
}

/**
 * A folder on this computer, chosen by the user (Chrome and Edge on the
 * desktop). Same layout and file format as Drive, so the folder can sit
 * inside Dropbox or OneDrive, or be copied to another computer.
 *
 * The etag is the SHA-256 of the file's text: a folder has no revision ids,
 * and the content is exactly what decides whether it changed. A folder
 * keeps no history either, so there is no `readVersion` — two browsers
 * writing the same instant are kept apart by the etag check and the lease.
 */
export class DiskWebAdapter implements StorageAdapter {
  readonly kind = 'disk-web' as const
  readonly capabilities = { lock: true, versioning: false }

  private readonly root: DirectoryLike
  private readonly now: () => Date
  private heldLease: DeviceLease | null = null

  constructor(options: DiskWebOptions) {
    this.root = options.root
    this.now = options.now ?? (() => new Date())
  }

  async init(): Promise<void> {
    // Touching the root is enough to find out the permission is gone.
    await guard(() => collect(this.root.values()))
  }

  async listPartitions(collectionPath: string): Promise<string[]> {
    const folder = await this.folder(collectionPath, false)
    if (!folder) return []
    const entries = await guard(() => collect(folder.values()))
    return entries
      .filter((entry) => entry.kind === 'file' && entry.name.endsWith('.json') && !entry.name.startsWith('_'))
      .map((entry) => entry.name.slice(0, -'.json'.length))
      .sort()
  }

  async read(
    collectionPath: string,
    partition: string,
  ): Promise<{ records: Envelope<unknown>[]; etag: string } | null> {
    const folder = await this.folder(collectionPath, false)
    if (!folder) return null
    const text = await this.readText(folder, fileName(partition))
    if (text === null) return null
    return { records: parsePartition(JSON.parse(text)), etag: await hash(text) }
  }

  async write(
    collectionPath: string,
    partition: string,
    records: Envelope<unknown>[],
    expectedEtag: string | null,
  ): Promise<{ etag: string }> {
    const folder = await this.folder(collectionPath, true)
    return this.putJson(folder!, fileName(partition), partitionFile(records), expectedEtag, `${collectionPath}/${partition}`)
  }

  async acquireLock(device: DeviceLease, options: { takeOver?: boolean } = {}): Promise<LockResult> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { lease, etag } = await this.readLock()
      const now = this.now()
      const state = evaluateLease(lease, device.deviceId, now)
      if (typeof state === 'object' && !options.takeOver) return state
      try {
        await this.putJson(this.root, LOCK_FILE, nextLease(lease, device, now), etag, LOCK_FILE)
        this.heldLease = device
        return { held: true }
      } catch (error) {
        // Another tab wrote the lease between our read and our write.
        if (!(error instanceof EtagMismatchError)) throw error
      }
    }
    const { lease } = await this.readLock()
    const state = evaluateLease(lease, device.deviceId, this.now())
    if (typeof state === 'object') return state
    throw new Error('Could not settle the device lease')
  }

  /** Releases only a lease that is still ours; a takeover is respected. */
  async releaseLock(): Promise<void> {
    const device = this.heldLease
    if (!device) return
    this.heldLease = null
    const { lease, etag } = await this.readLock()
    if (!lease || lease.deviceId !== device.deviceId) return
    try {
      await this.putJson(this.root, LOCK_FILE, releasedLease(lease, this.now()), etag, LOCK_FILE)
    } catch (error) {
      if (!(error instanceof EtagMismatchError)) throw error
    }
  }

  // ── files ────────────────────────────────────────────────────────────

  private async readLock(): Promise<{ lease: Lease | null; etag: string | null }> {
    const text = await this.readText(this.root, LOCK_FILE)
    if (text === null) return { lease: null, etag: null }
    let lease: Lease | null = null
    try {
      lease = parseLease(JSON.parse(text))
    } catch {
      // A damaged lock file is treated as no lease; the next write fixes it.
    }
    return { lease, etag: await hash(text) }
  }

  /**
   * Checks the etag, then writes. The writable stream goes to a temporary
   * file that replaces the real one on `close()`, so a crash never leaves
   * half a file behind.
   */
  private async putJson(
    folder: DirectoryLike,
    name: string,
    content: unknown,
    expectedEtag: string | null,
    path: string,
  ): Promise<{ etag: string }> {
    const current = await this.readText(folder, name)
    const actual = current === null ? null : await hash(current)
    if (actual !== expectedEtag) throw new EtagMismatchError(path, expectedEtag, actual)

    const json = JSON.stringify(content, null, 2)
    await guard(async () => {
      const file = await folder.getFileHandle(name, { create: true })
      const writable = await file.createWritable()
      await writable.write(json)
      await writable.close()
    })
    return { etag: await hash(json) }
  }

  private async readText(folder: DirectoryLike, name: string): Promise<string | null> {
    return guard(async () => {
      try {
        const file = await folder.getFileHandle(name)
        return await (await file.getFile()).text()
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    })
  }

  private async folder(collectionPath: string, create: boolean): Promise<DirectoryLike | null> {
    let current = this.root
    for (const part of collectionPath.split('/')) {
      try {
        current = await guard(() => current.getDirectoryHandle(part, { create }))
      } catch (error) {
        if (!create && isNotFound(error)) return null
        throw error
      }
    }
    return current
  }
}

/** Content hash as the etag: the same bytes always give the same etag. */
export async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) items.push(item)
  return items
}

/**
 * The browser drops folder permission when the tab reloads (unless the
 * user chose "allow on every visit"). That surfaces as NotAllowedError, and
 * it means the same as an expired Google token: stop, keep the queue, ask
 * for a click.
 */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      throw new AuthExpiredError()
    }
    throw error
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
}
