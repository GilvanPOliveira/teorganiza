import type { StorageKind } from '@core/api/types'
import type { Destination, TokenAuth } from '@core/storage/destinations'
import { AuthExpiredError } from '@core/storage/errors'
import type { DeviceLease, StorageAdapter } from '@core/storage/types'
import {
  SyncEngine,
  type BaseStore,
  type FirstSyncChoice,
  type LocalStore,
  type SyncCollection,
  type SyncOptions,
} from './engine'
import { syncBlobs } from '@core/files/sync'
import { LEASE_RENEW_MS } from './lock'
import type { ConflictChoice } from './merge'
import type { Conflict } from './types'

export type SyncPolicy = 'manual' | 'on-leave' | 'periodic' | 'always'

export type SyncPhase =
  /** No destination: the evaluation state. */
  | 'local-only'
  /** A destination is set, but access lapsed (token, folder permission). Needs a click. */
  | 'needs-auth'
  | 'idle'
  | 'syncing'
  | 'first-sync'
  | 'conflicts'
  /** Another device holds an active lease. Soft: the user decides. */
  | 'lock-held'
  | 'error'

export interface SyncState {
  kind: StorageKind | null
  phase: SyncPhase
  lastSyncAt: string | null
  /** Local edits not yet sent — the queue that is never lost. */
  pendingCount: number
  /** Live records on this device: what is at risk with no destination. */
  liveCount: number
  conflicts: Conflict[]
  lockHolder: { by: DeviceLease; since: string } | null
  error: string | null
  /** Result of navigator.storage.persist(); null when unknown. */
  persisted: boolean | null
  /** False when the build has no Google client id. */
  driveAvailable: boolean
  /** False where the browser cannot open a folder (Firefox, Safari, phones). */
  folderAvailable: boolean
  /** What to call the destination, e.g. the folder the user picked. */
  destinationLabel: string | null
}

/** The Google token side of the Drive destination. */
export type Auth = TokenAuth

export interface SyncBaseStore extends BaseStore {
  clear(): Promise<void>
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
}

export interface SyncDeps {
  /** The destinations this build and browser offer. */
  destinations: Partial<Record<StorageKind, Destination>>
  local: LocalStore
  bases: SyncBaseStore
  collections: () => SyncCollection[]
  counts: { pending(): Promise<number>; live(): Promise<number> }
  device: () => DeviceLease
  policy: () => Promise<SyncPolicy>
  persist?: () => Promise<boolean>
  now?: () => Date
  setInterval?: (fn: () => void, ms: number) => unknown
  clearInterval?: (handle: unknown) => void
}

const META_DESTINATION = 'destination'
const META_LAST_SYNC = 'lastSyncAt'

/**
 * Owns the sync lifecycle: destination, auth state, lease, policy, and the
 * questions only the user can answer (first sync, conflicts, lease held
 * elsewhere). Framework-free; the shell subscribes to it.
 *
 * Modules never see this. They may read sync state; they never drive it.
 */
export class SyncController {
  private state: SyncState
  private listeners = new Set<(state: SyncState) => void>()
  private adapter: StorageAdapter | null = null
  private engine: SyncEngine | null = null
  private timer: unknown = null
  private running: Promise<void> | null = null
  private readonly now: () => Date

  constructor(private readonly deps: SyncDeps) {
    this.now = deps.now ?? (() => new Date())
    this.state = {
      kind: null,
      phase: 'local-only',
      lastSyncAt: null,
      pendingCount: 0,
      liveCount: 0,
      conflicts: [],
      lockHolder: null,
      error: null,
      persisted: null,
      driveAvailable: deps.destinations.drive !== undefined,
      folderAvailable: deps.destinations['disk-web'] !== undefined,
      destinationLabel: null,
    }
  }

  getState(): SyncState {
    return this.state
  }

  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * At app start. Never prompts: when access lapsed (always, for a Google
   * token after a reload) it lands on needs-auth and waits for a click.
   */
  async start(): Promise<void> {
    const stored = (await this.deps.bases.getMeta<StorageKind>(META_DESTINATION)) ?? null
    const lastSyncAt = (await this.deps.bases.getMeta<string>(META_LAST_SYNC)) ?? null
    const persisted = this.deps.persist ? await this.deps.persist().catch(() => false) : null
    const destination = stored ? this.deps.destinations[stored] : undefined
    const kind = destination ? stored : null

    this.set({
      kind,
      lastSyncAt,
      persisted,
      phase: kind ? 'needs-auth' : 'local-only',
      destinationLabel: destination ? await destination.label() : null,
    })

    if (destination && (await destination.isReady())) {
      try {
        await this.attach(destination)
        this.set({ phase: 'idle' })
        this.startTimer()
      } catch (error) {
        if (!(error instanceof AuthExpiredError)) this.set({ phase: 'error', error: describe(error) })
      }
    }
    await this.refreshCounts()
  }

  /** "Conectar ao Google Drive" and its "Reconectar". Call from a click. */
  connectDrive(): Promise<void> {
    return this.connect('drive')
  }

  /** "Escolher pasta" and its "Permitir acesso". Call from a click. */
  connectFolder(): Promise<void> {
    return this.connect('disk-web')
  }

  /** Call from a click: it may open a popup, a picker or a permission prompt. */
  async connect(kind: StorageKind): Promise<void> {
    const destination = this.deps.destinations[kind]
    if (!destination) throw new Error(`Destination "${kind}" is not available here`)
    if (this.state.kind && this.state.kind !== kind) {
      throw new Error('Disconnect the current destination before choosing another')
    }
    try {
      await destination.connect()
      await this.attach(destination)
    } catch (error) {
      this.set({ phase: this.state.kind ? 'needs-auth' : 'local-only', error: describe(error) })
      return
    }
    await this.deps.bases.setMeta(META_DESTINATION, kind)
    this.set({ kind, error: null, destinationLabel: await destination.label() })

    if (await this.takeLease(false)) await this.sync()
    this.startTimer()
  }

  async sync(options: SyncOptions = {}): Promise<void> {
    if (this.running) return this.running
    this.running = this.run(options).finally(() => {
      this.running = null
    })
    return this.running
  }

  chooseFirstSync(choice: FirstSyncChoice): Promise<void> {
    return this.sync({ firstSync: choice })
  }

  resolveConflicts(choices: ReadonlyMap<string, ConflictChoice>): Promise<void> {
    return this.sync({ resolutions: choices })
  }

  /** "Assumir aqui". */
  async takeOver(): Promise<void> {
    if (await this.takeLease(true)) await this.sync()
  }

  /** Just consulting: carry on without the lease. The etag still protects. */
  async ignoreLease(): Promise<void> {
    this.set({ phase: 'idle', lockHolder: null })
    await this.sync()
  }

  /** The `visibilitychange` hook: leaving is when "on leave" sends. */
  async handleHidden(): Promise<void> {
    this.stopTimer()
    if (!this.engine) return
    const policy = await this.deps.policy()
    if (policy !== 'manual' && this.state.phase === 'idle') await this.sync()
    await this.adapter?.releaseLock?.().catch(() => undefined)
  }

  async handleVisible(): Promise<void> {
    await this.refreshCounts()
    if (!this.engine || !(await this.ready())) {
      if (this.state.kind) this.set({ phase: 'needs-auth' })
      return
    }
    this.startTimer()
    if (!(await this.takeLease(false))) return
    if ((await this.deps.policy()) !== 'manual') await this.sync()
  }

  /** "Desconectar o destino". The local copy always stays. */
  async disconnect(): Promise<void> {
    this.stopTimer()
    await this.adapter?.releaseLock?.().catch(() => undefined)
    await this.destination()?.forget()
    await this.deps.bases.clear()
    this.adapter = null
    this.engine = null
    this.set({
      kind: null,
      phase: 'local-only',
      lastSyncAt: null,
      conflicts: [],
      lockHolder: null,
      error: null,
      destinationLabel: null,
    })
  }

  /** "Sair": drops the token only. Reconnecting imports nothing again. */
  signOut(): void {
    this.stopTimer()
    this.destination()?.signOut()
    if (this.state.kind) this.set({ phase: 'needs-auth' })
  }

  /** "Revogar no Google". The files on Drive are not deleted. */
  async revoke(): Promise<void> {
    this.stopTimer()
    await this.adapter?.releaseLock?.().catch(() => undefined)
    await this.destination()?.revoke?.()
    if (this.state.kind) this.set({ phase: 'needs-auth' })
  }

  async refreshCounts(): Promise<void> {
    const [pendingCount, liveCount] = await Promise.all([
      this.deps.counts.pending(),
      this.deps.counts.live(),
    ])
    this.set({ pendingCount, liveCount })
  }

  dispose(): void {
    this.stopTimer()
    this.listeners.clear()
  }

  // ── internals ──────────────────────────────────────────────────────

  private async run(options: SyncOptions): Promise<void> {
    if (!this.engine) return
    if (!(await this.ready())) {
      this.set({ phase: 'needs-auth' })
      await this.refreshCounts() // the queue that waits for the reconnect
      return
    }
    this.set({ phase: 'syncing', error: null })
    try {
      const outcome = await this.engine.syncAll(options)
      if (outcome.status === 'first-sync') {
        this.set({ phase: 'first-sync' })
      } else {
        await this.syncFileContents()
        const lastSyncAt = this.now().toISOString()
        await this.deps.bases.setMeta(META_LAST_SYNC, lastSyncAt)
        this.set({
          phase: outcome.conflicts.length > 0 ? 'conflicts' : 'idle',
          conflicts: outcome.conflicts,
          lastSyncAt,
        })
      }
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        // Abort, keep the queue, ask for the gesture.
        this.destination()?.signOut()
        this.set({ phase: 'needs-auth' })
      } else {
        this.set({ phase: 'error', error: describe(error) })
      }
    } finally {
      await this.refreshCounts()
    }
  }

  /**
   * After the records: the bytes of the files those records describe. Only
   * live records count, so a file in the trash is not fetched again.
   */
  private async syncFileContents(): Promise<void> {
    const adapter = this.adapter
    if (!adapter?.listBlobs) return
    const rows = await this.deps.local.read('core/files')
    const wanted = new Set(
      rows.filter((row) => row.deletedAt === null).map((row) => (row.data as { hash: string }).hash),
    )
    await syncBlobs(adapter, wanted)
  }

  /** True when sync may go ahead. */
  private async takeLease(takeOver: boolean): Promise<boolean> {
    const adapter = this.adapter
    if (!adapter?.capabilities.lock || !adapter.acquireLock) return true
    try {
      const result = await adapter.acquireLock(this.deps.device(), { takeOver })
      if (result.held) {
        if (this.state.phase === 'lock-held') this.set({ phase: 'idle', lockHolder: null })
        return true
      }
      this.set({ phase: 'lock-held', lockHolder: { by: result.by, since: result.since } })
      return false
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        this.destination()?.signOut()
        this.set({ phase: 'needs-auth' })
        return false
      }
      // The lease only lowers how often conflicts happen; failing to take
      // it must not stop sync, which is protected by the etag regardless.
      return true
    }
  }

  private destination(): Destination | undefined {
    return this.state.kind ? this.deps.destinations[this.state.kind] : undefined
  }

  private async ready(): Promise<boolean> {
    return (await this.destination()?.isReady()) ?? false
  }

  private async attach(destination: Destination): Promise<void> {
    const adapter = await destination.createAdapter()
    await adapter.init()
    this.adapter = adapter
    this.engine = new SyncEngine(adapter, this.deps.local, this.deps.bases, this.deps.collections)
  }

  private startTimer(): void {
    this.stopTimer()
    const every = this.deps.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms))
    this.timer = every(() => void this.tick(), LEASE_RENEW_MS)
  }

  private stopTimer(): void {
    if (this.timer === null) return
    const clear = this.deps.clearInterval ?? ((h) => globalThis.clearInterval(h as number))
    clear(this.timer)
    this.timer = null
  }

  private async tick(): Promise<void> {
    if (!this.engine || this.state.phase !== 'idle') return
    if (!(await this.ready())) return
    if (!(await this.takeLease(false))) return
    const policy = await this.deps.policy()
    if (policy === 'periodic' || policy === 'always') await this.sync()
  }

  private set(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
