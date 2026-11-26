import { Timer } from 'lucide-react'
import { z } from 'zod'
import { defineModule } from '@core/api'
import { FocusScreen } from './screens'
import ptBR from './locales/pt-BR.json'

/** One finished focus block. */
export const sessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().positive(),
  label: z.string(),
})

export type FocusSession = z.infer<typeof sessionSchema>

export default defineModule({
  id: 'focus',
  name: 'Produtividade',
  apiVersion: 1,
  version: '0.1.0',
  icon: Timer,
  order: 250,
  within: 'lists/tasks',
  tabLabel: 'Foco',

  collections: [
    {
      name: 'sessions',
      schema: sessionSchema,
      schemaVersion: 1,
      describe: (record) => {
        const session = record.data as FocusSession
        return `${session.minutes} min${session.label ? ` · ${session.label}` : ''} · ${session.date}`
      },
      indexes: ['date'],
      partition: (record) => (record.data as FocusSession).date.slice(0, 7),
    },
  ],

  routes: [{ path: '', element: FocusScreen }],

  commands: [{ id: 'focus', label: 'Iniciar foco de 25 min', path: '', keywords: ['foco', 'pomodoro', 'concentrar'] }],

  locales: { 'pt-BR': ptBR },
})
