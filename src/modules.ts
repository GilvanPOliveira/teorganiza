import type { Module } from '@core/api'
import finance from '@modules/finance/module'

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
export const modules: Module[] = [finance]
