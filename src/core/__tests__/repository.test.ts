import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Envelope, Module } from '@core/api/types'
import { openDatabase, resetDatabaseHandle, table } from '@core/db/database'
import { uuidv7 } from '@core/db/envelope'
import {
  createRecord,
  readAll,
  readOne,
  removeRecord,
  restoreRecord,
  setRecordTags,
  updateRecord,
} from '@core/db/repository'
import { registerModules } from '@core/registry/registry'

interface Note {
  title: string
  pinned: boolean
}

const DEVICE = 'device-under-test'
const PATH = 'notes/items'

const noteModule: Module = {
  id: 'notes',
  name: 'Notes',
  apiVersion: 1,
  version: '1.0.0',
  collections: [
    {
      name: 'items',
      schema: z.object({ title: z.string(), pinned: z.boolean() }),
      schemaVersion: 2,
      describe: (record) => (record.data as Note).title,
      indexes: ['title'],
    },
  ],
  routes: [{ path: '', element: () => null }],
  migrations: {
    // v1 had no `pinned`; it arrives defaulted on read, never by rewriting storage.
    items: [(record) => ({ ...record, data: { ...(record.data as object), pinned: false } })],
  },
}

beforeEach(async () => {
  resetDatabaseHandle()
  await indexedDB.deleteDatabase('teorganiza')
  registerModules([noteModule])
  openDatabase()
})

describe('uuidv7', () => {
  it('produces a version 7 uuid that sorts by creation time', () => {
    const first = uuidv7()
    const later = uuidv7()
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect([later, first].sort()[0]).toBe(first)
  })

  it('stays ordered for thousands of ids made in the same millisecond', () => {
    const ids = Array.from({ length: 5000 }, () => uuidv7())
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })
})

describe('repository', () => {
  it('builds the envelope so the module never has to', async () => {
    const id = await createRecord<Note>(PATH, { title: 'Comprar pão', pinned: false }, DEVICE)
    const record = await readOne<Note>(PATH, id)

    expect(record).toBeDefined()
    expect(record!.deviceId).toBe(DEVICE)
    expect(record!.rev).toBe(1)
    expect(record!.deletedAt).toBeNull()
    expect(record!.schemaVersion).toBe(2)
    expect(record!.data.title).toBe('Comprar pão')
  })

  it('rejects data that does not match the collection schema', async () => {
    await expect(
      createRecord(PATH, { title: 42, pinned: false } as unknown as Note, DEVICE),
    ).rejects.toThrow()
  })

  it('bumps rev and updatedAt on update', async () => {
    const id = await createRecord<Note>(PATH, { title: 'a', pinned: false }, DEVICE)
    await updateRecord<Note>(PATH, id, { title: 'b' }, DEVICE)

    const record = await readOne<Note>(PATH, id)
    expect(record!.rev).toBe(2)
    expect(record!.data.title).toBe('b')
  })

  it('tombstones on remove instead of deleting the row', async () => {
    const id = await createRecord<Note>(PATH, { title: 'a', pinned: false }, DEVICE)
    await removeRecord(PATH, id, DEVICE)

    // Hidden from the module...
    expect(await readAll<Note>(PATH)).toHaveLength(0)

    // ...but still on disk, which is what keeps a sync from resurrecting it.
    const withDeleted = await readAll<Note>(PATH, { includeDeleted: true })
    expect(withDeleted).toHaveLength(1)
    expect(withDeleted[0].deletedAt).not.toBeNull()
  })

  it('restores a tombstone as an ordinary edit', async () => {
    const id = await createRecord<Note>(PATH, { title: 'a', pinned: false }, DEVICE)
    await removeRecord(PATH, id, DEVICE)
    await restoreRecord(PATH, id, 'another-device')

    const record = await readOne<Note>(PATH, id)
    expect(record!.deletedAt).toBeNull()
    expect(record!.rev).toBe(3)
    expect(record!.deviceId).toBe('another-device')
    expect(await readAll<Note>(PATH)).toHaveLength(1)

    // Restoring a live record changes nothing.
    await restoreRecord(PATH, id, DEVICE)
    expect((await readOne<Note>(PATH, id))!.rev).toBe(3)
  })

  it('stores tags as a set in the envelope and filters by them', async () => {
    const a = await createRecord<Note>(PATH, { title: 'a', pinned: false }, DEVICE, ['t2', 't1', 't1'])
    const b = await createRecord<Note>(PATH, { title: 'b', pinned: false }, DEVICE)

    expect((await readOne<Note>(PATH, a))!.tags).toEqual(['t1', 't2'])
    expect((await readOne<Note>(PATH, b))!.tags).toEqual([])
    expect((await readAll<Note>(PATH, { tag: 't1' })).map((r) => r.id)).toEqual([a])

    await setRecordTags(PATH, b, ['t1'], DEVICE)
    const retagged = await readOne<Note>(PATH, b)
    expect(retagged!.tags).toEqual(['t1'])
    expect(retagged!.rev).toBe(2)
    expect(await readAll<Note>(PATH, { tag: 't1' })).toHaveLength(2)

    // The same set again is not an edit.
    await setRecordTags(PATH, b, ['t1', 't1'], DEVICE)
    expect((await readOne<Note>(PATH, b))!.rev).toBe(2)
  })

  it('filters, sorts and limits', async () => {
    await createRecord<Note>(PATH, { title: 'c', pinned: true }, DEVICE)
    await createRecord<Note>(PATH, { title: 'a', pinned: false }, DEVICE)
    await createRecord<Note>(PATH, { title: 'b', pinned: true }, DEVICE)

    const pinned = await readAll<Note>(PATH, {
      where: { pinned: true },
      sort: { field: 'title', dir: 'asc' },
    })
    expect(pinned.map((r) => r.data.title)).toEqual(['b', 'c'])

    const one = await readAll<Note>(PATH, { sort: { field: 'title', dir: 'desc' }, limit: 1 })
    expect(one[0].data.title).toBe('c')
  })

  it('supports range filters', async () => {
    await createRecord<Note>(PATH, { title: 'a', pinned: false }, DEVICE)
    await createRecord<Note>(PATH, { title: 'm', pinned: false }, DEVICE)
    await createRecord<Note>(PATH, { title: 'z', pinned: false }, DEVICE)

    const middle = await readAll<Note>(PATH, { where: { title: { gte: 'b', lte: 'n' } } })
    expect(middle.map((r) => r.data.title)).toEqual(['m'])
  })

  it('migrates an old record on read, with no migration window', async () => {
    const stale: Envelope<{ title: string }> = {
      id: uuidv7(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deviceId: 'an-old-device',
      rev: 1,
      schemaVersion: 1,
      data: { title: 'written by an older build' },
    }
    await table<{ title: string }>(PATH).put(stale)

    const record = await readOne<Note>(PATH, stale.id)
    expect(record!.schemaVersion).toBe(2)
    expect(record!.data.pinned).toBe(false)
  })
})
