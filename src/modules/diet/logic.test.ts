import { describe, expect, it } from 'vitest'
import { byMoment, dietNotes, favourites, macroTargets, momentAt, pastDays, sum, ZERO } from './logic'
import { trainingSignal } from '../workouts/signals'
import type { Meal } from './schema'

const meal = (over: Partial<Meal> = {}): Meal => ({ date: '2026-11-27', name: 'Arroz e feijão', kcal: 500, protein: 20, carbs: 70, fat: 10, ...over })
const notes = (over: Partial<Parameters<typeof dietNotes>[0]> = {}) =>
  dietNotes({ signals: {}, flags: [], goal: null, facts: { waterGlasses: null }, totals: ZERO, targets: macroTargets(null, null), hour: 10, ...over }).map((n) => n.kind)

describe('macroTargets', () => {
  it('splits the calories left after protein into fat and carbohydrate', () => {
    expect(macroTargets(2400, 150)).toEqual({ kcal: 2400, protein: 150, carbs: 270, fat: 80 })
  })
  it('gives fat a smaller share when LDL is high', () => {
    expect(macroTargets(2400, 150, { ldl: { key: 'ldl', value: 160, date: '2026-11-01' } }).fat).toBe(67)
  })
  it('keeps carbohydrate at 130 g or more', () => {
    expect(macroTargets(1200, 200).carbs).toBe(130)
  })
  it('has nothing to split without calories and protein', () => {
    expect(macroTargets(null, 120)).toEqual({ kcal: null, protein: 120, carbs: null, fat: null })
  })
})

describe('meals of the day', () => {
  it('guesses the meal from the time', () => {
    expect(['07:30', '10:00', '12:30', '16:00', '19:45', '22:30'].map(momentAt)).toEqual(['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner', 'supper'])
  })
  it('groups in the day order, meals without a moment last', () => {
    const list = [meal({ moment: 'dinner' }), meal({ moment: null }), meal({ moment: 'breakfast', time: '08:00' }), meal({ moment: 'breakfast', time: '07:00', name: 'Café' })].map((data) => ({ data }))
    const groups = byMoment(list)
    expect(groups.map((g) => g.moment)).toEqual(['breakfast', 'dinner', null])
    expect(groups[0].meals[0].data.name).toBe('Café')
  })
  it('adds up the numbers', () => {
    expect(sum([meal(), meal({ kcal: 100, protein: 5, carbs: 0, fat: 1 })])).toEqual({ kcal: 600, protein: 25, carbs: 70, fat: 11 })
  })
})

describe('pastDays and favourites', () => {
  it('summarises the days before today, newest first', () => {
    const days = pastDays([meal(), meal({ date: '2026-11-25' }), meal({ date: '2026-11-26' }), meal({ date: '2026-11-26' })], '2026-11-27')
    expect(days.map((d) => [d.date, d.meals, d.kcal])).toEqual([
      ['2026-11-26', 2, 1000],
      ['2026-11-25', 1, 500],
    ])
  })
  it('lists what is eaten most, with the numbers it had last time', () => {
    const list = favourites([meal({ date: '2026-11-20', kcal: 450 }), meal({ name: 'arroz e feijão', kcal: 520 }), meal({ name: 'Iogurte', kcal: 120 })])
    expect(list[0]).toMatchObject({ name: 'arroz e feijão', kcal: 520, count: 2 })
    expect(list[1].name).toBe('Iogurte')
  })
})

describe('dietNotes', () => {
  it('reads training, pressure, glucose, cholesterol and conditions', () => {
    expect(notes({ signals: { training: { key: 'training', value: 2, date: '2026-11-27' } } })).toEqual(['training'])
    expect(notes({ signals: { bloodPressure: { key: 'bloodPressure', value: 150, value2: 95, date: '2026-11-27' } } })).toEqual(['sodium'])
    expect(notes({ flags: ['hypertension', 'pregnancy'] })).toEqual(['sodium', 'pregnancy'])
    expect(notes({ signals: { glucose: { key: 'glucose', value: 110, date: '2026-11-27' } } })).toEqual(['carbs'])
    expect(notes({ signals: { ldl: { key: 'ldl', value: 150, date: '2026-11-27' } } })).toEqual(['fat'])
  })
  it('says nothing when the data is fine', () => {
    expect(notes({ signals: { bloodPressure: { key: 'bloodPressure', value: 118, value2: 76, date: '2026-11-27' }, glucose: { key: 'glucose', value: 88, date: '2026-11-27' } } })).toEqual([])
  })
  it('points out water and protein only late in the day', () => {
    const late = { signals: { water: { key: 'water' as const, value: 2, date: '2026-11-27' } }, facts: { waterGlasses: 10 }, totals: { ...ZERO, kcal: 800, protein: 30 }, targets: macroTargets(2000, 120) }
    expect(notes({ ...late, hour: 11 })).toEqual([])
    expect(notes({ ...late, hour: 18 })).toEqual(['water', 'proteinLeft'])
  })
})

describe('trainingSignal', () => {
  const routine = (weekday: number | null) => ({ name: 'A', weekday, order: 0, items: [{}] }) as never
  it('knows a workout done today from one planned for today', () => {
    expect(trainingSignal([{ date: '2026-11-27', finishedAt: 'x' } as never], [], '2026-11-27')?.value).toBe(1)
    // 2026-11-27 is a Friday.
    expect(trainingSignal([], [routine(5)], '2026-11-27')?.value).toBe(2)
    expect(trainingSignal([], [routine(1)], '2026-11-27')).toBeNull()
  })
})
