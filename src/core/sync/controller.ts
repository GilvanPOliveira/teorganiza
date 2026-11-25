import type { StorageKind } from '@core/api/types'
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
import { LEASE_RENEW_MS } from './lock'
import type { ConflictChoice } from './merge'
import type { Conflict } from './types'

export type SyncPolicy = 'manual' | 'on-leave' | 'periodic' | 'always'

export type SyncPhase =
  /** No destination: the evaluation state. */
  | 'local-only'
  /** A destination is set, but there is no valid token. Needs a click. */
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
}

export interface Auth {
  readonly connected: boolean
  connect(): Promise<void>
  getAccessToken(): Promise<string>
  signOut(): void
  revoke(): Promise<void>
}

export interface SyncBaseStore extends BaseStore {
  clear(): Promise<void>
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
}

export interface SyncDeps {
  auth: Auth | null
  createAdapter: (auth: Auth) => StorageAdapter
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
      driveAvailable: deps.auth !== null,
    }
  }

  getState(): SyncState {
    return this.state
  }

  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** At app start. Never opens a popup: a reload always lands on needs-auth. */
  async start(): Promise<void> {
    const kind = (await this.deps.bases.getMeta<StorageKind>(META_DESTINATION)) ?? null
    const lastSyncAt = (await this.deps.bases.getMeta<string>(META_LAST_SYNC)) ?? null
    const persisted = this.deps.persist ? await this.deps.persist().catch(() => false) : null
    const usable = kind === 'drive' && this.deps.auth !== null
    this.set({
      kind: usable ? kind : null,
      lastSyncAt,
      persisted,
      phase: usable ? (this.deps.auth!.connected ? 'idle' : 'needs-auth') : 'local-only',
    })
    await this.refreshCounts()
  }

  /** "Conectar ao Google Drive" and "Reconectar". Call from a click. */
  async connectDrive(): Promise<void> {
    const auth = this.deps.auth
    if (!auth) throw new Error('Google Drive is not configured in this build')
    try {
      await auth.connect()
    } catch (error) {
      this.set({ phase: this.state.kind ? 'needs-auth' : 'local-only', error: describe(error) })
      return
    }
    this.adapter = this.deps.createAdapter(auth)
    this.engine = new SyncEngine(this.adapter, this.deps.local, this.deps.bases, this.deps.collections)
    await this.adapter.init()
    await this.deps.bases.setMeta(META_DESTINATION, 'drive')
    this.set({ kind: 'drive', error: null })

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
    if (!this.engine || !this.deps.auth?.connected) {
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
    this.deps.auth?.signOut()
    await this.deps.bases.clear()
    this.adapter = null
    this.engine = null
    this.set({ kind: null, phase: 'local-only', lastSyncAt: null, conflicts: [], lockHolder: null, error: null })
  }

  /** "Sair": drops the token only. Reconnecting imports nothing again. */
  signOut(): void {
    this.stopTimer()
    this.deps.auth?.signOut()
    if (this.state.kind) this.set({ phase: 'needs-auth' })
  }

  /** "Revogar no Google". The files on Drive are not deleted. */
  async revoke(): Promise<void> {
    this.stopTimer()
    await this.adapter?.releaseLock?.().catch(() => undefined)
    await this.deps.auth?.revoke()
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
    if (!this.deps.auth?.connected) {
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
        this.deps.auth?.signOut()
        this.set({ phase: 'needs-auth' })
      } else {
        this.set({ phase: 'error', error: describe(error) })
      }
    } finally {
      await this.refreshCounts()
    }
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
        this.deps.auth?.signOut()
        this.set({ phase: 'needs-auth' })
        return false
      }
      // The lease only lowers how often conflicts happen; failing to take
      // it must not stop sync, which is protected by the etag regardless.
      return true
    }
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
    if (!this.engine || !this.deps.auth?.connected) return
    if (this.state.phase !== 'idle') return
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
