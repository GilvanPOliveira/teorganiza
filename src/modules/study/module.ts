import { GraduationCap } from 'lucide-react'
import { defineModule } from '@core/api'
import { cardSchema, courseSchema, type Card, type Course } from './schema'
import { CoursesScreen, ReviewScreen } from './screens'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'study',
  name: 'Estudos',
  apiVersion: 1,
  version: '0.1.0',
  icon: GraduationCap,
  order: 130,

  collections: [
    {
      name: 'courses',
      schema: courseSchema,
      schemaVersion: 1,
      describe: (record) => (record.data as Course).name,
    },
    {
      name: 'cards',
      schema: cardSchema,
      schemaVersion: 1,
      describe: (record) => (record.data as Card).front,
      indexes: ['courseId', 'due'],
    },
  ],

  routes: [
    { path: '', element: CoursesScreen, label: 'Cursos e cartões' },
    { path: 'review', element: ReviewScreen, label: 'Revisar' },
  ],

  commands: [
    { id: 'review', label: 'Revisar flashcards', path: 'review', keywords: ['flashcard', 'revisão', 'estudar'] },
    { id: 'new-card', label: 'Novo flashcard', path: '', keywords: ['cartão', 'flashcard'] },
  ],

  locales: { 'pt-BR': ptBR },
})
