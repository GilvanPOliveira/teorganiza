import { Repeat } from 'lucide-react'
import { defineModule } from '@core/api'
import { checkSchema, habitSchema, type Check, type Habit } from './schema'
import { HabitsScreen } from './screens'
import { TodayHabits } from './widgets'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'habits',
  name: 'Hábitos',
  apiVersion: 1,
  version: '0.1.0',
  icon: Repeat,
  order: 100,
  within: 'health/day',

  collections: [
    {
      name: 'habits',
      schema: habitSchema,
      schemaVersion: 1,
      describe: (record) => (record.data as Habit).name,
      indexes: ['archived'],
    },
    {
      name: 'checks',
      schema: checkSchema,
      schemaVersion: 1,
      describe: (record) => `Hábito marcado em ${(record.data as Check).date}`,
      indexes: ['habitId', 'date'],
      partition: (record) => (record.data as Check).date.slice(0, 7),
    },
  ],

  routes: [{ path: '', element: HabitsScreen }],

  commands: [{ id: 'new-habit', label: 'Novo hábito', path: '', keywords: ['hábito', 'rotina'] }],

  widgets: [{ id: 'today', label: 'Hábitos de hoje', size: 'sm', element: TodayHabits }],

  provides: {
    /** For a single day only (the day summary): each active habit, done or not. A month of them would bury the agenda. */
    dated: async (read, { from, to }) => {
      if (from !== to) return []
      const checks = (await read<Check>('checks')).filter((check) => check.data.date === from)
      return (await read<Habit>('habits'))
        .filter((habit) => !habit.data.archived)
        .map((habit) => ({
          id: habit.id,
          date: from,
          title: habit.data.name,
          kind: 'Hábito',
          path: '',
          done: checks.some((check) => check.data.habitId === habit.id),
        }))
    },
  },

  locales: { 'pt-BR': ptBR },
})
