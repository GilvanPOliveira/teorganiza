import { beforeEach, describe, expect, it } from 'vitest'
import type { Envelope } from '@core/api/types'
import { DriveAdapter } from '@core/storage/drive'
import {
  AuthExpiredError,
  ConcurrentWriteError,
  EtagMismatchError,
} from '@core/storage/errors'
import { LEASE_TTL_MS } from '@core/sync/lock'
import { FakeDrive } from './fakeDrive'

const PATH = 'finance/transactions'
const FILE = 'TeOrganiza/finance/transactions/2026-11.json'

function record(id: string, amount: number): Envelope<unknown> {
  return {
    id,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    deletedAt: null,
    deviceId: 'pc',
    rev: 0,
    schemaVersion: 2,
    data: { amount },
  }
}

let drive: FakeDrive
let clock: Date

function adapter(fake = drive) {
  return new DriveAdapter({
    getAccessToken: async () => 'valid',
    fetch: fake.fetch as typeof fetch,
    now: () => clock,
  })
}

beforeEach(() => {
  drive = new FakeDrive()
  clock = new Date('2026-11-25T12:00:00.000Z')
})

describe('partitions', () => {
  it('init creates the visible TeOrganiza folder once', async () => {
    await adapter().init()
    await adapter().init()
    const roots = [...drive.files.values()].filter((f) => f.name === 'TeOrganiza')
    expect(roots).toHaveLength(1)
  })

  it('reads nothing where nothing was written', async () => {
    const a = adapter()
    expect(await a.read(PATH, '2026-11')).toBeNull()
    expect(await a.listPartitions(PATH)).toEqual([])
  })

  it('writes a readable file and reads it back with its etag', async () => {
    const a = adapter()
    const records = [record('a', 100), record('b', 200)]
    const { etag } = await a.write(PATH, '2026-11', records, null)

    expect(drive.contentAt(FILE)).toEqual({ schemaVersion: 2, records })
    expect(await a.read(PATH, '2026-11')).toEqual({ records, etag })
  })

  it('lists partitions by name', async () => {
    const a = adapter()
    await a.write(PATH, '2026-11', [], null)
    await a.write(PATH, '2026-10', [], null)
    await a.write('finance/accounts', 'all', [], null)
    expect(await a.listPartitions(PATH)).toEqual(['2026-10', '2026-11'])
  })

  it('a second device sees what the first wrote', async () => {
    const { etag } = await adapter().write(PATH, '2026-11', [record('a', 1)], null)
    const other = await adapter().read(PATH, '2026-11')
    expect(other?.etag).toBe(etag)
  })

  it('rejects partition and path names that would escape the layout', async () => {
    const a = adapter()
    await expect(a.write(PATH, '../x', [], null)).rejects.toThrow(/partition/)
    await expect(a.write(PATH, '_lock', [], null)).rejects.toThrow(/partition/)
    await expect(a.write('finance//x', 'all', [], null)).rejects.toThrow(/collection path/)
  })
})

describe('the etag makes silent overwrite impossible', () => {
  it('updates when the expected etag is current', async () => {
    const a = adapter()
    const first = await a.write(PATH, '2026-11', [record('a', 1)], null)
    const second = await a.write(PATH, '2026-11', [record('a', 2)], first.etag)
    expect(second.etag).not.toBe(first.etag)
    expect((await a.read(PATH, '2026-11'))?.records).toEqual([record('a', 2)])
  })

  it('rejects a stale etag and leaves the destination untouched', async () => {
    const a = adapter()
    const { etag } = await a.write(PATH, '2026-11', [record('a', 1)], null)
    const theirs = drive.writeAs(FILE, { schemaVersion: 2, records: [record('a', 9)] })

    const attempt = a.write(PATH, '2026-11', [record('a', 2)], etag)
    await expect(attempt).rejects.toBeInstanceOf(EtagMismatchError)
    await expect(attempt).rejects.toMatchObject({ expected: etag, actual: theirs })
    expect(drive.contentAt(FILE)).toEqual({ schemaVersion: 2, records: [record('a', 9)] })
  })

  it('rejects "create" when the file already exists', async () => {
    await adapter().write(PATH, '2026-11', [record('a', 1)], null)
    await expect(adapter().write(PATH, '2026-11', [], null)).rejects.toBeInstanceOf(EtagMismatchError)
  })

  it('rejects an update when the file does not exist', async () => {
    await expect(adapter().write(PATH, '2026-11', [], 'r999')).rejects.toBeInstanceOf(EtagMismatchError)
  })

  it('detects a write that slipped between the check and the upload', async () => {
    const a = adapter()
    const { etag } = await a.write(PATH, '2026-11', [record('a', 1)], null)
    let theirs = ''
    drive.beforeUpload = () => {
      drive.beforeUpload = null
      theirs = drive.writeAs(FILE, { schemaVersion: 2, records: [record('a', 9)] })
    }

    const attempt = a.write(PATH, '2026-11', [record('a', 2)], etag)
    await expect(attempt).rejects.toBeInstanceOf(ConcurrentWriteError)
    await expect(attempt).rejects.toMatchObject({ overwritten: theirs })
    // Their version is not gone: it is a revision the engine can read back.
    const file = drive.byPath(FILE)!
    expect(file.revisions.map((r) => r.id)).toContain(theirs)
  })

  it('two devices creating the same file: the later one loses and cleans up', async () => {
    const a = adapter()
    await a.init()
    await a.write(PATH, 'seed', [], null) // folders exist
    drive.beforeUpload = (_id, name) => {
      if (name !== '2026-11.json') return
      drive.beforeUpload = null
      const folder = drive.byPath('TeOrganiza/finance/transactions')!
      drive.revise(drive.add('2026-11.json', 'application/json', folder.id), '{"records":[]}')
    }

    await expect(a.write(PATH, '2026-11', [record('a', 1)], null)).rejects.toBeInstanceOf(EtagMismatchError)
    const copies = [...drive.files.values()].filter((f) => f.name === '2026-11.json')
    expect(copies).toHaveLength(1)
  })
})

describe('retries', () => {
  function retrying() {
    const waits: number[] = []
    const a = new DriveAdapter({
      getAccessToken: async () => 'valid',
      fetch: drive.fetch as typeof fetch,
      sleep: async (ms) => void waits.push(ms),
    })
    return { a, waits }
  }

  it('a rate limit is retried, honouring Retry-After', async () => {
    const { a, waits } = retrying()
    drive.failNext = [{ status: 429 }, { status: 403, body: '{"reason":"userRateLimitExceeded"}' }]
    await a.init()
    expect(waits).toHaveLength(2)
    expect(drive.byPath('TeOrganiza')).toBeDefined()
  })

  it('a 5xx on a read is retried', async () => {
    const { a, waits } = retrying()
    await a.write(PATH, '2026-11', [record('a', 1)], null)
    drive.failNext = [{ status: 503 }]
    expect((await a.read(PATH, '2026-11'))?.records).toHaveLength(1)
    expect(waits).toHaveLength(1)
  })

  it('a 5xx on a write is not repeated blindly', async () => {
    const { etag } = await adapter().write(PATH, '2026-11', [record('a', 1)], null)
    let uploads = 0
    const failingUploads: typeof fetch = async (input, init) => {
      if (init?.method === 'PATCH') {
        uploads++
        return new Response('boom', { status: 500 })
      }
      return drive.fetch(input as string, init)
    }
    const a = new DriveAdapter({ getAccessToken: async () => 'valid', fetch: failingUploads, sleep: async () => {} })
    await expect(a.write(PATH, '2026-11', [record('a', 2)], etag)).rejects.toMatchObject({ status: 500 })
    expect(uploads).toBe(1)
  })

  it('gives up after a bounded number of attempts', async () => {
    const { a, waits } = retrying()
    drive.failNext = Array.from({ length: 10 }, () => ({ status: 429 }))
    await expect(a.init()).rejects.toMatchObject({ status: 429 })
    expect(waits).toHaveLength(4)
  })
})

describe('auth', () => {
  it('a rejected token surfaces as AuthExpiredError, before any write', async () => {
    const a = adapter()
    await a.init()
    drive.token = 'rotated'
    drive.requests = []
    await expect(a.write(PATH, '2026-11', [], null)).rejects.toBeInstanceOf(AuthExpiredError)
    expect(drive.requests.filter((r) => !r.startsWith('GET'))).toEqual([])
  })

  it('never stores the token: it asks for it on every request', async () => {
    let asked = 0
    const a = new DriveAdapter({
      getAccessToken: async () => (asked++, 'valid'),
      fetch: drive.fetch as typeof fetch,
    })
    await a.init()
    expect(asked).toBe(drive.requests.length)
  })
})

describe('device lock', () => {
  const pc = { deviceId: 'pc', nickname: 'PC casa' }
  const phone = { deviceId: 'phone', nickname: 'Celular' }

  it('takes a free lock and writes the lease file', async () => {
    expect(await adapter().acquireLock(pc)).toEqual({ held: true })
    expect(drive.contentAt('TeOrganiza/_lock.json')).toEqual({
      deviceId: 'pc',
      nickname: 'PC casa',
      acquiredAt: clock.toISOString(),
      expiresAt: new Date(clock.getTime() + LEASE_TTL_MS).toISOString(),
    })
  })

  it('reports who holds an active lease, and since when', async () => {
    await adapter().acquireLock(pc)
    clock = new Date(clock.getTime() + 12 * 60 * 1000)
    expect(await adapter().acquireLock(phone)).toEqual({
      held: false,
      by: pc,
      since: '2026-11-25T12:00:00.000Z',
    })
  })

  it('is soft: the user may take over', async () => {
    await adapter().acquireLock(pc)
    expect(await adapter().acquireLock(phone, { takeOver: true })).toEqual({ held: true })
    expect(drive.contentAt('TeOrganiza/_lock.json')).toMatchObject({ deviceId: 'phone' })
  })

  it('ignores an expired lease (browser closed without releasing)', async () => {
    await adapter().acquireLock(pc)
    clock = new Date(clock.getTime() + LEASE_TTL_MS + 1)
    expect(await adapter().acquireLock(phone)).toEqual({ held: true })
  })

  it('renewing our own lease extends it and keeps when it started', async () => {
    const a = adapter()
    await a.acquireLock(pc)
    clock = new Date(clock.getTime() + 5 * 60 * 1000)
    await a.acquireLock(pc)
    expect(drive.contentAt('TeOrganiza/_lock.json')).toMatchObject({
      acquiredAt: '2026-11-25T12:00:00.000Z',
      expiresAt: new Date(clock.getTime() + LEASE_TTL_MS).toISOString(),
    })
  })

  it('release frees the lock for the next device', async () => {
    const a = adapter()
    await a.acquireLock(pc)
    await a.releaseLock()
    expect(await adapter().acquireLock(phone)).toEqual({ held: true })
  })

  it('release does not undo a takeover', async () => {
    const a = adapter()
    await a.acquireLock(pc)
    await adapter().acquireLock(phone, { takeOver: true })
    await a.releaseLock()
    expect(drive.contentAt('TeOrganiza/_lock.json')).toMatchObject({ deviceId: 'phone' })
    expect(await adapter().acquireLock(pc)).toMatchObject({ held: false, by: phone })
  })

  it('losing a race for the lease gives it back to whoever wrote first', async () => {
    await adapter().acquireLock(pc)
    clock = new Date(clock.getTime() + LEASE_TTL_MS + 1) // pc's lease expired
    const tablet = { deviceId: 'tablet', nickname: 'Tablet' }
    drive.beforeUpload = (_id, name) => {
      if (name !== '_lock.json') return
      drive.beforeUpload = null
      drive.writeAs('TeOrganiza/_lock.json', {
        ...tablet,
        acquiredAt: clock.toISOString(),
        expiresAt: new Date(clock.getTime() + LEASE_TTL_MS).toISOString(),
      })
    }
    // The phone's upload lands on top of the tablet's. The tablet already
    // believes it holds the lock, so the phone must yield and restore it.
    expect(await adapter().acquireLock(phone)).toEqual({
      held: false,
      by: tablet,
      since: clock.toISOString(),
    })
    expect(drive.contentAt('TeOrganiza/_lock.json')).toMatchObject({ deviceId: 'tablet' })
  })

  it('a taken-over race still ends with the device that asked to take over', async () => {
    await adapter().acquireLock(pc)
    drive.beforeUpload = (_id, name) => {
      if (name !== '_lock.json') return
      drive.beforeUpload = null
      drive.writeAs('TeOrganiza/_lock.json', {
        deviceId: 'pc',
        nickname: 'PC casa',
        acquiredAt: clock.toISOString(),
        expiresAt: new Date(clock.getTime() + LEASE_TTL_MS).toISOString(),
      })
    }
    expect(await adapter().acquireLock(phone, { takeOver: true })).toEqual({ held: true })
    expect(drive.contentAt('TeOrganiza/_lock.json')).toMatchObject({ deviceId: 'phone' })
  })
})
