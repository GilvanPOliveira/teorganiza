import { describe, expect, it } from 'vitest'
import { CATALOG } from './catalog'
import { buildGuidance, flagsFor, NO_GUIDANCE, RULES, substituteFor } from './guidance'
import { readinessNotes } from './readiness'
import { adaptTemplate, rankTemplates, TEMPLATES, templateFit } from './templates'

const facts = { age: 35, bmi: 24 }
const knee = buildGuidance(['knee'], facts, {})
const none = { days: null, level: null, place: null, goal: null }
const byId = (id: string) => CATALOG.find((e) => e.id === id)!

describe('training guidance', () => {
  it('names only exercises that exist in the catalog', () => {
    const ids = new Set(CATALOG.map((e) => e.id))
    for (const [restriction, rule] of Object.entries(RULES))
      for (const id of [...rule.avoid, ...rule.caution]) expect(ids.has(id), `${restriction}: ${id}`).toBe(true)
  })

  it('derives restrictions from BMI and an exam', () => {
    const g = buildGuidance([], { age: 40, bmi: 31 }, { bloodPressure: { key: 'bloodPressure', value: 150, value2: 95, date: '2026-10-12' } })
    expect(g.restrictions.get('noImpact')).toBe('bmi')
    expect(g.restrictions.get('hypertension')).toBe('pressure')
    expect(buildGuidance([], { age: 40, bmi: 24 }, { bloodPressure: { key: 'bloodPressure', value: 120, value2: 80, date: '2026-10-12' } }).restrictions.size).toBe(0)
  })

  it('a marked restriction wins over a derived one', () => {
    expect(buildGuidance(['noImpact'], { age: 40, bmi: 33 }, {}).restrictions.get('noImpact')).toBe('profile')
  })

  it('flags avoid before caution', () => {
    expect(flagsFor('afundo', knee)).toEqual([{ restriction: 'knee', level: 'avoid' }])
    expect(flagsFor('leg-press', knee)).toEqual([{ restriction: 'knee', level: 'caution' }])
    expect(flagsFor('supino-reto-barra', knee)).toEqual([])
    expect(flagsFor('afundo', NO_GUIDANCE)).toEqual([])
  })

  it('swaps for a safe exercise of the same muscle and kind', () => {
    const sub = substituteFor(byId('afundo'), CATALOG, knee, 'gym')!
    expect(sub.muscle).toBe('quadriceps')
    expect(flagsFor(sub.id, knee).some((f) => f.level === 'avoid')).toBe(false)
    const home = substituteFor(byId('burpee'), CATALOG, buildGuidance(['noImpact'], facts, {}), 'home')!
    expect(['peso-corporal', 'nenhum', 'halteres', 'elastico', 'kettlebell']).toContain(home.equipment)
  })

  it('loads a plan without the exercises to avoid', () => {
    const ppl = TEMPLATES.find((t) => t.id === 'ppl')!
    const back = buildGuidance(['back'], facts, {})
    const adapted = adaptTemplate(ppl, back, CATALOG)
    const ids = adapted.routines.flatMap((r) => r.items.map((i) => i.exerciseId))
    expect(ids).not.toContain('levantamento-terra')
    expect(adapted.swaps.map((s) => s.from)).toContain('levantamento-terra')
    for (const id of ids) expect(flagsFor(id, back).some((f) => f.level === 'avoid')).toBe(false)
    // No exercise twice in a routine after swapping.
    for (const r of adapted.routines) expect(new Set(r.items.map((i) => i.exerciseId)).size).toBe(r.items.length)
  })

  it('eases heavy sets for high blood pressure', () => {
    const fivebyfive = TEMPLATES.find((t) => t.id === '5x5')!
    const g = buildGuidance(['hypertension'], facts, {})
    const adapted = adaptTemplate(fivebyfive, g, CATALOG)
    expect(adapted.lightened).toBeGreaterThan(0)
    expect(adapted.routines.flatMap((r) => r.items.flatMap((i) => i.sets)).every((s) => s.reps === null || s.reps >= 8)).toBe(true)
    expect(templateFit(fivebyfive, none, g).heavy).toBeGreaterThan(0)
  })

  it('ranks plans that need many swaps lower', () => {
    const back = buildGuidance(['back'], facts, {})
    const plain = rankTemplates(TEMPLATES, none).map((r) => r.template.id)
    const ranked = rankTemplates(TEMPLATES, none, back).map((r) => r.template.id)
    expect(ranked.indexOf('5x5')).toBeGreaterThan(plain.indexOf('5x5'))
  })
})

describe('readiness', () => {
  const day = (sleep: number, energy: number) => ({
    sleep: { key: 'sleep' as const, value: sleep, date: '2026-11-27' },
    energy: { key: 'energy' as const, value: energy, date: '2026-11-27' },
  })
  const target = { kcal: 2800, protein: 155 }

  it('suggests a lighter workout after a short night or with low energy', () => {
    expect(readinessNotes(day(5, 4), target, null)[0].kind).toBe('light')
    expect(readinessNotes(day(8, 2), target, null)[0].kind).toBe('light')
    expect(readinessNotes(day(8, 4), target, null)[0].kind).toBe('ready')
    expect(readinessNotes({}, target, null)).toEqual([])
  })

  it('compares the week of eating with the goal', () => {
    const intake = (kcal: number, protein: number) => ({ intake: { key: 'intake' as const, value: kcal, value2: protein, date: '2026-11-26', days: 5 } })
    expect(readinessNotes(intake(2200, 160), target, 'gain').map((n) => n.kind)).toEqual(['underfed'])
    expect(readinessNotes(intake(3200, 160), target, 'lose').map((n) => n.kind)).toEqual(['overfed'])
    expect(readinessNotes(intake(2800, 100), target, 'gain').map((n) => n.kind)).toEqual(['lowProtein'])
    expect(readinessNotes(intake(2800, 160), target, 'gain')).toEqual([])
  })
})
