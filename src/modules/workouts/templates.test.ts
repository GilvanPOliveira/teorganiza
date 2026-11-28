import { describe, expect, it } from 'vitest'
import { CATALOG } from './catalog'
import { rankTemplates, TEMPLATES, templateFit } from './templates'

const none = { days: null, level: null, place: null, goal: null }

describe('ready plans', () => {
  it('only uses exercises from the catalog', () => {
    const ids = new Set(CATALOG.map((e) => e.id))
    for (const template of TEMPLATES)
      for (const routine of template.routines) for (const item of routine.items) expect(ids.has(item.exerciseId!), `${template.id}: ${item.exerciseId}`).toBe(true)
  })

  it('keeps the usual order when nothing is known', () => {
    expect(rankTemplates(TEMPLATES, none).map((r) => r.template.id)).toEqual(TEMPLATES.map((t) => t.id))
  })

  it('puts the home plan first for someone training at home', () => {
    const ranked = rankTemplates(TEMPLATES, { ...none, place: 'home', days: 3, level: 'beginner' })
    expect(ranked[0].template.id).toBe('casa')
    expect(ranked[0].fit.reasons).toEqual(['place', 'days', 'level'])
  })

  it('favours a two-day beginner plan for two free days', () => {
    const ranked = rankTemplates(TEMPLATES, { ...none, place: 'gym', days: 2, level: 'beginner', goal: 'health' })
    expect(ranked[0].template.id).toBe('iniciante-2x')
  })

  it('penalises a plan that needs more days than there are', () => {
    const abcd = TEMPLATES.find((t) => t.id === 'abcd')!
    expect(templateFit(abcd, { ...none, days: 2 }).score).toBeLessThan(0)
    expect(templateFit(abcd, { ...none, days: 4 }).reasons).toContain('days')
  })
})
