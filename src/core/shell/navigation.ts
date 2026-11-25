import type { ComponentType } from 'react'
import type { IconProps, Module } from '@core/api/types'

/** One place the user can go: the home, a module, settings, the trash. */
export interface NavTarget {
  id: string
  label: string
  path: string
  icon?: ComponentType<IconProps>
  /** Letter for "G then letter". */
  shortcut?: string
}

export const HOME_SHORTCUT = 'i'

/** Lowercase, no accents, letters only: "Finanças" -> "financas". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Hands out one letter per target. Declared letters win, in order; the rest
 * take the first free letter of their label. Home always keeps its letter.
 * A target with no free letter simply has no shortcut.
 */
export function assignShortcuts(
  targets: { id: string; label: string; preferred?: string }[],
): Map<string, string> {
  const taken = new Set<string>([HOME_SHORTCUT])
  const result = new Map<string, string>()

  for (const target of targets) {
    if (target.preferred && !taken.has(target.preferred)) {
      taken.add(target.preferred)
      result.set(target.id, target.preferred)
    }
  }
  for (const target of targets) {
    if (result.has(target.id)) continue
    const letter = [...normalize(target.label)].find((c) => /[a-z]/.test(c) && !taken.has(c))
    if (letter) {
      taken.add(letter)
      result.set(target.id, letter)
    }
  }
  return result
}

/** Modules the user left on, in registration order. */
export function enabledModules(modules: Module[], disabled: readonly string[]): Module[] {
  return modules.filter((mod) => !disabled.includes(mod.id))
}

export interface PaletteItem {
  id: string
  group: 'actions' | 'goto' | 'app'
  label: string
  hint?: string
  keywords?: string[]
  shortcut?: string
  run: () => void
}

/**
 * Every word typed must appear somewhere in the label, hint or keywords.
 * Plain and predictable: what you type is what narrows the list.
 */
export function filterPalette<T extends Omit<PaletteItem, 'run'>>(items: T[], query: string): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return items
  return items.filter((item) => {
    const haystack = normalize([item.label, item.hint ?? '', ...(item.keywords ?? [])].join(' '))
    return words.every((word) => haystack.includes(word))
  })
}

/** Greeting by the hour: 5–11 morning, 12–17 afternoon, otherwise evening. */
export function greetingKey(hour: number): 'home.morning' | 'home.afternoon' | 'home.evening' {
  if (hour >= 5 && hour < 12) return 'home.morning'
  if (hour >= 12 && hour < 18) return 'home.afternoon'
  return 'home.evening'
}
