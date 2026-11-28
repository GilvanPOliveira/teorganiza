import type { DatedEntry, Module, ProgressEntry, ProviderReader, Signal } from '@core/api/types'
import * as repository from '@core/db/repository'
import { collectionPath, getModules } from '@core/registry/registry'

/** An entry as the rest of the app sees it: which module, and an absolute path. */
export type CollectedDated = DatedEntry & { moduleId: string; key: string; href: string }
export type CollectedProgress = ProgressEntry & { moduleId: string; key: string; href: string }

function readerFor(mod: Module): ProviderReader {
  return <T,>(collection: string) => repository.readAll<T>(collectionPath(mod.id, collection))
}

function href(mod: Module, path: string): string {
  return `/${mod.id}/${path}`.replace(/\/$/, '')
}

/**
 * Every dated entry in the range, from every module that offers them,
 * sorted by day and time. One module failing is left out, not fatal.
 */
export async function collectDated(
  range: { from: string; to: string },
  options: { exclude?: string[]; modules?: Module[] } = {},
): Promise<CollectedDated[]> {
  const modules = (options.modules ?? getModules()).filter(
    (mod) => mod.provides?.dated && !options.exclude?.includes(mod.id),
  )
  const lists = await Promise.all(
    modules.map(async (mod) => {
      try {
        const entries = await mod.provides!.dated!(readerFor(mod), range)
        return entries
          .filter((entry) => entry.date >= range.from && entry.date <= range.to)
          .map((entry) => ({ ...entry, moduleId: mod.id, key: `${mod.id}:${entry.id}`, href: href(mod, entry.path) }))
      } catch {
        return []
      }
    }),
  )
  return lists
    .flat()
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'))
}

export async function collectProgress(options: { modules?: Module[] } = {}): Promise<CollectedProgress[]> {
  const modules = (options.modules ?? getModules()).filter((mod) => mod.provides?.progress)
  const lists = await Promise.all(
    modules.map(async (mod) => {
      try {
        const entries = await mod.provides!.progress!(readerFor(mod))
        return entries.map((entry) => ({ ...entry, moduleId: mod.id, key: `${mod.id}:${entry.id}`, href: href(mod, entry.path) }))
      } catch {
        return []
      }
    }),
  )
  return lists.flat()
}

/** Every signal on offer, keyed; for the same key the newest reading wins. */
export async function collectSignals(today: string, options: { modules?: Module[] } = {}): Promise<Partial<Record<Signal['key'], Signal>>> {
  const modules = (options.modules ?? getModules()).filter((mod) => mod.provides?.signals)
  const lists = await Promise.all(
    modules.map(async (mod) => {
      try {
        return await mod.provides!.signals!(readerFor(mod), today)
      } catch {
        return []
      }
    }),
  )
  const out: Partial<Record<Signal['key'], Signal>> = {}
  for (const signal of lists.flat()) {
    const current = out[signal.key]
    if (!current || signal.date > current.date) out[signal.key] = signal
  }
  return out
}
