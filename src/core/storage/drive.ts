import type { Envelope } from '@core/api/types'
import {
  evaluateLease,
  nextLease,
  parseLease,
  releasedLease,
  type Lease,
} from '@core/sync/lock'
import {
  AuthExpiredError,
  ConcurrentWriteError,
  EtagMismatchError,
  StorageRequestError,
} from './errors'
import { fileName, LOCK_FILE, parsePartition, partitionFile, ROOT_NAME } from './layout'
import type { DeviceLease, LockResult, StorageAdapter } from './types'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER = 'application/vnd.google-apps.folder'

export interface DriveAdapterOptions {
  /**
   * Returns a valid access token, renewing silently if needed. The token
   * lives only in memory, owned by the caller; the adapter never stores it.
   * Should throw `AuthExpiredError` when silent renewal fails.
   */
  getAccessToken: () => Promise<string>
  fetch?: typeof fetch
  now?: () => Date
  /** Injected so tests do not wait out real backoff. */
  sleep?: (ms: number) => Promise<void>
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  headRevisionId?: string
}

/**
 * Drive REST v3 under the `drive.file` scope: the app sees only what it
 * created. Layout on the destination:
 *
 *   TeOrganiza/_lock.json
 *   TeOrganiza/<module>/<collection>/<partition>.json
 *
 * The etag is the file's `headRevisionId`. Content is always read by that
 * revision id, so the records returned and the etag returned can never
 * belong to two different versions.
 */
export class DriveAdapter implements StorageAdapter {
  readonly kind = 'drive' as const
  readonly capabilities = { lock: true, versioning: true }

  private readonly fetchFn: typeof fetch
  private readonly now: () => Date
  private readonly sleep: (ms: number) => Promise<void>
  private rootId: string | null = null
  private readonly folderIds = new Map<string, string>()
  private heldLease: DeviceLease | null = null

  constructor(private readonly options: DriveAdapterOptions) {
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.now = options.now ?? (() => new Date())
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  async init(): Promise<void> {
    await this.root(true)
  }

  async listPartitions(collectionPath: string): Promise<string[]> {
    const folder = await this.folder(collectionPath, false)
    if (!folder) return []
    const files = await this.listChildren(folder)
    return files
      .filter((f) => f.mimeType !== FOLDER && f.name.endsWith('.json'))
      .map((f) => f.name.slice(0, -'.json'.length))
      .sort()
  }

  async read(
    collectionPath: string,
    partition: string,
  ): Promise<{ records: Envelope<unknown>[]; etag: string } | null> {
    const folder = await this.folder(collectionPath, false)
    if (!folder) return null
    const file = await this.findChild(folder, fileName(partition))
    if (!file?.headRevisionId) return null
    const body = await this.readRevision(file.id, file.headRevisionId)
    return { records: parsePartition(body), etag: file.headRevisionId }
  }

  async readVersion(
    collectionPath: string,
    partition: string,
    etag: string,
  ): Promise<Envelope<unknown>[] | null> {
    const folder = await this.folder(collectionPath, false)
    if (!folder) return null
    const file = await this.findChild(folder, fileName(partition))
    if (!file) return null
    return parsePartition(await this.readRevision(file.id, etag))
  }

  async write(
    collectionPath: string,
    partition: string,
    records: Envelope<unknown>[],
    expectedEtag: string | null,
  ): Promise<{ etag: string }> {
    const folder = await this.folder(collectionPath, true)
    const body = partitionFile(records)
    return this.putJson(folder!, fileName(partition), body, expectedEtag, `${collectionPath}/${partition}`)
  }

  /**
   * Takes the lease when it is free, expired, or already ours (renewal —
   * call again every `LEASE_RENEW_MS` of active use). With another
   * device's active lease, reports it instead; `takeOver` is the user's
   * answer to "Aberto em PC casa há 12 minutos. Assumir aqui?".
   */
  async acquireLock(device: DeviceLease, options: { takeOver?: boolean } = {}): Promise<LockResult> {
    const root = await this.root(true)
    for (let attempt = 0; attempt < 3; attempt++) {
      const { lease, etag } = await this.readLock(root!)
      const now = this.now()
      const state = evaluateLease(lease, device.deviceId, now)
      if (typeof state === 'object' && !options.takeOver) return state

      try {
        await this.putJson(root!, LOCK_FILE, nextLease(lease, device, now), etag, LOCK_FILE)
        this.heldLease = device
        return { held: true }
      } catch (error) {
        if (error instanceof ConcurrentWriteError && !options.takeOver) {
          // Our upload landed on top of a device that took the lease a
          // moment earlier. It believes it holds the lock, so it does:
          // put its lease back and report it.
          const yielded = await this.yieldLease(root!, error, device)
          if (yielded) return yielded
          continue
        }
        // Two devices racing for the lease: re-read and decide again.
        if (!(error instanceof EtagMismatchError || error instanceof ConcurrentWriteError)) throw error
      }
    }
    const { lease } = await this.readLock(root!)
    const state = evaluateLease(lease, device.deviceId, this.now())
    if (typeof state === 'object') return state
    throw new Error('Could not settle the device lease')
  }

  /** Releases only a lease that is still ours; a takeover is respected. */
  async releaseLock(): Promise<void> {
    const device = this.heldLease
    if (!device) return
    this.heldLease = null
    const root = await this.root(false)
    if (!root) return
    const { lease, etag } = await this.readLock(root)
    if (!lease || lease.deviceId !== device.deviceId) return
    try {
      await this.putJson(root, LOCK_FILE, releasedLease(lease, this.now()), etag, LOCK_FILE)
    } catch (error) {
      // Someone wrote the lock meanwhile, so it is no longer ours to release.
      if (!(error instanceof EtagMismatchError || error instanceof ConcurrentWriteError)) throw error
    }
  }

  private async yieldLease(
    root: string,
    race: ConcurrentWriteError,
    device: DeviceLease,
  ): Promise<LockResult | null> {
    const file = await this.findChild(root, LOCK_FILE)
    if (!file) return null
    const theirs = parseLease(await this.readRevision(file.id, race.overwritten))
    const state = evaluateLease(theirs, device.deviceId, this.now())
    if (typeof state !== 'object') return null
    try {
      await this.putJson(root, LOCK_FILE, theirs, race.etag, LOCK_FILE)
    } catch (error) {
      // Someone moved on already; the next attempt re-reads.
      if (error instanceof EtagMismatchError || error instanceof ConcurrentWriteError) return null
      throw error
    }
    return state
  }

  // ── files ────────────────────────────────────────────────────────────

  private async putJson(
    folderId: string,
    name: string,
    content: unknown,
    expectedEtag: string | null,
    path: string,
  ): Promise<{ etag: string }> {
    const existing = await this.findChild(folderId, name)
    const actual = existing?.headRevisionId ?? null
    if (actual !== expectedEtag) throw new EtagMismatchError(path, expectedEtag, actual)

    const json = JSON.stringify(content, null, 2)
    if (!existing) return this.create(folderId, name, json, path)

    const updated = await this.request<DriveFile>(
      `${UPLOAD}/files/${existing.id}?uploadType=media&fields=id,headRevisionId`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json },
    )
    const etag = updated.headRevisionId!
    const previous = await this.revisionBefore(existing.id, etag)
    if (previous !== null && previous !== expectedEtag) {
      throw new ConcurrentWriteError(path, etag, previous)
    }
    return { etag }
  }

  /**
   * Two devices creating the same file at once leave two files with the
   * same name. The oldest is the real one; if ours is not it, ours is
   * removed and the write reported as lost to the other device.
   */
  private async create(folderId: string, name: string, json: string, path: string) {
    const boundary = `teorganiza-${crypto.randomUUID()}`
    const metadata = JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' })
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
    const created = await this.request<DriveFile>(
      `${UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,headRevisionId`,
      { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
    )
    const winner = await this.findChild(folderId, name)
    if (winner && winner.id !== created.id) {
      await this.request(`${API}/files/${created.id}`, { method: 'DELETE' }, false)
      throw new EtagMismatchError(path, null, winner.headRevisionId ?? null)
    }
    return { etag: created.headRevisionId! }
  }

  private async revisionBefore(fileId: string, revisionId: string): Promise<string | null> {
    const ids: string[] = []
    let pageToken: string | undefined
    do {
      const page = await this.request<{ revisions?: { id: string }[]; nextPageToken?: string }>(
        `${API}/files/${fileId}/revisions?pageSize=1000&fields=nextPageToken,revisions(id)` +
          (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''),
      )
      ids.push(...(page.revisions ?? []).map((r) => r.id))
      pageToken = page.nextPageToken
    } while (pageToken)
    const index = ids.indexOf(revisionId)
    // Pruned history: nothing to compare against, so nothing to claim.
    return index > 0 ? ids[index - 1] : null
  }

  private async readRevision(fileId: string, revisionId: string): Promise<unknown> {
    return this.request(`${API}/files/${fileId}/revisions/${revisionId}?alt=media`)
  }

  private async readLock(root: string): Promise<{ lease: Lease | null; etag: string | null }> {
    const file = await this.findChild(root, LOCK_FILE)
    if (!file?.headRevisionId) return { lease: null, etag: null }
    const body = await this.readRevision(file.id, file.headRevisionId)
    return { lease: parseLease(body), etag: file.headRevisionId }
  }

  // ── folders ──────────────────────────────────────────────────────────

  private async root(create: boolean): Promise<string | null> {
    if (this.rootId) return this.rootId
    const found = await this.findChild('root', ROOT_NAME, true)
    if (found) return (this.rootId = found.id)
    if (!create) return null
    return (this.rootId = await this.createFolder('root', ROOT_NAME))
  }

  private async folder(collectionPath: string, create: boolean): Promise<string | null> {
    const cached = this.folderIds.get(collectionPath)
    if (cached) return cached

    const segments = collectionPath.split('/')
    if (segments.some((s) => !s || s.startsWith('_') || s === '.' || s === '..')) {
      throw new Error(`Invalid collection path: ${collectionPath}`)
    }
    let parent = await this.root(create)
    if (!parent) return null
    for (const segment of segments) {
      const found = await this.findChild(parent, segment, true)
      if (found) parent = found.id
      else if (create) parent = await this.createFolder(parent, segment)
      else return null
    }
    this.folderIds.set(collectionPath, parent)
    return parent
  }

  private async createFolder(parent: string, name: string): Promise<string> {
    await this.request<DriveFile>(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
    })
    // Two devices may have created it at once; everyone converges on the oldest.
    const oldest = await this.findChild(parent, name, true)
    return oldest!.id
  }

  /** The oldest non-trashed child with that name, if any. */
  private async findChild(parent: string, name: string, folder = false): Promise<DriveFile | null> {
    const q =
      `name = '${escapeQuery(name)}' and '${escapeQuery(parent)}' in parents and trashed = false and ` +
      `mimeType ${folder ? '=' : '!='} '${FOLDER}'`
    const result = await this.request<{ files: DriveFile[] }>(
      `${API}/files?spaces=drive&orderBy=createdTime&pageSize=10` +
        `&fields=files(id,name,mimeType,headRevisionId)&q=${encodeURIComponent(q)}`,
    )
    return result.files[0] ?? null
  }

  private async listChildren(parent: string): Promise<DriveFile[]> {
    const q = `'${escapeQuery(parent)}' in parents and trashed = false`
    const files: DriveFile[] = []
    let pageToken: string | undefined
    do {
      const page = await this.request<{ files: DriveFile[]; nextPageToken?: string }>(
        `${API}/files?spaces=drive&pageSize=1000&fields=nextPageToken,files(id,name,mimeType)` +
          `&q=${encodeURIComponent(q)}` +
          (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''),
      )
      files.push(...page.files)
      pageToken = page.nextPageToken
    } while (pageToken)
    return files
  }

  // ── transport ────────────────────────────────────────────────────────

  /**
   * Retries what is safe to retry. A rate limit means the request was not
   * processed, so any method retries. A 5xx retries only for reads: a
   * write may have landed before the error, and repeating it blindly is
   * how data gets overwritten — that one surfaces, and the next sync,
   * which starts from a fresh read, settles it.
   */
  private async request<T>(url: string, init: RequestInit = {}, parse = true): Promise<T> {
    const method = init.method ?? 'GET'
    for (let attempt = 0; ; attempt++) {
      const token = await this.options.getAccessToken()
      const response = await this.fetchFn(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) throw new AuthExpiredError()
      if (response.ok) return (parse ? await response.json() : undefined) as T

      const body = await response.text()
      const rateLimited =
        response.status === 429 || (response.status === 403 && /rateLimitExceeded/i.test(body))
      const retriable = rateLimited || (response.status >= 500 && method === 'GET')
      if (!retriable || attempt >= MAX_RETRIES) throw new StorageRequestError(response.status, body)
      await this.sleep(retryDelay(attempt, response.headers.get('Retry-After')))
    }
  }
}

const MAX_RETRIES = 4

/** Exponential backoff with jitter, or what the server asked for. */
function retryDelay(attempt: number, retryAfter: string | null): number {
  const asked = retryAfter ? Number(retryAfter) * 1000 : NaN
  if (Number.isFinite(asked) && asked >= 0) return Math.min(asked, 60_000)
  return 2 ** attempt * 500 + Math.random() * 250
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
