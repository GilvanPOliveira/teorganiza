import type { Signal } from '@core/api'
import type { Day, Exam, Reading } from './schema'

/**
 * What Saúde tells the rest of the app: the latest blood pressure,
 * glucose, HbA1c and LDL, and today's sleep, energy and water from
 * the day's check-in (sleep logged today is last night's).
 */
export function healthSignals(exams: readonly Exam[], days: readonly Day[], today: string, readings: readonly Reading[] = []): Signal[] {
  const out: Signal[] = []
  // Readings, newest first; values still written on older exams count too.
  const all: Reading[] = [...readings]
  for (const e of exams) {
    if (!e.values) continue
    if (e.values.systolic && e.values.diastolic) all.push({ date: e.date, time: null, marker: 'pressure', value: e.values.systolic, value2: e.values.diastolic, examId: null })
    if (e.values.glucose) all.push({ date: e.date, time: null, marker: 'glucose', value: e.values.glucose, value2: null, examId: null })
    if (e.values.ldl) all.push({ date: e.date, time: null, marker: 'ldl', value: e.values.ldl, value2: null, examId: null })
  }
  const latest = (marker: string) =>
    all
      .filter((r) => r.marker === marker && r.date <= today)
      .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')))[0]
  const pressure = latest('pressure')
  if (pressure && pressure.value2 !== null) out.push({ key: 'bloodPressure', value: pressure.value, value2: pressure.value2, date: pressure.date })
  const glucose = latest('glucose')
  if (glucose) out.push({ key: 'glucose', value: glucose.value, date: glucose.date })
  const ldl = latest('ldl')
  if (ldl) out.push({ key: 'ldl', value: ldl.value, date: ldl.date })
  const hba1c = latest('hba1c')
  if (hba1c) out.push({ key: 'hba1c', value: hba1c.value, date: hba1c.date })

  const day = days.find((d) => d.date === today)
  if (day?.sleep !== null && day?.sleep !== undefined) out.push({ key: 'sleep', value: day.sleep, date: today })
  if (day?.energy !== null && day?.energy !== undefined) out.push({ key: 'energy', value: day.energy, date: today })
  if (day) out.push({ key: 'water', value: day.water, date: today })
  return out
}
