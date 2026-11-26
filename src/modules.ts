import type { Module } from '@core/api'
import calendar from '@modules/calendar/module'
import clients from '@modules/clients/module'
import diet from '@modules/diet/module'
import finance from '@modules/finance/module'
import focus from '@modules/focus/module'
import goals from '@modules/goals/module'
import habits from '@modules/habits/module'
import health from '@modules/health/module'
import lists from '@modules/lists/module'
import notes from '@modules/notes/module'
import reading from '@modules/reading/module'
import study from '@modules/study/module'
import workouts from '@modules/workouts/module'

/**
 * The module registry.
 *
 * Adding a module is one import and one line here. A community module is
 * an npm package that default-exports a Module:
 *
 *   import workouts from '@teorganiza/module-workouts'
 *
 * Nothing in `core/` ever changes to add one. If it has to, the contract
 * is wrong — open an issue instead of reaching into the core.
 */
export const modules: Module[] = [
  lists,
  calendar,
  goals,
  health,
  habits,
  workouts,
  diet,
  study,
  reading,
  notes,
  finance,
  clients,
  focus,
]
