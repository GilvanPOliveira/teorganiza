import { Apple } from 'lucide-react'
import { z } from 'zod'
import { defineModule } from '@core/api'
import { mealSchema, type Meal } from './schema'
import { DietScreen } from './screens'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'diet',
  name: 'Dieta',
  apiVersion: 1,
  version: '0.1.0',
  icon: Apple,
  order: 120,

  collections: [
    {
      name: 'meals',
      schema: mealSchema,
      schemaVersion: 1,
      describe: (record) => {
        const meal = record.data as Meal
        return `${meal.name} · ${meal.kcal} kcal · ${meal.date}`
      },
      indexes: ['date'],
      partition: (record) => (record.data as Meal).date.slice(0, 7),
    },
  ],

  routes: [{ path: '', element: DietScreen }],

  settings: z.object({ target: z.number(), protein: z.number() }),

  commands: [{ id: 'new-meal', label: 'Registrar refeição', path: '', keywords: ['refeição', 'comida', 'caloria'] }],

  locales: { 'pt-BR': ptBR },
})
