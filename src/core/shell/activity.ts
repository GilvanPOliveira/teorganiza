import { toLocalISODate } from '@core/api/dates'
import { CORE_MODULE_ID } from '@core/collections'
import { readAll } from '@core/db/repository'
import { getCollections } from '@core/registry/registry'

export interface ModuleActivity {
  moduleId: string
  /** Live records now. */
  total: number
  /** Records created or edited in the window. */
  touched: number
  created: number
}

/**
 * What each module recorded in a window, read straight from the envelopes.
 * Generic on purpose: `createdAt` and `updatedAt` mean the same in every
 * collection, so this needs nothing from any module. Meaningful numbers
 * per module ("km run", "R$ spent") come later, from the `metrics` provider.
 */
export async function readActivity(since: string): Promise<ModuleActivity[]> {
  const byModule = new Map<string, ModuleActivity>()
  for (const { path, moduleId } of getCollections()) {
    if (moduleId === CORE_MODULE_ID) continue
    const rows = await readAll<unknown>(path, { includeDeleted: true })
    const entry = byModule.get(moduleId) ?? { moduleId, total: 0, touched: 0, created: 0 }
    for (const row of rows) {
      if (row.deletedAt === null) entry.total++
      if (row.updatedAt >= since) entry.touched++
      if (row.createdAt >= since && row.deletedAt === null) entry.created++
    }
    byModule.set(moduleId, entry)
  }
  return [...byModule.values()]
}

/** Midnight `days` ago, as the ISO instant envelopes are compared against. */
export function daysAgo(days: number, now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).toISOString()
}

/** The Monday that starts the week of `date`, as 'YYYY-MM-DD'. */
export function weekStart(date: Date = new Date()): string {
  const offset = (date.getDay() + 6) % 7
  return toLocalISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset))
}
