import { describe, expect, it } from 'vitest'
import { healthSignals } from './signals'
import { intakeSignal } from '../diet/signals'

const exam = (date: string, values: object) => ({ date, name: 'x', kind: 'lab' as const, place: '', result: '', next: null, values })

describe('signals', () => {
  it('takes the latest pressure and glucose from exams, ignoring future ones', () => {
    const out = healthSignals(
      [exam('2026-05-01', { systolic: 150, diastolic: 95 }), exam('2026-10-01', { systolic: 128, diastolic: 82, glucose: 104 }), exam('2027-01-01', { systolic: 170, diastolic: 100 })],
      [],
      '2026-11-27',
    )
    expect(out.find((s) => s.key === 'bloodPressure')).toMatchObject({ value: 128, value2: 82, date: '2026-10-01' })
    expect(out.find((s) => s.key === 'glucose')?.value).toBe(104)
  })

  it("reads today's sleep, energy and water", () => {
    const out = healthSignals([], [{ date: '2026-11-27', sleep: 5.5, water: 3, mood: null, energy: 2, note: '' }], '2026-11-27')
    expect(out.map((s) => [s.key, s.value])).toEqual([
      ['sleep', 5.5],
      ['energy', 2],
      ['water', 3],
    ])
  })

  it('reads the latest HbA1c', () => {
    const out = healthSignals([], [], '2026-11-27', [{ date: '2026-10-12', time: null, marker: 'hba1c', value: 6.1, value2: null, examId: 'e1' }])
    expect(out).toEqual([{ key: 'hba1c', value: 6.1, date: '2026-10-12' }])
  })

  it('averages the past week of meals, today left out, from 3 logged days', () => {
    const meal = (date: string, kcal: number, protein: number) => ({ date, name: 'x', kcal, protein, carbs: 0, fat: 0 })
    expect(intakeSignal([meal('2026-11-25', 2000, 100), meal('2026-11-26', 2400, 120)], '2026-11-27')).toBeNull()
    const signal = intakeSignal(
      [meal('2026-11-24', 1000, 50), meal('2026-11-24', 1000, 50), meal('2026-11-25', 2400, 120), meal('2026-11-26', 2600, 130), meal('2026-11-27', 5000, 300), meal('2026-11-01', 9000, 9)],
      '2026-11-27',
    )
    expect(signal).toMatchObject({ value: 2333, value2: 117, days: 3, date: '2026-11-26' })
  })
})
