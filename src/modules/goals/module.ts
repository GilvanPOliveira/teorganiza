import { Target } from 'lucide-react'
import { defineModule } from '@core/api'
import { goalSchema, type Goal } from './schema'
import { GoalsScreen } from './screens'
import { GoalsWidget } from './widgets'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'goals',
  name: 'Metas',
  apiVersion: 1,
  version: '0.1.0',
  icon: Target,
  order: 70,

  collections: [
    {
      name: 'goals',
      schema: goalSchema,
      schemaVersion: 1,
      describe: (record) => {
        const goal = record.data as Goal
        return `${goal.title} · ${goal.current}/${goal.target} ${goal.unit}`.trim()
      },
    },
  ],

  routes: [{ path: '', element: GoalsScreen }],

  commands: [{ id: 'new-goal', label: 'Nova meta', path: '', keywords: ['meta', 'objetivo', 'alvo'] }],

  widgets: [{ id: 'progress', label: 'Metas', size: 'md', element: GoalsWidget }],

  locales: { 'pt-BR': ptBR },
})
