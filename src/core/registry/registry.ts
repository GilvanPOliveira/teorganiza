import type { AnyCollectionDef, Module } from '@core/api/types'
import { MODULE_API_VERSION } from '@core/api/types'
import { CORE_MODULE_ID, coreCollections } from '@core/collections'

export interface RegisteredCollection {
  /** '<moduleId>/<name>' — the global address, used by storage and backup. */
  path: string
  moduleId: string
  def: AnyCollectionDef
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/

let registered: Module[] = []
let collectionIndex = new Map<string, RegisteredCollection>()

export function collectionPath(moduleId: string, name: string): string {
  return `${moduleId}/${name}`
}

/**
 * Called once, from the composition root. Everything the shell renders —
 * navigation, routes, database tables, widgets — is derived from here.
 * The core knows no module by name.
 */
export function registerModules(modules: Module[]): void {
  const index = new Map<string, RegisteredCollection>()

  for (const collection of coreCollections) {
    index.set(collectionPath(CORE_MODULE_ID, collection.name), {
      path: collectionPath(CORE_MODULE_ID, collection.name),
      moduleId: CORE_MODULE_ID,
      def: collection,
    })
  }

  const seenModuleIds = new Set<string>([CORE_MODULE_ID])

  for (const mod of modules) {
    assert(ID_PATTERN.test(mod.id), `Module id "${mod.id}" must be a lowercase slug.`)
    assert(
      !seenModuleIds.has(mod.id),
      `Duplicate module id "${mod.id}". Ids must be unique, and "core" is reserved.`,
    )
    assert(
      mod.apiVersion === MODULE_API_VERSION,
      `Module "${mod.id}" implements module API v${mod.apiVersion}, but this ` +
        `build speaks v${MODULE_API_VERSION}. Update the module or the app.`,
    )
    assert(
      mod.collections.length > 0 || mod.routes.length > 0,
      `Module "${mod.id}" declares neither collections nor routes.`,
    )

    seenModuleIds.add(mod.id)

    const seenCollections = new Set<string>()
    for (const collection of mod.collections) {
      assert(
        ID_PATTERN.test(collection.name),
        `Collection "${collection.name}" in "${mod.id}" must be a lowercase slug.`,
      )
      assert(
        !seenCollections.has(collection.name),
        `Duplicate collection "${collection.name}" in module "${mod.id}".`,
      )
      seenCollections.add(collection.name)

      const path = collectionPath(mod.id, collection.name)
      index.set(path, { path, moduleId: mod.id, def: collection })
    }

    const seenRoutes = new Set<string>()
    for (const route of mod.routes) {
      assert(
        !route.path.startsWith('/'),
        `Route "${route.path}" in "${mod.id}" must be relative — the shell adds the prefix.`,
      )
      assert(
        !seenRoutes.has(route.path),
        `Duplicate route "${route.path}" in module "${mod.id}".`,
      )
      seenRoutes.add(route.path)
    }

    assert(
      mod.shortcut === undefined || /^[a-z]$/.test(mod.shortcut),
      `Shortcut of "${mod.id}" must be a single lowercase letter.`,
    )
    for (const command of mod.commands ?? []) {
      assert(
        seenRoutes.has(command.path),
        `Command "${command.id}" in "${mod.id}" points to "${command.path}", which is not one of its routes.`,
      )
    }
  }

  registered = modules
  collectionIndex = index
}

export function getModules(): Module[] {
  return registered
}

export function getModule(id: string): Module | undefined {
  return registered.find((mod) => mod.id === id)
}

export function getCollections(): RegisteredCollection[] {
  return [...collectionIndex.values()]
}

export function getCollection(path: string): RegisteredCollection {
  const found = collectionIndex.get(path)
  if (!found) {
    throw new Error(
      `Unknown collection "${path}". Declare it in the module's collections.`,
    )
  }
  return found
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[TeOrganiza] ${message}`)
}
