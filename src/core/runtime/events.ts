import type { EventHandler, EventPayload, Module } from '@core/api/types'

const handlers = new Map<string, EventHandler[]>()

/**
 * Modules never import each other. They talk through here, with fully
 * qualified names: a module that emits 'transaction-created' publishes
 * 'finance:transaction-created', and a listener that is not installed
 * simply never runs — no error, no dependency.
 */
export function wireListeners(modules: Module[]): void {
  handlers.clear()
  for (const mod of modules) {
    for (const [event, handler] of Object.entries(mod.listens ?? {})) {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    }
  }
}

export function qualify(moduleId: string, event: string): string {
  return event.includes(':') ? event : `${moduleId}:${event}`
}

/**
 * Fire and forget. The emitter never waits, and a listener that throws
 * never breaks the module that emitted.
 */
export function emitEvent(name: string, payload: EventPayload): void {
  for (const handler of handlers.get(name) ?? []) {
    try {
      void Promise.resolve(handler(payload)).catch((error: unknown) => {
        console.error(`[TeOrganiza] Listener for "${name}" failed.`, error)
      })
    } catch (error) {
      console.error(`[TeOrganiza] Listener for "${name}" threw.`, error)
    }
  }
}
