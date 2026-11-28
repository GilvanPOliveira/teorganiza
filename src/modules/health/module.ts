import { FileHeart, HeartPulse, UserRound } from 'lucide-react'
import { defineModule, type DatedEntry } from '@core/api'
import { daySchema, doseSchema, examSchema, medicineSchema, readingSchema, type Day, type Dose, type Exam, type Medicine, type Reading } from './schema'
import { ExamsScreen } from './exams'
import { MeScreen } from './me'
import { healthSignals } from './signals'
import { HealthScreen } from './screens'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'health',
  name: 'Saúde',
  apiVersion: 1,
  version: '0.1.0',
  icon: HeartPulse,
  order: 90,
  tabLabel: 'Dia',

  collections: [
    {
      name: 'days',
      schema: daySchema,
      schemaVersion: 1,
      describe: (record) => `Registro de ${(record.data as Day).date}`,
      indexes: ['date'],
      partition: (record) => (record.data as Day).date.slice(0, 4),
    },
    {
      name: 'medicines',
      schema: medicineSchema,
      schemaVersion: 1,
      describe: (record) => (record.data as Medicine).name,
      indexes: ['active'],
    },
    {
      name: 'doses',
      schema: doseSchema,
      schemaVersion: 1,
      describe: (record) => {
        const dose = record.data as Dose
        return `Dose de ${dose.date} ${dose.time}`
      },
      indexes: ['date', 'medicineId'],
      partition: (record) => (record.data as Dose).date.slice(0, 7),
    },
    {
      name: 'exams',
      schema: examSchema,
      schemaVersion: 1,
      describe: (record) => {
        const exam = record.data as Exam
        return `${exam.name} · ${exam.date}`
      },
      indexes: ['date', 'kind'],
    },
    {
      name: 'readings',
      schema: readingSchema,
      schemaVersion: 1,
      describe: (record) => {
        const reading = record.data as Reading
        return `${reading.marker} ${reading.value}${reading.value2 !== null ? `/${reading.value2}` : ''} em ${reading.date}`
      },
      indexes: ['date', 'marker', 'examId'],
      partition: (record) => (record.data as Reading).date.slice(0, 4),
    },
  ],

  routes: [
    { path: '', element: HealthScreen, area: { id: 'day', label: 'Saúde', icon: HeartPulse, order: 90, tabLabel: 'Dia' } },
    { path: 'exams', element: ExamsScreen, area: { id: 'exams', label: 'Exames', icon: FileHeart, order: 130, within: 'health/day' } },
    { path: 'me', element: MeScreen, area: { id: 'me', label: 'Meus dados', icon: UserRound, order: 140, within: 'health/day' } },
  ],

  commands: [
    { id: 'checkin', label: 'Registrar o dia', path: '', keywords: ['sono', 'humor', 'água', 'remédio'] },
    { id: 'me', label: 'Meus dados', path: 'me', keywords: ['peso', 'altura', 'idade', 'perfil', 'imc', 'objetivo'] },
    { id: 'new-exam', label: 'Registrar exame', path: 'exams', keywords: ['exame', 'consulta', 'laudo', 'resultado'] },
  ],

  provides: {
    /** Blood pressure, glucose and LDL from exams; today's sleep and energy. */
    signals: async (read, today) =>
      healthSignals(
        (await read<Exam>('exams')).map((e) => e.data),
        (await read<Day>('days')).map((d) => d.data),
        today,
        (await read<Reading>('readings')).map((r) => r.data),
      ),
    /**
     * Exams and follow-ups; for a single day (the day summary, alerts),
     * also each dose of the active medicines at its time.
     */
    dated: async (read, { from, to }) => {
      const exams = await read<Exam>('exams')
      const entries: DatedEntry[] = exams.flatMap((exam) => [
        ...(exam.data.date >= from && exam.data.date <= to
          ? [{ id: exam.id, date: exam.data.date, title: exam.data.name, kind: 'Exame', path: 'exams' }]
          : []),
        ...(exam.data.next && exam.data.next >= from && exam.data.next <= to
          ? [{ id: `${exam.id}:next`, date: exam.data.next, title: `Retorno: ${exam.data.name}`, kind: 'Retorno', path: 'exams' }]
          : []),
      ])
      if (from !== to) return entries
      const medicines = (await read<Medicine>('medicines')).filter((m) => m.data.active)
      const doses = (await read<Dose>('doses')).filter((d) => d.data.date === from)
      for (const medicine of medicines) {
        for (const time of medicine.data.times) {
          entries.push({
            id: `${medicine.id}:${time}`,
            date: from,
            time,
            title: medicine.data.dose ? `${medicine.data.name} · ${medicine.data.dose}` : medicine.data.name,
            kind: 'Remédio',
            path: '',
            done: doses.some((d) => d.data.medicineId === medicine.id && d.data.time === time),
          })
        }
      }
      return entries
    },
  },

  locales: { 'pt-BR': ptBR },
})
