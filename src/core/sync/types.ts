import type { Envelope } from '@core/api/types'

/**
 * Three-way merge. The base is the copy of what was last pulled; without
 * it there is no way to tell "added here" from "deleted there".
 *
 * Not implemented yet — this is the contract for the next construction step.
 */

export interface PartitionState {
  /** What the destination held at the last successful pull. */
  base: Envelope<unknown>[]
  etag: string
}

export type Resolution =
  | { kind: 'take-remote' }
  | { kind: 'keep-local' }
  | { kind: 'conflict' }

export interface Conflict {
  collectionPath: string
  id: string
  local: Envelope<unknown>
  remote: Envelope<unknown>
  /** From the collection's own `describe`. The module's only part in this. */
  localLabel: string
  remoteLabel: string
}

export interface MergeResult {
  merged: Envelope<unknown>[]
  conflicts: Conflict[]
}

/**
 * | local            | remote                      | result        |
 * | same as base     | changed                     | take remote   |
 * | changed          | same as base                | keep local    |
 * | changed          | changed, identical payload  | take, no conflict |
 * | changed          | changed, different payload  | CONFLICT      |
 * | new              | absent                      | keep local    |
 * | absent           | new                         | take remote   |
 * | tombstoned       | changed                     | CONFLICT      |
 * | changed          | tombstoned                  | CONFLICT      |
 * | tombstoned       | tombstoned                  | take          |
 */
export type MergeFn = (
  base: Envelope<unknown>[],
  local: Envelope<unknown>[],
  remote: Envelope<unknown>[],
) => MergeResult
