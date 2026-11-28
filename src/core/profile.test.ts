import { describe, expect, it } from 'vitest'
import { ageOn, bmi, bmiBand, calorieTarget, dailyEnergy, EMPTY_PROFILE, latestWeight, profileFacts, proteinTarget, restingEnergy, waterTarget } from './profile'

describe('Meus dados: figures', () => {
  it('counts age in whole years, the birthday itself included', () => {
    expect(ageOn('1990-05-10', '2026-05-09')).toBe(35)
    expect(ageOn('1990-05-10', '2026-05-10')).toBe(36)
    expect(ageOn(null, '2026-05-10')).toBeNull()
  })

  it('takes the latest weighing by date, not by order', () => {
    expect(latestWeight([{ date: '2026-11-27', kg: 86.4 }, { date: '2026-08-01', kg: 89 }])?.kg).toBe(86.4)
    expect(latestWeight([])).toBeNull()
  })

  it('works out BMI and its WHO band', () => {
    expect(bmi(86.4, 178)).toBe(27.3)
    expect(bmiBand(27.3)).toBe('over')
    expect(bmiBand(22)).toBe('normal')
    expect(bmi(null, 178)).toBeNull()
  })

  it('follows Mifflin–St Jeor', () => {
    expect(restingEnergy({ sex: 'm', age: 36, kg: 86.4, cm: 178 })).toBe(1802)
    expect(restingEnergy({ sex: 'f', age: 30, kg: 60, cm: 165 })).toBe(1320)
    expect(restingEnergy({ sex: null, age: 30, kg: 60, cm: 165 })).toBeNull()
  })

  it('counts training days into an otherwise quiet routine', () => {
    expect(dailyEnergy(1800, 'sedentary', null)).toBe(2160)
    expect(dailyEnergy(1800, 'sedentary', 3)).toBe(2475)
    expect(dailyEnergy(1800, 'sedentary', 5)).toBe(2790)
    expect(dailyEnergy(1800, 'high', 5)).toBe(3105)
  })

  it('shifts calories by goal and rounds to 50', () => {
    expect(calorieTarget(2478, 'gain')).toBe(2800)
    expect(calorieTarget(2478, 'lose')).toBe(2000)
    expect(calorieTarget(2478, null)).toBe(2500)
  })

  it('sets protein and water from weight', () => {
    expect(proteinTarget(86.4, 'gain')).toBe(155)
    expect(proteinTarget(60, 'health')).toBe(70)
    expect(waterTarget(86.4)).toBe(3000)
    expect(waterTarget(null)).toBeNull()
  })

  it('leaves out what it cannot work out', () => {
    const facts = profileFacts(EMPTY_PROFILE, [], '2026-11-27')
    expect(facts).toMatchObject({ age: null, weight: null, bmi: null, kcal: null, protein: null, waterGlasses: null })
  })

  it('brings it all together', () => {
    const facts = profileFacts(
      { ...EMPTY_PROFILE, sex: 'm', birth: '1990-05-10', height: 178, goal: 'gain', days: 3, activity: 'light' },
      [{ date: '2026-08-01', kg: 89 }, { date: '2026-11-27', kg: 86.4 }],
      '2026-11-27',
    )
    expect(facts).toMatchObject({ age: 36, bmi: 27.3, resting: 1802, daily: 2478, kcal: 2800, protein: 155, waterMl: 3000, waterGlasses: 12 })
  })

  it('works out waist ratios and their risk', () => {
    const facts = profileFacts({ ...EMPTY_PROFILE, sex: 'm', height: 178 }, [], '2026-11-27', [
      { date: '2026-11-01', key: 'waist', value: 100 },
      { date: '2026-11-20', key: 'waist', value: 96 },
      { date: '2026-11-20', key: 'hip', value: 104 },
    ])
    expect(facts).toMatchObject({ waist: 96, waistRisk: 'attention', waistHip: 0.92, waistHipRisk: 'attention', waistHeight: 0.54, waistHeightRisk: 'attention' })
  })

  it('uses lean mass for resting energy once body fat is known', () => {
    const facts = profileFacts({ ...EMPTY_PROFILE, sex: 'm', birth: '1990-05-10', height: 178 }, [{ date: '2026-11-27', kg: 86.4 }], '2026-11-27', [
      { date: '2026-11-27', key: 'bodyFat', value: 22 },
    ])
    expect(facts).toMatchObject({ leanMass: 67.4, fatMass: 19, resting: 1826, restingFrom: 'leanMass' })
  })
})

