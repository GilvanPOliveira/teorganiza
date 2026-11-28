import { describe, expect, it } from 'vitest'
import { checkupsFor } from './checkups'

const today = '2026-11-27'
const ids = (list: ReturnType<typeof checkupsFor>) => list.map((p) => p.checkup.id).sort()

describe('routine check-ups', () => {
  it('needs an age', () => {
    expect(checkupsFor({ age: null, sex: 'f', bmi: null }, [], today)).toEqual([])
  })

  it('picks by age and sex', () => {
    const woman = ids(checkupsFor({ age: 52, sex: 'f', bmi: 22 }, [], today))
    expect(woman).toContain('mamografia')
    expect(woman).toContain('papanicolau')
    expect(woman).not.toContain('prostata')
    const man = ids(checkupsFor({ age: 52, sex: 'm', bmi: 22 }, [], today))
    expect(man).toContain('prostata')
    expect(man).not.toContain('mamografia')
    expect(ids(checkupsFor({ age: 25, sex: 'm', bmi: 22 }, [], today))).not.toContain('glicemia')
  })

  it('checks blood sugar early and yearly with a high BMI', () => {
    const plan = checkupsFor({ age: 25, sex: 'm', bmi: 27 }, [], today).find((p) => p.checkup.id === 'glicemia')
    expect(plan?.every).toBe(12)
  })

  it('finds the last one among registered exams, accents and case aside', () => {
    const plans = checkupsFor({ age: 36, sex: 'm', bmi: 22 }, [{ name: 'HEMOGRAMA completo', date: '2026-03-01' }, { name: 'Consulta clínica', date: '2025-01-10' }], today)
    const hemo = plans.find((p) => p.checkup.id === 'hemograma')!
    expect(hemo).toMatchObject({ last: '2026-03-01', next: '2027-03-01', status: 'ok' })
    expect(plans.find((p) => p.checkup.id === 'clinico')!.status).toBe('due')
    expect(plans.find((p) => p.checkup.id === 'dentista')!.last).toBeNull()
  })

  it('counts a value written on any exam as that check-up done', () => {
    const plans = checkupsFor({ age: 40, sex: 'm', bmi: 22 }, [{ name: 'Consulta', date: '2026-11-01', values: { systolic: 130, diastolic: 85, glucose: 95 } }], today)
    expect(plans.find((p) => p.checkup.id === 'pressao')!.last).toBe('2026-11-01')
    expect(plans.find((p) => p.checkup.id === 'glicemia')!.last).toBe('2026-11-01')
    expect(plans.find((p) => p.checkup.id === 'colesterol')!.last).toBeNull()
  })

  it('lists what is due first', () => {
    const plans = checkupsFor({ age: 36, sex: 'm', bmi: 22 }, [{ name: 'Hemograma', date: '2026-10-01' }], today)
    expect(plans.at(-1)!.checkup.id).toBe('hemograma')
  })

  it('never lists a check-up for the other sex, nor any without a sex', () => {
    const man = ids(checkupsFor({ age: 40, sex: 'm', bmi: 22, flags: ['pregnancy'] }, [], today))
    expect(man).not.toContain('papanicolau')
    expect(man).not.toContain('prenatal')
    expect(checkupsFor({ age: 40, sex: null, bmi: 22 }, [], today)).toEqual([])
  })

  it('follows Meus dados and the readings, and says why', () => {
    const plans = checkupsFor({ age: 34, sex: 'm', bmi: 27, flags: ['knee', 'hypertension'], glucose: 110, ldl: 170, trainingDays: 3 }, [], today)
    const by = (id: string) => plans.find((p) => p.checkup.id === id)
    expect(by('pressao')).toMatchObject({ every: 1, reasons: ['hypertension'] })
    expect(by('cardio')?.reasons).toEqual(['hypertension'])
    expect(by('glicemia')).toMatchObject({ every: 6, reasons: ['glucose'] })
    expect(by('hba1c')).toMatchObject({ every: 6, reasons: ['glucose'] })
    expect(by('colesterol')).toMatchObject({ every: 12, reasons: ['ldl'] })
    expect(by('ortopedia')?.reasons).toEqual(['joints'])
    expect(by('atividade')).toBeUndefined()
    expect(ids(checkupsFor({ age: 40, sex: 'f', bmi: 22, flags: ['pregnancy'], trainingDays: 3 }, [], today))).toEqual(expect.arrayContaining(['prenatal', 'atividade', 'papanicolau']))
  })

  it('keeps the plain list when nothing calls for more', () => {
    const plain = ids(checkupsFor({ age: 30, sex: 'm', bmi: 22 }, [], today))
    expect(plain).toEqual(['clinico', 'colesterol', 'dentista', 'hemograma', 'oftalmo', 'pressao'].sort())
  })
})
