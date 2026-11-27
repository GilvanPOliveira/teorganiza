import { Dumbbell } from 'lucide-react'
import { defineModule, type DatedEntry } from '@core/api'
import { HistoryScreen, SessionScreen } from './history'
import { LibraryScreen } from './library'
import { RoutineScreen, RoutinesScreen } from './routines'
import {
  customExerciseSchema,
  planSnapshotSchema,
  routineSchema,
  sessionMigrations,
  sessionSchema,
  type CustomExercise,
  type PlanSnapshot,
  type Routine,
  type Session,
} from './schema'
import { SheetScreen, SnapshotScreen } from './sheet'
import { TodayScreen } from './today'
import ptBR from './locales/pt-BR.json'

/**
 * Training: an exercise library, routines by weekday or in rotation, and
 * workouts logged set by set with a rest timer and records found as they
 * happen. Written for TeOrganiza, after the feature set of openGym.
 */
export default defineModule({
  id: 'workouts',
  name: 'Treino',
  apiVersion: 1,
  version: '0.2.0',
  icon: Dumbbell,
  order: 110,
  within: 'health/day',
  tabLabel: 'Treino',

  collections: [
    {
      name: 'sessions',
      schema: sessionSchema,
      schemaVersion: 2,
      describe: (record) => {
        const session = record.data as Session
        return `${session.name} · ${session.date}`
      },
      indexes: ['date'],
      partition: (record) => (record.data as Session).date.slice(0, 7),
    },
    {
      name: 'routines',
      schema: routineSchema,
      schemaVersion: 1,
      describe: (record) => (record.data as Routine).name,
      indexes: ['order'],
    },
    {
      name: 'plans',
      schema: planSnapshotSchema,
      schemaVersion: 1,
      describe: (record) => `Ficha · ${(record.data as PlanSnapshot).date}`,
      indexes: ['date'],
    },
    {
      name: 'exercises',
      schema: customExerciseSchema,
      schemaVersion: 1,
      describe: (record) => (record.data as CustomExercise).name,
    },
  ],

  migrations: { sessions: sessionMigrations },

  routes: [
    { path: '', element: TodayScreen, label: 'Hoje' },
    { path: 'routines', element: RoutinesScreen, label: 'Rotinas' },
    { path: 'routines/:id', element: RoutineScreen },
    { path: 'library', element: LibraryScreen, label: 'Exercícios' },
    { path: 'library/:exerciseId', element: LibraryScreen },
    { path: 'history', element: HistoryScreen, label: 'Histórico' },
    { path: 'history/:id', element: SessionScreen },
    { path: 'history/plans/:id', element: SnapshotScreen },
    { path: 'sheet', element: SheetScreen },
  ],

  commands: [
    { id: 'start', label: 'Começar treino', path: '', keywords: ['treino', 'academia', 'musculação', 'malhar'] },
    { id: 'routines', label: 'Rotinas de treino', path: 'routines', keywords: ['rotina', 'ficha', 'plano', 'treino'] },
    { id: 'library', label: 'Biblioteca de exercícios', path: 'library', keywords: ['exercício', 'biblioteca', 'músculo'] },
    { id: 'sheet', label: 'Ficha de treino', path: 'sheet', keywords: ['ficha', 'imprimir', 'pdf', 'exportar', 'treino'] },
    { id: 'history', label: 'Histórico de treinos', path: 'history', keywords: ['histórico', 'treinos', 'recorde'] },
  ],

  provides: {
    /** Workouts done, on the agenda and in the day summary. */
    dated: async (read, { from, to }) =>
      (await read<Session>('sessions'))
        .filter((s) => s.data.finishedAt && s.data.date >= from && s.data.date <= to)
        .map(
          (s): DatedEntry => ({
            id: s.id,
            date: s.data.date,
            title: s.data.name,
            kind: 'Treino',
            path: `history/${s.id}`,
            done: true,
          }),
        ),
  },

  locales: { 'pt-BR': ptBR },
})
