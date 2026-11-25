import { normalizeTags } from '@core/db/envelope'
import type { Envelope } from '@core/api/types'
import type { Conflict, MergeFn, MergeResult, Resolution } from './types'

type Rec = Envelope<unknown>

export interface MergeContext {
  collectionPath: string
  /** The collection's own `describe`, used only to label conflicts. */
  describe: (record: Rec) => string
}

/**
 * Fields that say *how* a record travelled, not *what* it holds. Two
 * versions that differ only here carry the same payload: touching a record
 * without changing it, or the same edit made on two devices, is not a
 * conflict. Everything else — `data`, `deletedAt`, and any field the
 * envelope gains later (such as `tags`) — counts as payload.
 */
const SYNC_METADATA: ReadonlySet<string> = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'deviceId',
  'rev',
  'schemaVersion',
])

/**
 * Decides one record. Any side may be absent; at least one of `local` and
 * `remote` must be present.
 *
 * "Changed" is measured against the base by payload, never by `rev` or
 * `updatedAt`: an edit that was undone is not a change, and clocks on two
 * devices are not to be trusted.
 */
export function resolveRecord(
  base: Rec | undefined,
  local: Rec | undefined,
  remote: Rec | undefined,
): Resolution {
  if (!remote) return { kind: 'keep-local' }
  if (!local) return { kind: 'take-remote' }

  const localKey = payloadKey(local)
  const remoteKey = payloadKey(remote)

  // Same payload on both sides, or deleted on both: nothing to decide.
  // Taking the remote copy aligns the metadata with the destination.
  if (localKey === remoteKey) return { kind: 'take-remote' }
  if (local.deletedAt !== null && remote.deletedAt !== null) return { kind: 'take-remote' }

  // Same id on both sides with no common ancestor (first sync choosing to
  // merge): there is nothing to tell which one is newer.
  if (!base) return { kind: 'conflict' }

  const baseKey = payloadKey(base)
  const localChanged = localKey !== baseKey
  const remoteChanged = remoteKey !== baseKey

  if (!localChanged) return { kind: 'take-remote' }
  if (!remoteChanged) return { kind: 'keep-local' }
  // Both changed and they disagree. Includes deleted-here/edited-there in
  // either direction: a delete never silently wins over an edit.
  return { kind: 'conflict' }
}

/**
 * Three-way merge of one partition.
 *
 * Records in conflict stay in `merged` as their LOCAL version, so the
 * result is always a complete partition and nothing on this device is
 * lost while the user decides. It is not writable until every conflict is
 * settled — see `applyResolutions`.
 *
 * A record absent on one side is kept from the side that has it. Deletes
 * travel as tombstones, so absence means "not seen yet", never "removed".
 */
export function mergePartition(
  base: Rec[],
  local: Rec[],
  remote: Rec[],
  context: MergeContext,
): MergeResult {
  const baseById = byId(base)
  const localById = byId(local)
  const remoteById = byId(remote)

  const ids = [...new Set([...localById.keys(), ...remoteById.keys()])].sort()

  const merged: Rec[] = []
  const conflicts: Conflict[] = []

  for (const id of ids) {
    const l = localById.get(id)
    const r = remoteById.get(id)
    const resolution = resolveRecord(baseById.get(id), l, r)

    switch (resolution.kind) {
      case 'keep-local':
        merged.push(l!)
        break
      case 'take-remote':
        merged.push(r!)
        break
      case 'conflict':
        merged.push(l!)
        conflicts.push({
          collectionPath: context.collectionPath,
          id,
          local: l!,
          remote: r!,
          localLabel: label(context, l!),
          remoteLabel: label(context, r!),
        })
        break
    }
  }

  return { merged, conflicts }
}

/** Binds a collection to the contract's `MergeFn` shape. */
export function createMerge(context: MergeContext): MergeFn {
  return (base, local, remote) => mergePartition(base, local, remote, context)
}

export type ConflictChoice = 'keep-local' | 'take-remote'

/**
 * Applies the user's choices from the conflict dialog. Throws if any
 * conflict is left undecided: nothing is written until the user decides.
 */
export function applyResolutions(
  result: MergeResult,
  choices: ReadonlyMap<string, ConflictChoice>,
): Rec[] {
  const remoteByConflict = new Map<string, Rec>()
  for (const conflict of result.conflicts) {
    const choice = choices.get(conflict.id)
    if (!choice) throw new Error(`Conflict on ${conflict.collectionPath}/${conflict.id} is undecided`)
    if (choice === 'take-remote') remoteByConflict.set(conflict.id, conflict.remote)
  }
  return result.merged.map((record) => remoteByConflict.get(record.id) ?? record)
}

function byId(records: Rec[]): Map<string, Rec> {
  return new Map(records.map((record) => [record.id, record]))
}

function label(context: MergeContext, record: Rec): string {
  try {
    return context.describe(record)
  } catch {
    // A remote record from a newer schema may not fit this device's
    // `describe`. The dialog still needs something to show.
    return record.id
  }
}

function payloadKey(record: Rec): string {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!SYNC_METADATA.has(key)) payload[key] = value
  }
  // Tags are a set. A record written before tags existed has none, which is
  // the same as an empty list, and order never means anything.
  payload.tags = normalizeTags(record.tags)
  return canonical(payload)
}


/** JSON with object keys sorted, so key order never reads as a change. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as object)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
