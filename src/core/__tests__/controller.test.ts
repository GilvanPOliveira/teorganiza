import { beforeEach, describe, expect, it } from 'vitest'
import type { Envelope } from '@core/api/types'
import { driveDestination, folderDestination } from '@core/storage/destinations'
import { DriveAdapter } from '@core/storage/drive'
import { AuthExpiredError } from '@core/storage/errors'
import {
  SyncController,
  type Auth,
  type SyncBaseStore,
  type SyncPolicy,
} from '@core/sync/controller'
import type { LocalChange, LocalStore } from '@core/sync/engine'
import { canonical } from '@core/sync/merge'
import type { PartitionState } from '@core/sync/types'
import { FakeDrive } from './fakeDrive'
import { FakeFolder } from './fakeFolder'

type Rec = Envelope<unknown>
const PATH = 'notes/items'

class FakeAuth implements Auth {
  connected = false
  connects = 0
  refuse = false
  async connect() {
    this.connects++
    if (this.refuse) throw new AuthExpiredError()
    this.connected = true
  }
  async getAccessToken() {
    if (!this.connected) throw new AuthExpiredError()
    return 'valid'
  }
  signOut() {
    this.connected = false
  }
  async revoke() {
    this.connected = false
  }
}

class MemoryLocal implements LocalStore {
  rows = new Map<string, Rec>()
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
  add(id: string, title: string, deviceId = 'pc') {
    const now = '2026-11-25T12:00:00.000Z'
    this.rows.set(id, { id, createdAt: now, updatedAt: now, deletedAt: null, deviceId, rev: 1, schemaVersion: 1, data: { title } })
  }
}

class MemoryBases implements SyncBaseStore {
  bases = new Map<string, PartitionState>()
  meta = new Map<string, unknown>()
  async load() {
    return new Map(this.bases)
  }
  async save(_p: string, partition: string, state: PartitionState) {
    this.bases.set(partition, state)
  }
  async isConnected() {
    return this.meta.get('connected') === true
  }
  async markConnected() {
    this.meta.set('connected', true)
  }
  async clear() {
    this.bases.clear()
    this.meta.clear()
  }
  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined
  }
  async setMeta(key: string, value: unknown) {
    this.meta.set(key, value)
  }
}

let drive: FakeDrive

function device(id: string, policy: SyncPolicy = 'on-leave', shared?: { bases: MemoryBases; local: MemoryLocal }) {
  const auth = new FakeAuth()
  const local = shared?.local ?? new MemoryLocal()
  const bases = shared?.bases ?? new MemoryBases()
  const controller = new SyncController({
    destinations: {
      drive: driveDestination(
        auth,
        (a) => new DriveAdapter({ getAccessToken: () => a.getAccessToken(), fetch: drive.fetch as typeof fetch }),
      ),
    },
    local,
    bases,
    collections: () => [{ path: PATH, describe: (r) => (r.data as { title: string }).title }],
    counts: {
      pending: async () => [...local.rows.values()].filter((r) => r.rev > 0).length,
      live: async () => [...local.rows.values()].filter((r) => r.deletedAt === null).length,
    },
    device: () => ({ deviceId: id, nickname: id.toUpperCase() }),
    policy: async () => policy,
    persist: async () => true,
    setInterval: () => 0,
    clearInterval: () => {},
  })
  return { controller, auth, local, bases }
}

beforeEach(() => {
  drive = new FakeDrive()
})

describe('without a destination', () => {
  it('is the evaluation state, with what is at risk counted', async () => {
    const { controller, local } = device('pc')
    local.add('a', 'Nota')
    await controller.start()
    expect(controller.getState()).toMatchObject({ phase: 'local-only', kind: null, liveCount: 1, persisted: true })
  })
})

describe('connecting', () => {
  it('connects, takes the lease, syncs and empties the queue', async () => {
    const { controller, local } = device('pc')
    local.add('a', 'Nota')
    await controller.start()
    await controller.connectDrive()
    expect(controller.getState()).toMatchObject({ phase: 'idle', kind: 'drive', pendingCount: 0 })
    expect(controller.getState().lastSyncAt).not.toBeNull()
    expect(drive.contentAt('TeOrganiza/_lock.json')).toMatchObject({ deviceId: 'pc' })
  })

  it('a refused popup leaves everything as it was', async () => {
    const { controller, auth } = device('pc')
    auth.refuse = true
    await controller.start()
    await controller.connectDrive()
    expect(controller.getState()).toMatchObject({ phase: 'local-only', kind: null })
  })

  it('after a reload, it waits for a click — no popup on its own', async () => {
    const first = device('pc')
    await first.controller.start()
    await first.controller.connectDrive()

    const reopened = device('pc', 'on-leave', { bases: first.bases, local: first.local })
    await reopened.controller.start()
    expect(reopened.controller.getState()).toMatchObject({ phase: 'needs-auth', kind: 'drive' })
    expect(reopened.auth.connects).toBe(0)
  })
})

describe('token expiry with a pending queue', () => {
  it('aborts, keeps the queue, asks to reconnect', async () => {
    const { controller, auth, local } = device('pc')
    await controller.start()
    await controller.connectDrive()
    local.add('b', 'Nova')
    auth.connected = false
    await controller.sync()
    expect(controller.getState()).toMatchObject({ phase: 'needs-auth', pendingCount: 1 })

    await controller.connectDrive()
    expect(controller.getState()).toMatchObject({ phase: 'idle', pendingCount: 0 })
  })
})

describe('the soft lock', () => {
  it('reports who has it open, and lets the user take over', async () => {
    const pc = device('pc')
    await pc.controller.start()
    await pc.controller.connectDrive()

    const phone = device('phone')
    await phone.controller.start()
    await phone.controller.connectDrive()
    expect(phone.controller.getState()).toMatchObject({
      phase: 'lock-held',
      lockHolder: { by: { deviceId: 'pc', nickname: 'PC' } },
    })

    await phone.controller.takeOver()
    expect(phone.controller.getState().phase).toBe('idle')
    expect(drive.contentAt('TeOrganiza/_lock.json')).toMatchObject({ deviceId: 'phone' })
  })

  it('or just consult, without the lease', async () => {
    const pc = device('pc')
    pc.local.add('a', 'Do PC')
    await pc.controller.start()
    await pc.controller.connectDrive()

    const phone = device('phone')
    await phone.controller.start()
    await phone.controller.connectDrive()
    await phone.controller.ignoreLease()
    expect(phone.local.rows.has('a')).toBe(true)
    expect(drive.contentAt('TeOrganiza/_lock.json')).toMatchObject({ deviceId: 'pc' })
  })

  it('leaving sends and releases', async () => {
    const pc = device('pc')
    await pc.controller.start()
    await pc.controller.connectDrive()
    pc.local.add('a', 'Ao sair')
    await pc.controller.handleHidden()
    expect(drive.contentAt('TeOrganiza/notes/items/all.json')).toMatchObject({ records: [{ id: 'a' }] })

    const phone = device('phone')
    await phone.controller.start()
    await phone.controller.connectDrive()
    expect(phone.controller.getState().phase).toBe('idle')
  })

  it('manual policy does not send on leaving', async () => {
    const pc = device('pc', 'manual')
    await pc.controller.start()
    await pc.controller.connectDrive()
    pc.local.add('a', 'Fica')
    await pc.controller.handleHidden()
    await pc.controller.refreshCounts()
    expect(pc.controller.getState().pendingCount).toBe(1)
    expect(drive.contentAt('TeOrganiza/notes/items/all.json')).toBeUndefined()
  })
})

describe('questions for the user', () => {
  it('first sync with data on both sides asks, then follows the choice', async () => {
    const pc = device('pc')
    pc.local.add('a', 'PC')
    await pc.controller.start()
    await pc.controller.connectDrive()
    await pc.controller.handleHidden()

    const phone = device('phone')
    phone.local.add('b', 'Celular', 'phone')
    await phone.controller.start()
    await phone.controller.connectDrive()
    expect(phone.controller.getState().phase).toBe('first-sync')

    await phone.controller.chooseFirstSync('merge')
    expect([...phone.local.rows.keys()].sort()).toEqual(['a', 'b'])
    expect(phone.controller.getState().phase).toBe('idle')
  })

  it('conflicts are surfaced and resolved through the controller', async () => {
    const pc = device('pc')
    pc.local.add('a', 'Original')
    await pc.controller.start()
    await pc.controller.connectDrive()
    await pc.controller.handleHidden()

    const phone = device('phone')
    await phone.controller.start()
    await phone.controller.connectDrive()
    await phone.controller.handleHidden()

    const edit = (local: MemoryLocal, title: string) => {
      const r = local.rows.get('a')!
      local.rows.set('a', { ...r, data: { title }, rev: 1 })
    }
    edit(pc.local, 'PC')
    edit(phone.local, 'Celular')
    await pc.controller.sync()
    await phone.controller.sync()
    expect(phone.controller.getState()).toMatchObject({
      phase: 'conflicts',
      conflicts: [{ id: 'a', localLabel: 'Celular', remoteLabel: 'PC' }],
    })

    await phone.controller.resolveConflicts(new Map([['a', 'take-remote']]))
    expect(phone.controller.getState()).toMatchObject({ phase: 'idle', conflicts: [] })
    expect(phone.local.rows.get('a')!.data).toEqual({ title: 'PC' })
  })
})

describe('disconnecting', () => {
  it('forgets the destination and keeps every local record', async () => {
    const { controller, local, bases } = device('pc')
    local.add('a', 'Fica')
    await controller.start()
    await controller.connectDrive()
    await controller.disconnect()
    expect(controller.getState()).toMatchObject({ phase: 'local-only', kind: null })
    expect(local.rows.has('a')).toBe(true)
    expect(bases.bases.size).toBe(0)
  })
})

describe('a folder as the destination', () => {
  function folderDevice(id: string, folder: FakeFolder, shared?: { bases: MemoryBases; local: MemoryLocal }) {
    const local = shared?.local ?? new MemoryLocal()
    const bases = shared?.bases ?? new MemoryBases()
    let picks = 0
    const controller = new SyncController({
      destinations: {
        'disk-web': folderDestination(bases, async () => {
          picks++
          return folder
        }),
      },
      local,
      bases,
      collections: () => [{ path: PATH, describe: (r) => (r.data as { title: string }).title }],
      counts: {
        pending: async () => [...local.rows.values()].filter((r) => r.rev > 0).length,
        live: async () => [...local.rows.values()].filter((r) => r.deletedAt === null).length,
      },
      device: () => ({ deviceId: id, nickname: id.toUpperCase() }),
      policy: async () => 'on-leave',
      persist: async () => true,
      setInterval: () => 0,
      clearInterval: () => {},
    })
    return { controller, local, bases, picks: () => picks }
  }

  it('carries data between two computers through the same folder', async () => {
    const shared = new FakeFolder('Dropbox')
    const pc = folderDevice('pc', shared)
    pc.local.add('a', 'Do PC')
    await pc.controller.start()
    await pc.controller.connectFolder()
    expect(pc.controller.getState()).toMatchObject({
      phase: 'idle',
      kind: 'disk-web',
      pendingCount: 0,
      destinationLabel: 'Dropbox',
    })
    expect(shared.folders.get('TeOrganiza')!.read('notes/items/all.json')).toContain('Do PC')

    await pc.controller.handleHidden() // releases the lease
    const laptop = folderDevice('laptop', shared)
    await laptop.controller.start()
    await laptop.controller.connectFolder()
    expect(laptop.controller.getState().phase).toBe('idle')
    expect(laptop.local.rows.get('a')?.data).toEqual({ title: 'Do PC' })
  })

  it('after a reload with the permission kept, syncs without asking', async () => {
    const folder = new FakeFolder('Documentos')
    const first = folderDevice('pc', folder)
    await first.controller.start()
    await first.controller.connectFolder()

    const reopened = folderDevice('pc', folder, { bases: first.bases, local: first.local })
    await reopened.controller.start()
    expect(reopened.controller.getState()).toMatchObject({ phase: 'idle', kind: 'disk-web' })
    expect(reopened.picks()).toBe(0)
  })

  it('after a reload without permission, waits for a click and keeps the queue', async () => {
    const folder = new FakeFolder('Documentos')
    const first = folderDevice('pc', folder)
    await first.controller.start()
    await first.controller.connectFolder()

    folder.permission = 'prompt'
    const reopened = folderDevice('pc', folder, { bases: first.bases, local: first.local })
    reopened.local.add('b', 'Nova')
    await reopened.controller.start()
    expect(reopened.controller.getState()).toMatchObject({ phase: 'needs-auth', pendingCount: 1 })

    await reopened.controller.connectFolder() // "Permitir acesso"
    expect(reopened.controller.getState()).toMatchObject({ phase: 'idle', pendingCount: 0 })
    expect(reopened.picks()).toBe(0)
    expect(folder.folders.get('TeOrganiza')!.read('notes/items/all.json')).toContain('Nova')
  })

  it('a cancelled folder picker leaves everything as it was', async () => {
    const local = new MemoryLocal()
    const bases = new MemoryBases()
    const controller = new SyncController({
      destinations: {
        'disk-web': folderDestination(bases, async () => {
          throw Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })
        }),
      },
      local,
      bases,
      collections: () => [],
      counts: { pending: async () => 0, live: async () => 0 },
      device: () => ({ deviceId: 'pc', nickname: 'PC' }),
      policy: async () => 'on-leave',
      setInterval: () => 0,
      clearInterval: () => {},
    })
    await controller.start()
    await controller.connectFolder()
    expect(controller.getState()).toMatchObject({ phase: 'local-only', kind: null })
  })
})
