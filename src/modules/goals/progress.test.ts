import { describe, expect, it } from 'vitest'
import type { CollectedProgress } from '@core/api'
import { goalProgress } from './progress'

const goal = { title: 'Lançar site', target: 10, current: 4, unit: 'x', due: null, source: null }
const project = { id: 'p', key: 'lists:p', moduleId: 'lists', label: 'Site', done: 3, total: 4, path: '', href: '/lists' } as CollectedProgress

describe('goal progress', () => {
  it('uses the typed number for a manual goal', () => {
    expect(goalProgress(goal)).toEqual({ value: 4, max: 10, reached: false })
  })
  it('follows the project when linked, and is reached when every task is done', () => {
    expect(goalProgress({ ...goal, source: 'lists:p' }, project)).toEqual({ value: 3, max: 4, reached: false })
    expect(goalProgress({ ...goal, source: 'lists:p' }, { ...project, done: 4 }).reached).toBe(true)
  })
  it('is not reached when the linked project is gone or empty', () => {
    expect(goalProgress({ ...goal, source: 'lists:p' }).reached).toBe(false)
    expect(goalProgress({ ...goal, source: 'lists:p' }, { ...project, done: 0, total: 0 }).reached).toBe(false)
  })
})
