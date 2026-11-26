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
  tabLabel: 'Metas',

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

  provides: {
    /** Goal deadlines, on the agenda and in the day summary. */
    dated: async (read, { from, to }) =>
      (await read<Goal>('goals'))
        .filter((goal) => goal.data.due && goal.data.due >= from && goal.data.due <= to)
        .map((goal) => ({
          id: goal.id,
          date: goal.data.due!,
          title: goal.data.title,
          kind: 'Prazo da meta',
          path: '',
          done: !goal.data.source && goal.data.current >= goal.data.target,
        })),
  },

  locales: { 'pt-BR': ptBR },
})
