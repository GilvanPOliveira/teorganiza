import { Dumbbell } from 'lucide-react'
import { defineModule } from '@core/api'
import { sessionSchema, type Session } from './schema'
import { WorkoutsScreen } from './screens'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'workouts',
  name: 'Academia',
  apiVersion: 1,
  version: '0.1.0',
  icon: Dumbbell,
  order: 110,

  collections: [
    {
      name: 'sessions',
      schema: sessionSchema,
      schemaVersion: 1,
      describe: (record) => {
        const session = record.data as Session
        return `${session.name} · ${session.date}`
      },
      indexes: ['date'],
      partition: (record) => (record.data as Session).date.slice(0, 7),
    },
  ],

  routes: [{ path: '', element: WorkoutsScreen }],

  commands: [{ id: 'new-session', label: 'Registrar treino', path: '', keywords: ['treino', 'academia', 'musculação'] }],

  locales: { 'pt-BR': ptBR },
})
