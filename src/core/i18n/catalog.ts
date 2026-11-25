import type { Module } from '@core/api/types'
import coreEn from './locales/en.json'
import corePtBR from './locales/pt-BR.json'

export const DEFAULT_LOCALE = 'pt-BR'
export const AVAILABLE_LOCALES = ['pt-BR', 'en'] as const

type Dictionary = Record<string, string>

/** locale -> namespace -> key -> string */
const catalog = new Map<string, Map<string, Dictionary>>()

function put(locale: string, namespace: string, dictionary: Dictionary): void {
  const byNamespace = catalog.get(locale) ?? new Map<string, Dictionary>()
  byNamespace.set(namespace, { ...byNamespace.get(namespace), ...dictionary })
  catalog.set(locale, byNamespace)
}

export function buildCatalog(modules: Module[]): void {
  catalog.clear()
  put('pt-BR', 'core', corePtBR)
  put('en', 'core', coreEn)

  for (const mod of modules) {
    for (const [locale, dictionary] of Object.entries(mod.locales ?? {})) {
      put(locale, mod.id, dictionary)
    }
  }
}

/**
 * Deliberately small. What matters is the shape of `useT`, not the engine
 * behind it — swapping this for a full i18n library later changes nothing
 * in any module.
 */
export function translate(
  locale: string,
  namespace: string,
  key: string,
  vars?: Record<string, unknown>,
): string {
  const template =
    catalog.get(locale)?.get(namespace)?.[key] ??
    catalog.get(DEFAULT_LOCALE)?.get(namespace)?.[key] ??
    key

  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}
