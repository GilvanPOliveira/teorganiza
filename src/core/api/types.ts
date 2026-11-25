import type { ComponentType } from 'react'
import type { ZodType } from 'zod'

/**
 * Version of the module contract itself. A module declares which one it
 * implements; the registry refuses anything it does not understand.
 * Raising this is a rare, deliberate, documented event.
 */
export const MODULE_API_VERSION = 1

/* ------------------------------------------------------------------ *
 * Records
 * ------------------------------------------------------------------ */

/**
 * Every record in the system, from every module, lives in this envelope.
 * It is what lets the core merge data it knows nothing about.
 *
 * Modules never build one of these: they pass `data`, the core does the rest.
 */
export interface Envelope<T = unknown> {
  /** UUID v7 — sortable by creation time, collision-free across devices. */
  id: string
  createdAt: string
  updatedAt: string
  /** Tombstone. Without it, a delete on one device is resurrected by another. */
  deletedAt: string | null
  deviceId: string
  /** Local revisions since the last successful sync. */
  rev: number
  schemaVersion: number
  /**
   * Ids from `core/tags`. In the envelope, not in `data`, so the core can
   * find "everything tagged X" across every module without asking any of
   * them. Optional because records written before tags existed have none;
   * missing means the same as `[]`.
   */
  tags?: string[]
  data: T
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

export interface RangeFilter<V> {
  gte?: V
  lte?: V
  in?: V[]
}

export type Filter<T> = {
  [K in keyof T]?: T[K] | RangeFilter<T[K]>
}

/**
 * Deliberately poor. Anything richer would couple modules to the local
 * database, and the whole point is that the core can replace it.
 * What does not fit here, a module computes in memory over the result.
 */
export interface Query<T> {
  where?: Filter<T>
  sort?: { field: keyof T & string; dir: 'asc' | 'desc' }
  limit?: number
  /** Tombstones are hidden unless you ask for them. */
  includeDeleted?: boolean
  /** Only records carrying this tag id. */
  tag?: string
}

/* ------------------------------------------------------------------ *
 * Collections
 * ------------------------------------------------------------------ */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CollectionDef<T = any> {
  /** Unique within the module. Addressed globally as `<moduleId>/<name>`. */
  name: string
  schema: ZodType<T>
  schemaVersion: number
  /**
   * One readable line for a record. This is the only place a module takes
   * part in conflict resolution — the merge itself lives in the core.
   * e.g. "Mercado · R$ 240,00 · 14/11/2026"
   */
  describe: (record: Envelope<T>) => string
  /** Fields inside `data` to index locally. */
  indexes?: string[]
  /**
   * Groups records into files at the destination. Collections that grow
   * without bound should partition (transactions by month); small, stable
   * ones should not.
   */
  partition?: (record: Envelope<T>) => string
}

export type AnyCollectionDef = CollectionDef<any>

export type MigrationFn = (record: Envelope<any>) => Envelope<any>

/* ------------------------------------------------------------------ *
 * Screens
 * ------------------------------------------------------------------ */

export interface RouteDef {
  /** Relative to the module: '', 'new', 'reports'. Never write the prefix. */
  path: string
  element: ComponentType
  /** When present, the route appears in the module's own sub-navigation. */
  label?: string
  /** Rendered in the shell's top bar. The only point a module reaches chrome. */
  actions?: ComponentType
}

export type WidgetSize = 'sm' | 'md' | 'lg'

export interface WidgetDef {
  id: string
  label: string
  /** sm = 2 columns, md = 3, lg = 6. Height is uniform for all. */
  size: WidgetSize
  element: ComponentType
}

/** What the shell passes to a module icon. Any lucide icon fits. */
export interface IconProps {
  size?: number | string
  strokeWidth?: number | string
  className?: string
}

/**
 * An entry in the command palette (Ctrl+K). Declarative on purpose: a
 * command only navigates to one of the module's own routes, so the palette
 * never runs module code outside the module's screen.
 */
export interface CommandDef {
  id: string
  label: string
  /** A route of this module, relative like RouteDef.path. */
  path: string
  /** Extra words the palette matches, e.g. ['gasto', 'despesa']. */
  keywords?: string[]
}

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

export type EventPayload = Record<string, unknown>
export type EventHandler = (payload: EventPayload) => void | Promise<void>

/* ------------------------------------------------------------------ *
 * The module
 * ------------------------------------------------------------------ */

export interface Module {
  /** Slug, unique across the app. Used in routes and storage paths. */
  id: string
  name: string
  apiVersion: typeof MODULE_API_VERSION
  /** The module's own semver, independent of the core. */
  version: string
  icon?: ComponentType<IconProps>
  /**
   * Letter for the "G then letter" shortcut. Optional: without it the shell
   * picks the first free letter of the name.
   */
  shortcut?: string

  collections: AnyCollectionDef[]
  routes: RouteDef[]
  widgets?: WidgetDef[]
  commands?: CommandDef[]
  settings?: ZodType<any>

  /** Event names this module emits, without the module prefix. */
  emits?: string[]
  /** Events from other modules this one reacts to, fully qualified. */
  listens?: Record<string, EventHandler>

  /** Per collection name, ordered migrations applied on read. */
  migrations?: Record<string, MigrationFn[]>

  /** locale -> key -> string. Keys are namespaced by module id. */
  locales?: Record<string, Record<string, string>>
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ *
 * App context
 * ------------------------------------------------------------------ */

export type StorageKind = 'disk-web' | 'disk-tauri' | 'drive'

export interface StorageState {
  /** null means no destination configured — the evaluation state. */
  kind: StorageKind | null
  lastSyncAt: string | null
  pendingCount: number
}

export interface AppContextValue {
  locale: string
  theme: 'light' | 'dark'
  deviceId: string
  /** Read-only. A module may show sync state; it may never drive sync. */
  storage: StorageState
}
