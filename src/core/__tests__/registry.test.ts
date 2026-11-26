import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Module } from '@core/api/types'
import { getCollection, registerModules } from '@core/registry/registry'

function moduleFixture(overrides: Partial<Module> = {}): Module {
  return {
    id: 'demo',
    name: 'Demo',
    apiVersion: 1,
    version: '1.0.0',
    collections: [
      {
        name: 'things',
        schema: z.object({ label: z.string() }),
        schemaVersion: 1,
        describe: (record) => String((record.data as { label: string }).label),
      },
    ],
    routes: [{ path: '', element: () => null }],
    ...overrides,
  }
}

describe('registry', () => {
  it('registers a module and exposes its collections by global path', () => {
    registerModules([moduleFixture()])
    expect(getCollection('demo/things').moduleId).toBe('demo')
  })

  it('always provides the core collections', () => {
    registerModules([])
    expect(getCollection('core/dashboard').moduleId).toBe('core')
    expect(getCollection('core/preferences').moduleId).toBe('core')
  })

  it('refuses a module built against a different contract version', () => {
    const wrong = moduleFixture({ apiVersion: 2 as unknown as 1 })
    expect(() => registerModules([wrong])).toThrow(/module API v2/)
  })

  it('refuses two modules with the same id', () => {
    expect(() => registerModules([moduleFixture(), moduleFixture()])).toThrow(/Duplicate module id/)
  })

  it('reserves the core id', () => {
    expect(() => registerModules([moduleFixture({ id: 'core' })])).toThrow(/Duplicate module id/)
  })

  it('refuses an absolute route path, because the shell owns the prefix', () => {
    const absolute = moduleFixture({ routes: [{ path: '/demo', element: () => null }] })
    expect(() => registerModules([absolute])).toThrow(/must be relative/)
  })

  it('refuses a command that points to a route the module does not have', () => {
    const broken = moduleFixture({ commands: [{ id: 'new', label: 'New', path: 'nope' }] })
    expect(() => registerModules([broken])).toThrow(/not one of its routes/)
    const fine = moduleFixture({ commands: [{ id: 'new', label: 'New', path: '' }] })
    expect(() => registerModules([fine])).not.toThrow()
  })

  it('refuses a shortcut that is not a single letter', () => {
    expect(() => registerModules([moduleFixture({ shortcut: 'fi' })])).toThrow(/single lowercase letter/)
  })

  it('keeps the URLs of the shell out of module ids', () => {
    expect(() => registerModules([moduleFixture({ id: 'tags' })])).toThrow(/reserved for the shell/)
    expect(() => registerModules([moduleFixture({ id: 'settings' })])).toThrow(/reserved for the shell/)
  })

  it('provides the shared tags collection', () => {
    registerModules([])
    expect(getCollection('core/tags').moduleId).toBe('core')
  })

  it('refuses two areas with the same id in one module', () => {
    const area = { id: 'tasks', label: 'Tarefas' }
    const twice = moduleFixture({
      routes: [
        { path: '', element: () => null, area },
        { path: 'other', element: () => null, area },
      ],
    })
    expect(() => registerModules([twice])).toThrow(/Duplicate area/)
  })

  it('refuses a tab of an area that does not exist, or of another tab', () => {
    const host = moduleFixture({ id: 'host' })
    const tab = moduleFixture({ id: 'tab', within: 'host' })
    expect(() => registerModules([host, tab])).not.toThrow()
    expect(() => registerModules([moduleFixture({ within: 'nowhere' })])).toThrow(/not an area/)
    expect(() => registerModules([host, tab, moduleFixture({ id: 'deeper', within: 'tab' })])).toThrow(/itself a tab/)
  })

  it('refuses an unknown collection instead of failing silently', () => {
    registerModules([moduleFixture()])
    expect(() => getCollection('demo/nope')).toThrow(/Unknown collection/)
  })
})
