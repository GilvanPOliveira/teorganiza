import { describe, expect, it } from 'vitest'
import { createRecord, readAll } from '@core/db/repository'
import { registerModules } from '@core/registry/registry'
import { runMigrations } from './migrations'
import { modules } from './modules'

describe('migrations', () => {
  it('moves films and series from the old list to the shelf, once', async () => {
    registerModules(modules)
    const listId = await createRecord('lists/lists', { name: 'Filmes e Séries', kind: 'media', archived: false, due: null }, 'dev')
    await createRecord('lists/items', { listId, title: 'Duna', status: 'done', done: true, due: null, priority: 'normal' }, 'dev')
    await createRecord('lists/items', { listId, title: 'Severance', status: 'todo', done: false, due: null, priority: 'normal' }, 'dev')
    await createRecord('lists/items', { listId: null, title: 'Comprar pão', status: 'todo', done: false, due: null, priority: 'normal' }, 'dev')

    await runMigrations()
    await runMigrations()

    const shelf = await readAll<{ title: string; status: string }>('reading/media')
    expect(shelf.map((m) => [m.data.title, m.data.status]).sort()).toEqual([
      ['Duna', 'done'],
      ['Severance', 'want'],
    ])
    expect((await readAll<{ title: string }>('lists/items')).map((i) => i.data.title)).toEqual(['Comprar pão'])
  })

  it('moves saved links from the shelf to Arquivos', async () => {
    await createRecord('reading/links', { url: 'https://a.com', title: 'A', note: '', read: true }, 'dev')
    await runMigrations()
    await runMigrations()
    const moved = await readAll<{ url: string; read: boolean; attachedTo: unknown }>('core/links')
    expect(moved.map((l) => [l.data.url, l.data.read, l.data.attachedTo])).toEqual([['https://a.com', true, null]])
    expect(await readAll('reading/links')).toEqual([])
  })
})
