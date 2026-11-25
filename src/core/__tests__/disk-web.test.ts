import { describe, expect, it } from 'vitest'
import type { Envelope } from '@core/api/types'
import { folderDestination } from '@core/storage/destinations'
import { DiskWebAdapter, hash } from '@core/storage/disk-web'
import { AuthExpiredError, EtagMismatchError } from '@core/storage/errors'
import { FakeFolder } from './fakeFolder'

const PATH = 'finance/transactions'

function record(id: string, title: string): Envelope<unknown> {
  return {
    id,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    deletedAt: null,
    deviceId: 'pc',
    rev: 0,
    schemaVersion: 2,
    tags: [],
    data: { title },
  }
}

function setup(now = () => new Date('2026-11-25T12:00:00.000Z')) {
  const root = new FakeFolder('TeOrganiza')
  return { root, adapter: new DiskWebAdapter({ root, now }) }
}

describe('disk-web adapter', () => {
  it('writes the shared layout, readable without the app', async () => {
    const { root, adapter } = setup()
    await adapter.write(PATH, '2026-11', [record('a', 'Mercado')], null)

    const file = JSON.parse(root.read('finance/transactions/2026-11.json')!)
    expect(file.schemaVersion).toBe(2)
    expect(file.records[0].data.title).toBe('Mercado')
  })

  it('reads back what it wrote, with the content hash as the etag', async () => {
    const { root, adapter } = setup()
    const { etag } = await adapter.write(PATH, '2026-11', [record('a', 'Mercado')], null)

    const read = await adapter.read(PATH, '2026-11')
    expect(read!.records.map((r) => r.id)).toEqual(['a'])
    expect(read!.etag).toBe(etag)
    expect(etag).toBe(await hash(root.read('finance/transactions/2026-11.json')!))
  })

  it('returns null for a partition or collection that does not exist', async () => {
    const { adapter } = setup()
    expect(await adapter.read(PATH, '2026-11')).toBeNull()
    expect(await adapter.listPartitions(PATH)).toEqual([])
  })

  it('lists partitions sorted, ignoring anything that is not a partition', async () => {
    const { root, adapter } = setup()
    await adapter.write(PATH, '2026-11', [], null)
    await adapter.write(PATH, '2026-10', [], null)
    const folder = await (await root.getDirectoryHandle('finance')).getDirectoryHandle('transactions')
    folder.files.set('_notes.json', '{}')
    folder.files.set('readme.txt', 'hi')

    expect(await adapter.listPartitions(PATH)).toEqual(['2026-10', '2026-11'])
  })

  it('refuses a write whose expected etag is stale, and leaves the file alone', async () => {
    const { root, adapter } = setup()
    const first = await adapter.write(PATH, 'all', [record('a', 'one')], null)
    await adapter.write(PATH, 'all', [record('a', 'two')], first.etag)
    const before = root.read('finance/transactions/all.json')

    await expect(adapter.write(PATH, 'all', [record('a', 'three')], first.etag)).rejects.toBeInstanceOf(
      EtagMismatchError,
    )
    expect(root.read('finance/transactions/all.json')).toBe(before)
  })

  it('refuses to create a file someone else already created', async () => {
    const { adapter } = setup()
    await adapter.write(PATH, 'all', [record('a', 'theirs')], null)
    await expect(adapter.write(PATH, 'all', [record('b', 'ours')], null)).rejects.toBeInstanceOf(EtagMismatchError)
  })

  it('turns a lost folder permission into AuthExpiredError, so sync waits for a click', async () => {
    const { root, adapter } = setup()
    await adapter.write(PATH, 'all', [], null)
    root.permission = 'prompt'

    await expect(adapter.read(PATH, 'all')).rejects.toBeInstanceOf(AuthExpiredError)
    await expect(adapter.init()).rejects.toBeInstanceOf(AuthExpiredError)
  })

  it('keeps the device lease in _lock.json and reports another active device', async () => {
    let clock = new Date('2026-11-25T12:00:00.000Z')
    const root = new FakeFolder('TeOrganiza')
    const pc = new DiskWebAdapter({ root, now: () => clock })
    const laptop = new DiskWebAdapter({ root, now: () => clock })

    expect(await pc.acquireLock({ deviceId: 'pc', nickname: 'PC' })).toEqual({ held: true })
    expect(JSON.parse(root.read('_lock.json')!).deviceId).toBe('pc')

    clock = new Date('2026-11-25T12:10:00.000Z')
    expect(await laptop.acquireLock({ deviceId: 'laptop', nickname: 'Notebook' })).toEqual({
      held: false,
      by: { deviceId: 'pc', nickname: 'PC' },
      since: '2026-11-25T12:00:00.000Z',
    })

    expect(await laptop.acquireLock({ deviceId: 'laptop', nickname: 'Notebook' }, { takeOver: true })).toEqual({
      held: true,
    })

    // The PC was taken over: releasing must not free the laptop's lease.
    await pc.releaseLock()
    expect(JSON.parse(root.read('_lock.json')!).deviceId).toBe('laptop')

    await laptop.releaseLock()
    expect(await pc.acquireLock({ deviceId: 'pc', nickname: 'PC' })).toEqual({ held: true })
  })
})

describe('folder destination', () => {
  function store() {
    const meta = new Map<string, unknown>()
    return {
      meta,
      getMeta: async <T,>(key: string) => meta.get(key) as T | undefined,
      setMeta: async (key: string, value: unknown) => void meta.set(key, value),
    }
  }

  it('creates a TeOrganiza folder inside the one the user picked', async () => {
    const documents = new FakeFolder('Documentos')
    const destination = folderDestination(store(), async () => documents)

    expect(await destination.isReady()).toBe(false)
    await destination.connect()

    expect(documents.folders.has('TeOrganiza')).toBe(true)
    expect(await destination.isReady()).toBe(true)
    expect(await destination.label()).toBe('Documentos')
  })

  it('uses the picked folder itself when it already is the TeOrganiza folder', async () => {
    const existing = new FakeFolder('TeOrganiza')
    const destination = folderDestination(store(), async () => existing)
    await destination.connect()
    const adapter = await destination.createAdapter()
    await adapter.write(PATH, 'all', [], null)

    expect(existing.read('finance/transactions/all.json')).toBeDefined()
    expect(existing.folders.has('TeOrganiza')).toBe(false)
  })

  it('after a reload asks for permission again instead of picking a new folder', async () => {
    const documents = new FakeFolder('Documentos')
    let picks = 0
    const destination = folderDestination(store(), async () => {
      picks++
      return documents
    })
    await destination.connect()
    documents.permission = 'prompt' // what a reload does

    expect(await destination.isReady()).toBe(false)
    await destination.connect()
    expect(picks).toBe(1)
    expect(await destination.isReady()).toBe(true)
  })

  it('fails to connect when the user refuses the permission', async () => {
    const documents = new FakeFolder('Documentos')
    const destination = folderDestination(store(), async () => documents)
    await destination.connect()
    documents.permission = 'prompt'
    documents.answer = 'denied'

    await expect(destination.connect()).rejects.toThrow(/not allowed/)
  })

  it('forgets the folder on disconnect, without touching its files', async () => {
    const documents = new FakeFolder('Documentos')
    const destination = folderDestination(store(), async () => documents)
    await destination.connect()
    const adapter = await destination.createAdapter()
    await adapter.write(PATH, 'all', [], null)

    await destination.forget()
    expect(await destination.isReady()).toBe(false)
    expect(await destination.label()).toBeNull()
    expect(documents.folders.get('TeOrganiza')!.read('finance/transactions/all.json')).toBeDefined()
  })
})
