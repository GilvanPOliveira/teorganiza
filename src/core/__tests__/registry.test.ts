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

  it('refuses an unknown collection instead of failing silently', () => {
    registerModules([moduleFixture()])
    expect(() => getCollection('demo/nope')).toThrow(/Unknown collection/)
  })
})
