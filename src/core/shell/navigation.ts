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

/** Room for one dock icon plus its gap, and the space kept free above and below the dock. */
const DOCK_CELL = 48
const DOCK_RESERVED = 64 + 16 + 12

/**
 * The left dock never scrolls: when its icons do not fit the window's
 * height, it grows a second column, then a third. Rows are balanced so the
 * last column is not left with a single icon.
 */
export function dockLayout(count: number, height: number): { columns: number; rows: number } {
  const fit = Math.max(1, Math.floor((height - DOCK_RESERVED) / DOCK_CELL))
  const columns = Math.max(1, Math.ceil(count / fit))
  return { columns, rows: Math.ceil(count / columns) }
}

/** Greeting by the hour: 5–11 morning, 12–17 afternoon, otherwise evening. */
export function greetingKey(hour: number): 'home.morning' | 'home.afternoon' | 'home.evening' {
  if (hour >= 5 && hour < 12) return 'home.morning'
  if (hour >= 12 && hour < 18) return 'home.afternoon'
  return 'home.evening'
}

/** One entry of the navigation that belongs to a module. */
export interface ModuleArea {
  /** The module id for a single-area module, '<moduleId>/<areaId>' otherwise. */
  id: string
  moduleId: string
  label: string
  path: string
  icon?: NavTarget['icon']
  order: number
  shortcut?: string
}

const DEFAULT_ORDER = 1000

/**
 * A module without areas is one entry, its root. A module with areas is
 * as many entries as it declares, and its root is not one of them.
 */
export function moduleAreas(mod: Module): ModuleArea[] {
  const declared = mod.routes.filter((route) => route.area)
  if (declared.length === 0) {
    return [
      {
        id: mod.id,
        moduleId: mod.id,
        label: mod.name,
        path: `/${mod.id}`,
        icon: mod.icon,
        order: mod.order ?? DEFAULT_ORDER,
        shortcut: mod.shortcut,
      },
    ]
  }
  return declared.map((route) => ({
    id: `${mod.id}/${route.area!.id}`,
    moduleId: mod.id,
    label: route.area!.label,
    path: `/${mod.id}/${route.path}`.replace(/\/$/, ''),
    icon: route.area!.icon ?? mod.icon,
    order: route.area!.order ?? mod.order ?? DEFAULT_ORDER,
    shortcut: route.area!.shortcut,
  }))
}

/**
 * Every area of every module, minus the ones the user turned off, in
 * navigation order. Turning a whole module off (its id in the list) hides
 * all of its areas, which keeps preferences saved before areas existed.
 */
export function enabledAreas(modules: Module[], disabled: readonly string[]): ModuleArea[] {
  return modules
    .flatMap(moduleAreas)
    .filter((area) => !disabled.includes(area.id) && !disabled.includes(area.moduleId))
    .sort((a, b) => a.order - b.order)
}
