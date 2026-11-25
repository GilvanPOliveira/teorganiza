import { describe, expect, it } from 'vitest'
import type { Envelope } from '@core/api/types'
import {
  applyResolutions,
  createMerge,
  mergePartition,
  resolveRecord,
  type MergeContext,
} from '@core/sync/merge'

interface Item {
  title: string
  amount: number
}

type Rec = Envelope<unknown>

const ID = '0193a000-0000-7000-8000-000000000001'
const OTHER = '0193a000-0000-7000-8000-000000000002'

function rec(overrides: Partial<Envelope<Item>> & { data?: Item } = {}): Rec {
  return {
    id: ID,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    deletedAt: null,
    deviceId: 'pc',
    rev: 0,
    schemaVersion: 1,
    data: { title: 'Mercado', amount: 24000 },
    ...overrides,
  }
}

function edited(from: Rec, data: Item, deviceId: string): Rec {
  return { ...from, data, deviceId, rev: from.rev + 1, updatedAt: '2026-11-02T10:00:00.000Z' }
}

function deleted(from: Rec, deviceId: string): Rec {
  const at = '2026-11-03T10:00:00.000Z'
  return { ...from, deletedAt: at, updatedAt: at, deviceId, rev: from.rev + 1 }
}

const context: MergeContext = {
  collectionPath: 'finance/transactions',
  describe: (r) => `${(r.data as Item).title} · ${(r.data as Item).amount}`,
}

const merge = (base: Rec[], local: Rec[], remote: Rec[]) =>
  mergePartition(base, local, remote, context)

describe('resolution table, row by row', () => {
  const base = rec()

  it('local same as base, remote changed → take remote', () => {
    const remote = edited(base, { title: 'Mercado', amount: 25000 }, 'phone')
    const result = merge([base], [base], [remote])
    expect(result.conflicts).toEqual([])
    expect(result.merged).toEqual([remote])
  })

  it('local changed, remote same as base → keep local', () => {
    const local = edited(base, { title: 'Feira', amount: 24000 }, 'pc')
    const result = merge([base], [local], [base])
    expect(result.conflicts).toEqual([])
    expect(result.merged).toEqual([local])
  })

  it('both changed to the same payload → take, no conflict', () => {
    const data = { title: 'Mercado', amount: 30000 }
    const local = edited(base, data, 'pc')
    const remote = { ...edited(base, data, 'phone'), updatedAt: '2026-11-02T11:00:00.000Z' }
    const result = merge([base], [local], [remote])
    expect(result.conflicts).toEqual([])
    expect(result.merged).toEqual([remote])
  })

  it('both changed to different payloads → CONFLICT', () => {
    const local = edited(base, { title: 'Mercado', amount: 30000 }, 'pc')
    const remote = edited(base, { title: 'Mercado', amount: 31000 }, 'phone')
    const result = merge([base], [local], [remote])
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]).toMatchObject({ id: ID, local, remote })
  })

  it('new locally, absent remotely → keep local', () => {
    const local = rec({ id: OTHER, rev: 1 })
    const result = merge([], [local], [])
    expect(result.merged).toEqual([local])
    expect(result.conflicts).toEqual([])
  })

  it('absent locally, new remotely → take remote', () => {
    const remote = rec({ id: OTHER, deviceId: 'phone' })
    const result = merge([], [], [remote])
    expect(result.merged).toEqual([remote])
    expect(result.conflicts).toEqual([])
  })

  it('deleted locally, changed remotely → CONFLICT', () => {
    const local = deleted(base, 'pc')
    const remote = edited(base, { title: 'Mercado', amount: 26000 }, 'phone')
    const result = merge([base], [local], [remote])
    expect(result.conflicts.map((c) => c.id)).toEqual([ID])
  })

  it('changed locally, deleted remotely → CONFLICT', () => {
    const local = edited(base, { title: 'Mercado', amount: 26000 }, 'pc')
    const remote = deleted(base, 'phone')
    const result = merge([base], [local], [remote])
    expect(result.conflicts.map((c) => c.id)).toEqual([ID])
  })

  it('deleted on both sides → take, no conflict', () => {
    const local = deleted(base, 'pc')
    const remote = { ...deleted(base, 'phone'), deletedAt: '2026-11-04T08:00:00.000Z' }
    const result = merge([base], [local], [remote])
    expect(result.conflicts).toEqual([])
    expect(result.merged).toEqual([remote])
  })
})

describe('deletes travel, they do not resurrect', () => {
  it('deleted locally, untouched remotely → the tombstone wins', () => {
    const base = rec()
    const local = deleted(base, 'pc')
    expect(merge([base], [local], [base]).merged).toEqual([local])
  })

  it('deleted remotely, untouched locally → the tombstone arrives', () => {
    const base = rec()
    const remote = deleted(base, 'phone')
    expect(merge([base], [base], [remote]).merged).toEqual([remote])
  })

  it('absent remotely but known to the base → kept, never dropped', () => {
    // Absence is "not seen", not "removed": deletes are tombstones.
    const base = rec()
    expect(merge([base], [base], []).merged).toEqual([base])
  })
})

describe('what counts as a change', () => {
  const base = rec()

  it('sync metadata alone is not a change', () => {
    const touched = { ...base, rev: 3, updatedAt: '2026-11-09T00:00:00.000Z', deviceId: 'pc' }
    const remote = edited(base, { title: 'Mercado', amount: 1 }, 'phone')
    expect(resolveRecord(base, touched, remote)).toEqual({ kind: 'take-remote' })
  })

  it('an edit that was undone is not a change', () => {
    const undone = { ...base, rev: 2, updatedAt: '2026-11-09T00:00:00.000Z' }
    const remote = edited(base, { title: 'Outro', amount: 1 }, 'phone')
    expect(resolveRecord(base, undone, remote)).toEqual({ kind: 'take-remote' })
  })

  it('key order inside data is not a change', () => {
    const reordered = { ...base, data: { amount: 24000, title: 'Mercado' } }
    const remote = edited(base, { title: 'Outro', amount: 1 }, 'phone')
    expect(resolveRecord(base, reordered, remote)).toEqual({ kind: 'take-remote' })
  })

  it('fields outside data and the metadata — such as tags — are payload', () => {
    const local = { ...base, tags: ['reforma'] } as Rec
    const remote = { ...base, tags: ['viagem'] } as Rec
    expect(resolveRecord(base, local, remote)).toEqual({ kind: 'conflict' })
  })
})

describe('no base (first sync choosing to merge)', () => {
  it('same id, same payload → take, no conflict', () => {
    const local = rec({ deviceId: 'pc', rev: 4 })
    const remote = rec({ deviceId: 'phone' })
    const result = merge([], [local], [remote])
    expect(result.conflicts).toEqual([])
    expect(result.merged).toEqual([remote])
  })

  it('same id, different payload → conflict, never a guess', () => {
    const local = rec({ data: { title: 'A', amount: 1 } })
    const remote = rec({ data: { title: 'B', amount: 2 } })
    expect(merge([], [local], [remote]).conflicts).toHaveLength(1)
  })
})

describe('the merge result', () => {
  it('keeps the local version in merged while a conflict is open', () => {
    const base = rec()
    const local = edited(base, { title: 'Mercado', amount: 1 }, 'pc')
    const remote = edited(base, { title: 'Mercado', amount: 2 }, 'phone')
    expect(merge([base], [local], [remote]).merged).toEqual([local])
  })

  it('labels each side of a conflict with the collection describe', () => {
    const base = rec()
    const local = edited(base, { title: 'Mercado', amount: 1 }, 'pc')
    const remote = edited(base, { title: 'Feira', amount: 2 }, 'phone')
    const [conflict] = merge([base], [local], [remote]).conflicts
    expect(conflict).toMatchObject({
      collectionPath: 'finance/transactions',
      localLabel: 'Mercado · 1',
      remoteLabel: 'Feira · 2',
    })
  })

  it('falls back to the id when describe cannot read a record', () => {
    const base = rec()
    const local = edited(base, { title: 'Mercado', amount: 1 }, 'pc')
    const remote = { ...base, schemaVersion: 9, data: null, updatedAt: 'x' }
    const [conflict] = mergePartition([base], [local], [remote], context).conflicts
    expect(conflict.remoteLabel).toBe(ID)
  })

  it('returns records sorted by id and covers every id on either side', () => {
    const a = rec({ id: OTHER })
    const b = rec({ id: ID })
    const result = merge([], [a], [b])
    expect(result.merged.map((r) => r.id)).toEqual([ID, OTHER])
  })

  it('createMerge binds a collection to the MergeFn contract', () => {
    const fn = createMerge(context)
    const remote = rec({ id: OTHER })
    expect(fn([], [], [remote]).merged).toEqual([remote])
  })
})

describe('applyResolutions', () => {
  const base = rec()
  const local = edited(base, { title: 'Mercado', amount: 1 }, 'pc')
  const remote = edited(base, { title: 'Mercado', amount: 2 }, 'phone')
  const untouched = rec({ id: OTHER })

  it('applies the chosen side per conflict', () => {
    const result = merge([base, untouched], [local, untouched], [remote, untouched])
    expect(applyResolutions(result, new Map([[ID, 'take-remote']]))).toEqual([remote, untouched])
    expect(applyResolutions(result, new Map([[ID, 'keep-local']]))).toEqual([local, untouched])
  })

  it('refuses while any conflict is undecided', () => {
    const result = merge([base], [local], [remote])
    expect(() => applyResolutions(result, new Map())).toThrow(/undecided/)
  })
})

describe('tags in the merge', () => {
  it('treats a record without tags like one with an empty list', () => {
    const base = rec()
    const upgraded = { ...rec({ deviceId: 'phone' }), tags: [] }
    expect(resolveRecord(base, upgraded, base)).toEqual({ kind: 'take-remote' })
  })

  it('ignores tag order and duplicates', () => {
    const base = { ...rec(), tags: ['a', 'b'] }
    const local = { ...rec({ deviceId: 'phone' }), tags: ['b', 'a', 'a'] }
    expect(resolveRecord(base, local, base)).toEqual({ kind: 'take-remote' })
  })

  it('counts a tag change as a change, and a tag change on both sides as a conflict', () => {
    const base = { ...rec(), tags: ['a'] }
    const local = { ...base, tags: ['a', 'b'], deviceId: 'phone', rev: 1 }
    expect(resolveRecord(base, local, base)).toEqual({ kind: 'keep-local' })

    const remote = { ...base, tags: ['c'], deviceId: 'pc' }
    expect(resolveRecord(base, local, remote)).toEqual({ kind: 'conflict' })
  })
})
