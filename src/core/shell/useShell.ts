import { useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarCheck, Hash, House, Settings, Trash2 } from 'lucide-react'
import { translate } from '@core/i18n/catalog'
import { getModule, getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import {
  assignShortcuts,
  areaTabs,
  enabledAreas,
  HOME_SHORTCUT,
  hostOf,
  moduleAreas,
  type ModuleArea,
  type NavTarget,
} from './navigation'

/** The core's own translations, for shell code outside any module scope. */
export function useCoreT(): (key: string, vars?: Record<string, unknown>) => string {
  const { locale } = useAppState()
  return useCallback(
    (key: string, vars?: Record<string, unknown>) => translate(locale, 'core', key, vars),
    [locale],
  )
}

/**
 * Areas the shell itself owns, placed among the modules' areas. The
 * review also carries the usage numbers that once had a page of their own.
 */
export const SHELL_AREAS = [
  { id: 'review', path: '/review', labelKey: 'nav.review', icon: CalendarCheck, order: 240 },
] as const

export interface ShellNavigation {
  home: NavTarget
  /** Module and shell areas the user left on, in navigation order. */
  areas: NavTarget[]
  /** Entries shown as tabs inside another area, labelled "Area · Tab" for search. */
  tabs: NavTarget[]
  /** Modules with at least one area on: their commands reach the palette. */
  enabledModuleIds: ReadonlySet<string>
  settings: NavTarget
  trash: NavTarget
  tags: NavTarget
  /** Home, the areas, then settings — the order of the dock. */
  all: NavTarget[]
}

export function useShellNavigation(): ShellNavigation {
  const t = useCoreT()
  const { preferences } = useAppState()
  const disabledKey = preferences.disabledModules.join(',')

  return useMemo(() => {
    const disabled = disabledKey ? disabledKey.split(',') : []
    const modules = getModules()
    const everyArea = modules.flatMap(moduleAreas)
    const enabled = enabledAreas(modules, disabled)
    // A tab whose host is off has nowhere to show.
    const guests = enabled.filter((area) => area.within && enabled.some((host) => host.id === area.within))
    const fromModules: (ModuleArea | (NavTarget & { order: number; moduleId: null }))[] = [
      ...enabled.filter((area) => !area.within),
      ...SHELL_AREAS.filter((area) => !disabled.includes(area.id)).map((area) => ({
        id: area.id,
        label: t(area.labelKey),
        path: area.path,
        icon: area.icon,
        order: area.order,
        moduleId: null,
      })),
    ].sort((a, b) => a.order - b.order)

    const settingsLabel = t('nav.settings')
    const trashLabel = t('nav.trash')
    const tagsLabel = t('nav.tags')
    const letters = assignShortcuts([
      ...fromModules.map((area) => ({
        id: area.id,
        label: area.label,
        preferred: 'shortcut' in area ? area.shortcut : undefined,
      })),
      { id: 'settings', label: settingsLabel },
      { id: 'trash', label: trashLabel },
      { id: 'tags', label: tagsLabel },
    ])

    const home: NavTarget = { id: 'home', label: t('nav.home'), path: '/', icon: House, shortcut: HOME_SHORTCUT }
    const areas: NavTarget[] = fromModules.map((area) => ({
      id: area.id,
      label: area.label,
      path: area.path,
      icon: area.icon,
      shortcut: letters.get(area.id),
    }))
    const place = (id: string, label: string, path: string, icon: NavTarget['icon']): NavTarget => ({
      id,
      label,
      path,
      icon,
      shortcut: letters.get(id),
    })
    const settings = place('settings', settingsLabel, '/settings', Settings)
    const trash = place('trash', trashLabel, '/settings/trash', Trash2)
    const tags = place('tags', tagsLabel, '/tags', Hash)
    const tabs: NavTarget[] = guests.map((area) => ({
      id: area.id,
      label: `${hostOf(area, everyArea).label} · ${area.tabLabel}`,
      path: area.path,
      icon: area.icon,
    }))
    const enabledModuleIds = new Set(
      [...fromModules, ...guests].flatMap((area) => (area.moduleId ? [area.moduleId] : [])),
    )

    return { home, areas, tabs, enabledModuleIds, settings, trash, tags, all: [home, ...areas, settings] }
  }, [t, disabledKey])
}

/**
 * The module the current URL belongs to, the matching route, and the area
 * it sits under (the route's own area, or the module's only one).
 */
export function useActiveRoute() {
  const { pathname } = useLocation()
  const { preferences } = useAppState()
  const [, first = '', ...rest] = pathname.split('/')
  const active = getModule(first)
  if (!active) return { active: undefined, route: undefined, area: undefined, host: undefined, tabs: [], section: first }

  const relative = rest.join('/')
  const route =
    active.routes.find((r) => r.path === relative) ?? active.routes.find((r) => r.path === '')
  const areas = moduleAreas(active)
  // A sub-page (a project, a note being edited) stays under the area whose
  // path it extends; the longest match wins, so '/lists' does not grab
  // '/lists/projects/…'.
  const area =
    areas.length === 1
      ? areas[0]
      : (areas.find((candidate) => route?.area && candidate.id === `${active.id}/${route.area.id}`) ??
        [...areas]
          .filter((candidate) => pathname === candidate.path || pathname.startsWith(`${candidate.path}/`))
          .sort((a, b) => b.path.length - a.path.length)[0])

  // An entry shown as a tab answers to its host: the title, the lit menu
  // item and the tab bar all belong to the host.
  const modules = getModules()
  const host = area && hostOf(area, modules.flatMap(moduleAreas))
  const tabs = host ? areaTabs(host, enabledAreas(modules, preferences.disabledModules)) : []

  return { active, route, area, host, tabs, section: first }
}
