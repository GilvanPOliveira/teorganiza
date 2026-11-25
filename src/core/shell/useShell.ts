import { useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Hash, House, Settings, Trash2 } from 'lucide-react'
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
  tags: NavTarget
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
    const tagsLabel = t('nav.tags')
    const letters = assignShortcuts([
      ...modules.map((mod) => ({ id: mod.id, label: mod.name, preferred: mod.shortcut })),
      { id: 'settings', label: settingsLabel },
      { id: 'trash', label: trashLabel },
      { id: 'tags', label: tagsLabel },
    ])

    const home: NavTarget = {
      id: 'home',
      label: t('nav.home'),
      path: '/',
      icon: House,
      shortcut: HOME_SHORTCUT,
    }
    const moduleTargets = modules.map((mod) => ({
      id: mod.id,
      label: mod.name,
      path: `/${mod.id}`,
      icon: mod.icon,
      shortcut: letters.get(mod.id),
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

    return { home, modules: moduleTargets, settings, trash, tags, all: [home, ...moduleTargets, settings] }
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
