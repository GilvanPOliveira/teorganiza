import type { Module } from './types'

/**
 * Exists for type inference and for a clear failure at load time: the
 * registry refuses a malformed module with a readable message instead of
 * breaking on some screen three clicks later.
 */
export function defineModule(module: Module): Module {
  return module
}
