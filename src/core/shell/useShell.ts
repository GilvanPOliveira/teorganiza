import { useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { House, Settings, Trash2 } from 'lucide-react'
import { translate } from '@core/i18n/catalog'
import { getModule, getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { assignShortcuts, enabledModules, HOME_SHORTCUT, type NavTarget } from './navigation'

/** The core's own translations, for shell code outside any module scope. */
export function useCoreT(): (key: string, vars?: Record<string, unknown>) => string {
  const { locale } = useAppState()
  return useCallback(
    (key: string, vars?: Record<string, unknown>) => translate(locale, 'core', key, vars),
    [locale],
  )
}

export interface ShellNavigation {
  home: NavTarget
  modules: NavTarget[]
  settings: NavTarget
  trash: NavTarget
  /** Home, then modules, then settings — the order of the dock. */
  all: NavTarget[]
}

export function useShellNavigation(): ShellNavigation {
  const t = useCoreT()
  const { preferences } = useAppState()
  const disabledKey = preferences.disabledModules.join(',')

  return useMemo(() => {
    const modules = enabledModules(getModules(), disabledKey ? disabledKey.split(',') : [])
    const settingsLabel = t('nav.settings')
    const trashLabel = t('nav.trash')
    const letters = assignShortcuts([
      ...modules.map((mod) => ({ id: mod.id, label: mod.name, preferred: mod.shortcut })),
      { id: 'settings', label: settingsLabel },
      { id: 'trash', label: trashLabel },
    ])

    const home: NavTarget = { id: 'home', label: t('nav.home'), path: '/', icon: House, shortcut: HOME_SHORTCUT }
    const moduleTargets = modules.map((mod) => ({
      id: mod.id,
      label: mod.name,
      path: `/${mod.id}`,
      icon: mod.icon,
      shortcut: letters.get(mod.id),
    }))
    const settings: NavTarget = { id: 'settings', label: settingsLabel, path: '/settings', icon: Settings, shortcut: letters.get('settings') }
    const trash: NavTarget = { id: 'trash', label: trashLabel, path: '/settings/trash', icon: Trash2, shortcut: letters.get('trash') }

    return { home, modules: moduleTargets, settings, trash, all: [home, ...moduleTargets, settings] }
  }, [t, disabledKey])
}

/** The module the current URL belongs to, and the matching route. */
export function useActiveRoute() {
  const { pathname } = useLocation()
  const [, first = '', ...rest] = pathname.split('/')
  const active = getModule(first)
  if (!active) return { active: undefined, route: undefined, section: first }

  const relative = rest.join('/')
  const route =
    active.routes.find((r) => r.path === relative) ?? active.routes.find((r) => r.path === '')

  return { active, route, section: first }
}
