import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { createElement } from 'react'
import { translate } from '@core/i18n/catalog'
import { getModule, getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ModuleScope } from '@core/runtime/module-context'
import { SyncDialogs, SyncStatus } from './SyncPanels'

/**
 * Everything around a module. The shell knows no module by name: the
 * navigation, the routes and the top bar are all derived from the registry.
 */
export function Shell() {
  const { locale, theme } = useAppState()
  const t = (key: string, vars?: Record<string, unknown>) =>
    translate(locale, 'core', key, vars)
  const { active, route } = useActiveRoute()

  return (
    <div className="to-shell" data-theme={theme}>
      <nav className="to-nav" aria-label={t('nav.dashboard')}>
        <span className="to-nav__brand">{t('app.name')}</span>
        <NavLink to="/" end className="to-nav__item">
          {t('nav.dashboard')}
        </NavLink>
        {getModules().map((mod) => (
          <NavLink key={mod.id} to={`/${mod.id}`} className="to-nav__item">
            {mod.name}
          </NavLink>
        ))}
        <NavLink to="/settings" className="to-nav__item to-nav__item--last">
          {t('nav.settings')}
        </NavLink>
      </nav>

      <div className="to-main">
        <header className="to-topbar">
          <h1 className="to-topbar__title">
            {active ? active.name : t('dashboard.title')}
          </h1>
          <div className="to-topbar__actions">
            {active && route?.actions && (
              <ModuleScope moduleId={active.id}>
                {createElement(route.actions)}
              </ModuleScope>
            )}
          </div>
        </header>

        {active && active.routes.some((r) => r.label) && (
          <nav className="to-subnav">
            {active.routes
              .filter((r) => r.label)
              .map((r) => (
                <NavLink
                  key={r.path}
                  end={r.path === ''}
                  to={`/${active.id}/${r.path}`.replace(/\/$/, '')}
                  className="to-subnav__item"
                >
                  {r.label}
                </NavLink>
              ))}
          </nav>
        )}

        <main className="to-content">
          <Outlet />
        </main>

        <StatusBar />
      </div>

      <SyncDialogs />
    </div>
  )
}

function useActiveRoute() {
  const { pathname } = useLocation()
  const [, first = '', ...rest] = pathname.split('/')
  const active = getModule(first)
  if (!active) return { active: undefined, route: undefined }

  const relative = rest.join('/')
  const route =
    active.routes.find((r) => r.path === relative) ??
    active.routes.find((r) => r.path === '')

  return { active, route }
}

function StatusBar() {
  const { storage } = useAppState()
  const noDestination = storage.kind === null

  return (
    <footer className={`to-status${noDestination ? ' to-status--warning' : ''}`}>
      <SyncStatus />
    </footer>
  )
}
