import Dexie, { type Table } from 'dexie'
import type { Envelope } from '@core/api/types'
import { getCollections } from '@core/registry/registry'

const SCHEMA_KEY = 'teorganiza.schema'

let db: Dexie | null = null

/**
 * The working copy. This is the real database of the app: modules always
 * read and write here, and the destination is only touched during sync.
 *
 * Tables are derived from the registry, so installing a module changes the
 * schema. IndexedDB needs a version number for that, and the number has to
 * grow monotonically — we keep it next to a signature of the table spec and
 * bump it whenever the spec changes.
 */
export function openDatabase(): Dexie {
  if (db) return db

  const stores: Record<string, string> = {}
  for (const collection of getCollections()) {
    const indexes = (collection.def.indexes ?? []).map((field) => `data.${field}`)
    stores[collection.path] = ['id', 'updatedAt', 'deletedAt', '*tags', ...indexes].join(', ')
  }

  const signature = JSON.stringify(stores)
  const version = nextVersion(signature)

  const instance = new Dexie('teorganiza')
  instance.version(version).stores(stores)
  db = instance
  return instance
}

export function table<T>(path: string): Table<Envelope<T>, string> {
  return openDatabase().table(path)
}

/** Only for tests and for the "replace everything" path of an import. */
export function resetDatabaseHandle(): void {
  db?.close()
  db = null
}

function nextVersion(signature: string): number {
  const stored = readSchemaMeta()
  if (stored && stored.signature === signature) return stored.version

  const version = (stored?.version ?? 0) + 1
  writeSchemaMeta({ version, signature })
  return version
}

interface SchemaMeta {
  version: number
  signature: string
}

function readSchemaMeta(): SchemaMeta | null {
  try {
    const raw = localStorage.getItem(SCHEMA_KEY)
    return raw ? (JSON.parse(raw) as SchemaMeta) : null
  } catch {
    return null
  }
}

function writeSchemaMeta(meta: SchemaMeta): void {
  try {
    localStorage.setItem(SCHEMA_KEY, JSON.stringify(meta))
  } catch {
    /* storage disabled: the schema is rebuilt from scratch each session */
  }
}
