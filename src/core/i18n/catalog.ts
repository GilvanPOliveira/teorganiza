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
  const lookup = (k: string) =>
    catalog.get(locale)?.get(namespace)?.[k] ?? catalog.get(DEFAULT_LOCALE)?.get(namespace)?.[k]

  // Singular, when the catalog has one: "{count} itens" / "1 item".
  // pt-BR and en only distinguish one from the rest.
  const singular = vars?.count === 1 ? lookup(`${key}.one`) : undefined
  const template = singular ?? lookup(key) ?? key

  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? formatVar(vars[name], locale) : match,
  )
}

/** Whole numbers stay as written (years, counts); decimals take the locale's comma or point. */
function formatVar(value: unknown, locale: string): string {
  if (typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
  }
  return String(value)
}
