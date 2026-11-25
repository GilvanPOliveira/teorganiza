import { describe, expect, it } from 'vitest'
import type { Module } from '@core/api/types'
import {
  assignShortcuts,
  enabledModules,
  filterPalette,
  greetingKey,
  HOME_SHORTCUT,
  normalize,
} from '@core/shell/navigation'
import { parseDate, toLocalISODate } from '@core/api/dates'
import { DEFAULT_PREFERENCES, resolveTheme, withDefaults } from '@core/runtime/preferences'

describe('shortcuts', () => {
  it('gives each target the first free letter of its label, without accents', () => {
    const letters = assignShortcuts([
      { id: 'finance', label: 'Finanças' },
      { id: 'notes', label: 'Notas' },
      { id: 'settings', label: 'Configurações' },
    ])
    expect(letters.get('finance')).toBe('f')
    expect(letters.get('notes')).toBe('n')
    expect(letters.get('settings')).toBe('c')
  })

  it('never hands out the home letter', () => {
    const letters = assignShortcuts([{ id: 'goals', label: 'Ideias' }])
    expect(letters.get('goals')).not.toBe(HOME_SHORTCUT)
    expect(letters.get('goals')).toBe('d')
  })

  it('lets a declared letter win over a label letter, regardless of order', () => {
    const letters = assignShortcuts([
      { id: 'tasks', label: 'Tarefas' },
      { id: 'workouts', label: 'Academia', preferred: 't' },
    ])
    expect(letters.get('workouts')).toBe('t')
    expect(letters.get('tasks')).toBe('a')
  })

  it('skips a letter already taken and leaves a target without one when none is free', () => {
    const letters = assignShortcuts([
      { id: 'a', label: 'ab' },
      { id: 'b', label: 'ab' },
      { id: 'c', label: 'ab' },
    ])
    expect(letters.get('a')).toBe('a')
    expect(letters.get('b')).toBe('b')
    expect(letters.has('c')).toBe(false)
  })
})

describe('command palette filter', () => {
  const items = [
    { id: '1', group: 'goto' as const, label: 'Finanças' },
    { id: '2', group: 'actions' as const, label: 'Novo lançamento', hint: 'Finanças', keywords: ['gasto'] },
    { id: '3', group: 'app' as const, label: 'Usar tema claro', keywords: ['theme'] },
  ]

  it('shows everything for an empty query', () => {
    expect(filterPalette(items, '  ')).toHaveLength(3)
  })

  it('ignores accents and case, and matches hints and keywords', () => {
    expect(filterPalette(items, 'FINANCAS').map((i) => i.id)).toEqual(['1', '2'])
    expect(filterPalette(items, 'gasto').map((i) => i.id)).toEqual(['2'])
    expect(filterPalette(items, 'theme').map((i) => i.id)).toEqual(['3'])
  })

  it('requires every word', () => {
    expect(filterPalette(items, 'novo financas').map((i) => i.id)).toEqual(['2'])
    expect(filterPalette(items, 'novo tema')).toHaveLength(0)
  })

  it('normalizes labels', () => {
    expect(normalize('Lançamentos É')).toBe('lancamentos e')
  })
})

describe('home and preferences', () => {
  it('greets by the hour', () => {
    expect(greetingKey(5)).toBe('home.morning')
    expect(greetingKey(11)).toBe('home.morning')
    expect(greetingKey(12)).toBe('home.afternoon')
    expect(greetingKey(17)).toBe('home.afternoon')
    expect(greetingKey(18)).toBe('home.evening')
    expect(greetingKey(2)).toBe('home.evening')
  })

  it('fills fields an older preferences record does not carry', () => {
    const old = { theme: 'light' as const, locale: 'en', syncPolicy: 'manual' as const }
    expect(withDefaults(old)).toEqual({ ...DEFAULT_PREFERENCES, ...old })
    expect(withDefaults(undefined)).toEqual(DEFAULT_PREFERENCES)
  })

  it('starts dark, and follows the system only when asked', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('keeps registration order and drops only the disabled modules', () => {
    const mod = (id: string) => ({ id }) as Module
    const result = enabledModules([mod('finance'), mod('lists'), mod('notes')], ['lists'])
    expect(result.map((m) => m.id)).toEqual(['finance', 'notes'])
  })
})

describe('calendar dates', () => {
  it('uses the local day, not the UTC one', () => {
    // 23:30 local on Nov 25 is already Nov 26 in UTC for anyone west of Greenwich.
    expect(toLocalISODate(new Date(2026, 10, 25, 23, 30))).toBe('2026-11-25')
    expect(toLocalISODate(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05')
  })

  it('reads a date-only string as local midnight of that same day', () => {
    const date = parseDate('2026-11-25')
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 25, 0])
    expect(parseDate('2026-11-25T10:00:00.000Z').toISOString()).toBe('2026-11-25T10:00:00.000Z')
  })
})
