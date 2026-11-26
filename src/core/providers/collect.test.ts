import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Module } from '@core/api/types'
import { createRecord } from '@core/db/repository'
import { registerModules } from '@core/registry/registry'
import { collectDated, collectProgress } from './collect'

const task = z.object({ title: z.string(), due: z.string(), done: z.boolean() })

const tasks: Module = {
  id: 'tasks',
  name: 'Tarefas',
  apiVersion: 1,
  version: '1.0.0',
  collections: [{ name: 'items', schema: task, schemaVersion: 1, describe: (r) => String((r.data as { title: string }).title) }],
  routes: [{ path: '', element: () => null }],
  provides: {
    dated: async (read) =>
      (await read<z.infer<typeof task>>('items')).map((r) => ({
        id: r.id,
        date: r.data.due,
        title: r.data.title,
        kind: 'Tarefa',
        path: '',
        done: r.data.done,
      })),
    progress: async (read) => {
      const rows = await read<z.infer<typeof task>>('items')
      return [{ id: 'all', label: 'Tudo', done: rows.filter((r) => r.data.done).length, total: rows.length, path: '' }]
    },
  },
}

const broken: Module = {
  id: 'broken',
  name: 'Quebrado',
  apiVersion: 1,
  version: '1.0.0',
  collections: [],
  routes: [{ path: '', element: () => null }],
  provides: {
    dated: async () => {
      throw new Error('boom')
    },
  },
}

describe('providers', () => {
  it('collects dated entries in the range, sorted, with absolute links, and skips a failing module', async () => {
    registerModules([tasks, broken])
    await createRecord('tasks/items', { title: 'depois', due: '2026-12-10', done: false }, 'dev')
    await createRecord('tasks/items', { title: 'antes', due: '2026-12-02', done: true }, 'dev')
    await createRecord('tasks/items', { title: 'fora', due: '2027-01-05', done: false }, 'dev')

    const entries = await collectDated({ from: '2026-12-01', to: '2026-12-31' })
    expect(entries.map((e) => e.title)).toEqual(['antes', 'depois'])
    expect(entries[0]).toMatchObject({ moduleId: 'tasks', href: '/tasks', kind: 'Tarefa' })
    expect(await collectDated({ from: '2026-12-01', to: '2026-12-31' }, { exclude: ['tasks'] })).toEqual([])
  })

  it('collects progress sources', async () => {
    const [entry] = await collectProgress()
    expect(entry).toMatchObject({ moduleId: 'tasks', key: 'tasks:all', total: 3, done: 1 })
  })
})
