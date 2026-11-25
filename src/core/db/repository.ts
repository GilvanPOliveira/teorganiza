import type { Envelope, Query, RangeFilter } from '@core/api/types'
import { getCollection, getModule } from '@core/registry/registry'
import { table } from './database'
import { newEnvelope, tombstoneEnvelope, touchEnvelope } from './envelope'

/**
 * Reading applies migrations record by record. There is no "migration
 * window": a device that has not been opened in eight months migrates
 * when it opens, and a stale device can coexist with a current one.
 */
function migrate<T>(record: Envelope<T>, path: string): Envelope<T> {
  const { moduleId, def } = getCollection(path)
  if (record.schemaVersion >= def.schemaVersion) return record

  const steps = getModule(moduleId)?.migrations?.[def.name] ?? []
  let current = record

  while (current.schemaVersion < def.schemaVersion) {
    const step = steps[current.schemaVersion - 1]
    if (!step) {
      throw new Error(
        `[TeOrganiza] Missing migration ${current.schemaVersion} -> ` +
          `${current.schemaVersion + 1} for "${path}".`,
      )
    }
    current = { ...step(current), schemaVersion: current.schemaVersion + 1 } as Envelope<T>
  }

  return current
}

function isRangeFilter<V>(value: unknown): value is RangeFilter<V> {
  if (typeof value !== 'object' || value === null) return false
  return 'gte' in value || 'lte' in value || 'in' in value
}

function matches<T>(record: Envelope<T>, query?: Query<T>): boolean {
  if (!query?.where) return true
  const data = record.data as Record<string, unknown>

  for (const [field, condition] of Object.entries(query.where)) {
    const actual = data[field]

    if (isRangeFilter(condition)) {
      const { gte, lte, in: oneOf } = condition as RangeFilter<unknown>
      if (gte !== undefined && (actual as never) < (gte as never)) return false
      if (lte !== undefined && (actual as never) > (lte as never)) return false
      if (oneOf !== undefined && !oneOf.includes(actual)) return false
      continue
    }

    if (actual !== condition) return false
  }

  return true
}

/**
 * Filtering happens in memory. That is a deliberate starting point: the
 * Query type is poor enough that the core can move this into real indexes
 * later without a single module changing.
 */
export async function readAll<T>(path: string, query?: Query<T>): Promise<Envelope<T>[]> {
  const rows = (await table<T>(path).toArray()).map((row) => migrate(row, path))

  let result = rows.filter(
    (row) => (query?.includeDeleted ? true : row.deletedAt === null) && matches(row, query),
  )

  if (query?.sort) {
    const { field, dir } = query.sort
    const sign = dir === 'desc' ? -1 : 1
    result = [...result].sort((a, b) => {
      const left = (a.data as Record<string, unknown>)[field]
      const right = (b.data as Record<string, unknown>)[field]
      if ((left as never) < (right as never)) return -1 * sign
      if ((left as never) > (right as never)) return 1 * sign
      return 0
    })
  }

  return query?.limit ? result.slice(0, query.limit) : result
}

export async function readOne<T>(path: string, id: string): Promise<Envelope<T> | undefined> {
  const row = await table<T>(path).get(id)
  return row ? migrate(row, path) : undefined
}

export async function createRecord<T>(
  path: string,
  data: T,
  deviceId: string,
): Promise<string> {
  const { def } = getCollection(path)
  const parsed = def.schema.parse(data) as T
  const record = newEnvelope(parsed, def.schemaVersion, deviceId)
  await table<T>(path).put(record)
  return record.id
}

export async function updateRecord<T>(
  path: string,
  id: string,
  patch: Partial<T>,
  deviceId: string,
): Promise<void> {
  const { def } = getCollection(path)
  const previous = await table<T>(path).get(id)
  if (!previous) throw new Error(`[TeOrganiza] No record "${id}" in "${path}".`)

  const migrated = migrate(previous, path)
  const parsed = def.schema.parse({ ...migrated.data, ...patch }) as T
  await table<T>(path).put(touchEnvelope(migrated, parsed, deviceId))
}

/** Marks a tombstone. Rows are never physically removed by the app. */
export async function removeRecord<T>(
  path: string,
  id: string,
  deviceId: string,
): Promise<void> {
  const previous = await table<T>(path).get(id)
  if (!previous) return
  await table<T>(path).put(tombstoneEnvelope(migrate(previous, path), deviceId))
}
