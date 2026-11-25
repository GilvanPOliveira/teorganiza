import { describe, expect, it } from 'vitest'
import type { Envelope } from '@core/api/types'
import { ConcurrentWriteError, EtagMismatchError } from '@core/storage/errors'
import type { StorageAdapter } from '@core/storage/types'
import {
  SyncEngine,
  type BaseStore,
  type LocalChange,
  type LocalStore,
  type SyncCollection,
} from '@core/sync/engine'
import { canonical } from '@core/sync/merge'
import type { PartitionState } from '@core/sync/types'

type Rec = Envelope<unknown>
interface Tx {
  title: string
  date: string
}

const PATH = 'finance/transactions'
const collection: SyncCollection = {
  path: PATH,
  describe: (r) => (r.data as Tx).title,
  partition: (r) => (r.data as Tx).date.slice(0, 7),
}

// ── an in-memory destination with etags and history ──────────────────

class MemoryDestination implements StorageAdapter {
  kind = 'drive' as const
  capabilities = { lock: false, versioning: true }
  files = new Map<string, { etag: string; records: Rec[] }[]>()
  writes = 0
  /** Runs inside `write`, after the etag check, before the write lands. */
  duringWrite: ((path: string, partition: string) => void) | null = null
  /** Runs before the etag check — a write that beats ours cleanly. */
  beforeWrite: ((path: string, partition: string) => void) | null = null
  private seq = 0

  async init() {}
  async listPartitions(path: string) {
    return [...this.files.keys()].filter((k) => k.startsWith(`${path}#`)).map((k) => k.split('#')[1])
  }
  async read(path: string, partition: string) {
    const head = this.files.get(`${path}#${partition}`)?.at(-1)
    return head ? { records: structuredClone(head.records), etag: head.etag } : null
  }
  async readVersion(path: string, partition: string, etag: string) {
    return structuredClone(this.files.get(`${path}#${partition}`)?.find((v) => v.etag === etag)?.records ?? null)
  }
  async write(path: string, partition: string, records: Rec[], expected: string | null) {
    this.beforeWrite?.(path, partition)
    const key = `${path}#${partition}`
    const actual = this.files.get(key)?.at(-1)?.etag ?? null
    if (actual !== expected) throw new EtagMismatchError(key, expected, actual)
    this.duringWrite?.(path, partition)
    const etag = this.put(path, partition, records)
    this.writes++
    const versions = this.files.get(key)!
    const previous = versions.at(-2)?.etag ?? null
    if (previous !== expected) throw new ConcurrentWriteError(`${path}/${partition}`, etag, previous!)
    return { etag }
  }
  /** Another device writing directly. */
  put(path: string, partition: string, records: Rec[]): string {
    const key = `${path}#${partition}`
    const etag = `e${++this.seq}`
    this.files.set(key, [...(this.files.get(key) ?? []), { etag, records: structuredClone(records) }])
    return etag
  }
  content(partition: string): Rec[] | undefined {
    return this.files.get(`${PATH}#${partition}`)?.at(-1)?.records
  }
}

// ── one simulated device ─────────────────────────────────────────────

class Device implements LocalStore, BaseStore {
  rows = new Map<string, Rec>()
  bases = new Map<string, PartitionState>()
  connected = false
  engine: SyncEngine
  private clock = 0

  constructor(readonly id: string, destination: MemoryDestination) {
    this.engine = new SyncEngine(destination, this, this, () => [collection])
  }

  // LocalStore
  async read() {
    return structuredClone([...this.rows.values()])
  }
  async commit(_path: string, changes: LocalChange[]) {
    for (const { before, after } of changes) {
      const id = (after ?? before)!.id
      const current = this.rows.get(id)
      const untouched = before === undefined ? !current : !!current && canonical(current) === canonical(before)
      if (!untouched) continue
      if (after) this.rows.set(id, structuredClone(after))
      else this.rows.delete(id)
    }
  }
  // BaseStore
  async load() {
    return new Map(this.bases)
  }
  async save(_path: string, partition: string, state: PartitionState) {
    this.bases.set(partition, structuredClone(state))
  }
  async isConnected() {
    return this.connected
  }
  async markConnected() {
    this.connected = true
  }

  // what a module does through the repository
  create(id: string, data: Tx) {
    const now = this.tick()
    this.rows.set(id, { id, createdAt: now, updatedAt: now, deletedAt: null, deviceId: this.id, rev: 1, schemaVersion: 1, data })
  }
  edit(id: string, patch: Partial<Tx>) {
    const r = this.rows.get(id)!
    this.rows.set(id, { ...r, data: { ...(r.data as Tx), ...patch }, updatedAt: this.tick(), deviceId: this.id, rev: r.rev + 1 })
  }
  remove(id: string) {
    const r = this.rows.get(id)!
    const now = this.tick()
    this.rows.set(id, { ...r, deletedAt: now, updatedAt: now, deviceId: this.id, rev: r.rev + 1 })
  }
  data(id: string) {
    return this.rows.get(id)?.data
  }
  sync(options?: Parameters<SyncEngine['syncAll']>[0]) {
    return this.engine.syncAll(options)
  }
  private tick() {
    return new Date(Date.UTC(2026, 10, 25, 12, 0, ++this.clock)).toISOString()
  }
}

function setup() {
  const destination = new MemoryDestination()
  return { destination, pc: new Device('pc', destination), phone: new Device('phone', destination) }
}

const nov = { title: 'Mercado', date: '2026-11-14' }

// ── tests ────────────────────────────────────────────────────────────

describe('two devices converge', () => {
  it('what one creates, the other receives', async () => {
    const { pc, phone, destination } = setup()
    pc.create('a', nov)
    expect(await pc.sync()).toMatchObject({ status: 'done', pushed: 1 })
    expect(destination.content('2026-11')).toHaveLength(1)

    expect(await phone.sync()).toMatchObject({ status: 'done', pulled: 1, pushed: 0 })
    expect(phone.data('a')).toEqual(nov)
  })

  it('sent records stop being pending', async () => {
    const { pc } = setup()
    pc.create('a', nov)
    await pc.sync()
    expect(pc.rows.get('a')!.rev).toBe(0)
  })

  it('edits to different records on each side both survive', async () => {
    const { pc, phone } = setup()
    pc.create('a', nov)
    pc.create('b', { title: 'Feira', date: '2026-11-15' })
    await pc.sync()
    await phone.sync()

    pc.edit('a', { title: 'Mercado grande' })
    phone.edit('b', { title: 'Feira livre' })
    await pc.sync()
    await phone.sync()
    await pc.sync()

    for (const device of [pc, phone]) {
      expect(device.data('a')).toMatchObject({ title: 'Mercado grande' })
      expect(device.data('b')).toMatchObject({ title: 'Feira livre' })
    }
  })

  it('a delete travels as a tombstone and never comes back', async () => {
    const { pc, phone } = setup()
    pc.create('a', nov)
    await pc.sync()
    await phone.sync()

    phone.remove('a')
    await phone.sync()
    await pc.sync()
    expect(pc.rows.get('a')!.deletedAt).not.toBeNull()
    await phone.sync()
    expect(phone.rows.get('a')!.deletedAt).not.toBeNull()
  })

  it('nothing changed, nothing written', async () => {
    const { pc, destination } = setup()
    pc.create('a', nov)
    await pc.sync()
    const writes = destination.writes
    expect(await pc.sync()).toMatchObject({ pushed: 0, pulled: 0 })
    expect(destination.writes).toBe(writes)
  })

  it('a record that changes month moves file, never duplicates', async () => {
    const { pc, phone, destination } = setup()
    pc.create('a', nov)
    await pc.sync()
    await phone.sync()

    pc.edit('a', { date: '2026-10-30' })
    await pc.sync()
    expect(destination.content('2026-11')).toEqual([])
    expect(destination.content('2026-10')!.map((r) => r.id)).toEqual(['a'])

    await phone.sync()
    expect(phone.data('a')).toMatchObject({ date: '2026-10-30' })
  })
})

describe('conflicts', () => {
  async function conflicting() {
    const env = setup()
    env.pc.create('a', nov)
    await env.pc.sync()
    await env.phone.sync()
    env.pc.edit('a', { title: 'Do PC' })
    env.phone.edit('a', { title: 'Do celular' })
    await env.pc.sync()
    return env
  }

  it('are reported, labelled, and nothing is written for that collection', async () => {
    const { phone, destination } = await conflicting()
    const writes = destination.writes
    const outcome = await phone.sync()
    expect(outcome).toMatchObject({
      status: 'done',
      conflicts: [{ id: 'a', localLabel: 'Do celular', remoteLabel: 'Do PC' }],
    })
    expect(destination.writes).toBe(writes)
    expect(phone.data('a')).toMatchObject({ title: 'Do celular' })
  })

  it('the user choice is applied and both devices converge', async () => {
    const { pc, phone } = await conflicting()
    await phone.sync()
    await phone.sync({ resolutions: new Map([['a', 'keep-local']]) })
    await pc.sync()
    expect(pc.data('a')).toMatchObject({ title: 'Do celular' })
    expect(phone.data('a')).toMatchObject({ title: 'Do celular' })
  })
})

describe('first sync of a device that already has data', () => {
  async function bothHaveData() {
    const env = setup()
    env.pc.create('shared', nov)
    env.pc.create('pc-only', { title: 'PC', date: '2026-11-01' })
    await env.pc.sync()
    env.phone.create('shared', { title: 'Outro', date: '2026-11-14' })
    env.phone.create('phone-only', { title: 'Celular', date: '2026-11-02' })
    return env
  }

  it('asks instead of guessing, and touches nothing', async () => {
    const { phone, destination } = await bothHaveData()
    const writes = destination.writes
    expect(await phone.sync()).toEqual({ status: 'first-sync' })
    expect(destination.writes).toBe(writes)
    expect(phone.data('phone-only')).toBeDefined()
  })

  it('import: this device becomes the destination', async () => {
    const { phone } = await bothHaveData()
    await phone.sync({ firstSync: 'import' })
    expect([...phone.rows.keys()].sort()).toEqual(['pc-only', 'shared'])
    expect(phone.data('shared')).toEqual(nov)
  })

  it('send: the destination becomes this device', async () => {
    const { phone, pc } = await bothHaveData()
    await phone.sync({ firstSync: 'send' })
    await pc.sync()
    expect(pc.data('shared')).toMatchObject({ title: 'Outro' })
    expect(pc.data('phone-only')).toBeDefined()
  })

  it('merge: every coincident id that differs is a conflict', async () => {
    const { phone } = await bothHaveData()
    const outcome = await phone.sync({ firstSync: 'merge' })
    expect(outcome).toMatchObject({ conflicts: [{ id: 'shared' }] })
    // later syncs keep raising it until decided, then converge
    expect(await phone.sync()).toMatchObject({ conflicts: [{ id: 'shared' }] })
    await phone.sync({ resolutions: new Map([['shared', 'take-remote']]) })
    expect(phone.data('shared')).toEqual(nov)
    expect(phone.data('phone-only')).toBeDefined()
  })

  it('a device with nothing local just receives, no question asked', async () => {
    const { phone } = setup()
    expect(await phone.sync()).toMatchObject({ status: 'done' })
  })
})

describe('races', () => {
  it('someone writes first: pull, merge, retry — nothing lost', async () => {
    const { pc, phone, destination } = setup()
    pc.create('a', nov)
    await pc.sync()
    await phone.sync()
    phone.create('c', { title: 'Do celular', date: '2026-11-21' })

    // After the phone read the destination, the PC writes "b" first.
    destination.beforeWrite = (path, partition) => {
      destination.beforeWrite = null
      const head = destination.files.get(`${path}#${partition}`)!.at(-1)!.records
      destination.put(path, partition, [...head, { ...head[0], id: 'b', data: { title: 'Do PC', date: '2026-11-20' } }])
    }
    await phone.sync()
    await pc.sync()

    expect(destination.content('2026-11')!.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    for (const device of [pc, phone]) expect([...device.rows.keys()].sort()).toEqual(['a', 'b', 'c'])
  })

  it('a write that landed on top of another is merged back from history', async () => {
    const { pc, phone, destination } = setup()
    pc.create('a', nov)
    await pc.sync()
    await phone.sync()
    phone.create('c', { title: 'Do celular', date: '2026-11-21' })

    // Between the phone's etag check and its upload, the PC writes "b".
    destination.duringWrite = (path, partition) => {
      destination.duringWrite = null
      const head = destination.files.get(`${path}#${partition}`)!.at(-1)!.records
      destination.put(path, partition, [...head, { ...head[0], id: 'b', data: { title: 'Do PC', date: '2026-11-20' } }])
    }
    await phone.sync()

    const ids = destination.content('2026-11')!.map((r) => r.id)
    expect(ids).toEqual(['a', 'b', 'c'])
    expect([...phone.rows.keys()].sort()).toEqual(['a', 'b', 'c'])
  })
})
