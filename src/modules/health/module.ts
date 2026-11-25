import { HeartPulse } from 'lucide-react'
import { defineModule } from '@core/api'
import { daySchema, doseSchema, medicineSchema, type Day, type Dose, type Medicine } from './schema'
import { HealthScreen } from './screens'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'health',
  name: 'Saúde',
  apiVersion: 1,
  version: '0.1.0',
  icon: HeartPulse,
  order: 90,

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
  ],

  routes: [{ path: '', element: HealthScreen }],

  commands: [{ id: 'checkin', label: 'Registrar o dia', path: '', keywords: ['sono', 'humor', 'água', 'remédio'] }],

  locales: { 'pt-BR': ptBR },
})
