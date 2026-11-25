import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Search, Settings } from 'lucide-react'
import { Button, EmptyState } from '@core/api/ui'
import { useAppState } from '@core/runtime/app-context'
import { ModuleScope } from '@core/runtime/module-context'
import { CommandPalette } from './CommandPalette'
import { Logo } from './Logo'
import { MOD_KEY, OPEN_PALETTE_EVENT } from './palette-event'
import { ModuleIcon } from './ModuleIcon'
import type { NavTarget } from './navigation'
import { SyncDialogs, SyncStatus } from './SyncPanels'
import { useActiveRoute, useCoreT, useShellNavigation } from './useShell'

/** Phones show this many dock items; the rest go under "more". */
const MOBILE_DOCK_ITEMS = 4

/**
 * Everything around a module. The shell knows no module by name: the
 * navigation, the routes and the top bar are all derived from the registry
 * and from which modules the user left on.
 */
export function Shell() {
  const { preferences } = useAppState()
  const nav = useShellNavigation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const shortcutTargets = useMemo(() => [...nav.all, nav.trash, nav.tags], [nav])
  useShortcuts(shortcutTargets, openPalette)

  const sidebar = preferences.navigation === 'sidebar'

  return (
    <div className={`to-app ${sidebar ? 'to-app--sidebar' : 'to-app--dock'}`}>
      {sidebar && <Sidebar targets={nav.all} />}

      <div className="to-main">
        <TopBar onSearch={openPalette} />
        <main className="to-content">
          <ActiveScreen />
        </main>
        <StatusBar />
      </div>

      <Dock targets={nav.all} desktopHidden={sidebar} />
      {paletteOpen && <CommandPalette nav={nav} onClose={() => setPaletteOpen(false)} />}
      <SyncDialogs />
    </div>
  )
}

function TopBar({ onSearch }: { onSearch: () => void }) {
  const t = useCoreT()
  const { active, area } = useActiveRoute()

  return (
    <header className="to-topbar">
      {/* Hidden on desktop when the sidebar shows the brand; phones never have the sidebar. */}
      <Link to="/" className="to-topbar__brand" aria-label={t('app.name')}>
        <Logo size={26} />
      </Link>
      {active && <span className="to-topbar__crumb">/ {area?.label ?? active.name}</span>}

      <div className="to-topbar__end">
        <button type="button" className="to-search" onClick={onSearch}>
          <Search size={15} aria-hidden />
          <span className="to-search__text">{t('palette.open')}</span>
          <kbd className="to-kbd">{MOD_KEY} K</kbd>
        </button>
        <NavLink to="/settings" end className="to-iconbutton" aria-label={t('nav.settings')}>
          <Settings size={17} />
        </NavLink>
      </div>
    </header>
  )
}

/** What the current URL shows: a module screen, or the shell's own pages. */
function ActiveScreen() {
  const t = useCoreT()
  const { preferences } = useAppState()
  const { active, route, area } = useActiveRoute()

  if (!active) return <Outlet />

  const title = area?.label ?? active.name
  const off = preferences.disabledModules
  if (off.includes(active.id) || (area && off.includes(area.id))) {
    return (
      <EmptyState
        title={t('modules.disabled.title', { name: title })}
        body={t('modules.disabled.body')}
        action={
          <Link to="/settings">
            <Button>{t('nav.settings')}</Button>
          </Link>
        }
      />
    )
  }

  // Areas live in the main navigation; tabs are for the rest.
  const tabs = active.routes.filter((r) => r.label && !r.area)

  return (
    <div className="to-page">
      <header className="to-page__header">
        <div className="to-page__title">
          <ModuleIcon icon={area?.icon ?? active.icon} label={title} size={20} boxed />
          <h1>{title}</h1>
        </div>
        {route?.actions && (
          <div className="to-page__actions">
            <ModuleScope moduleId={active.id}>{createElement(route.actions)}</ModuleScope>
          </div>
        )}
      </header>

      {tabs.length > 1 && (
        <nav className="to-tabs">
          {tabs.map((r) => (
            <NavLink
              key={r.path}
              end={r.path === ''}
              to={`/${active.id}/${r.path}`.replace(/\/$/, '')}
              className="to-tabs__item"
            >
              {r.label}
            </NavLink>
          ))}
        </nav>
      )}

      <Outlet />
    </div>
  )
}

function Sidebar({ targets }: { targets: NavTarget[] }) {
  const t = useCoreT()
  const places = targets.slice(0, -1)
  const settings = targets[targets.length - 1]
  return (
    <aside className="to-sidebar">
      <Link to="/" className="to-sidebar__brand">
        <Logo size={26} />
        <span>{t('app.name')}</span>
      </Link>
      <nav className="to-sidebar__nav" aria-label={t('nav.main')}>
        {places.map((target) => (
          <SidebarLink key={target.id} target={target} targets={targets} />
        ))}
      </nav>
      <div className="to-sidebar__end">
        <SidebarLink target={settings} targets={targets} />
      </div>
    </aside>
  )
}

function SidebarLink({ target, targets }: { target: NavTarget; targets: NavTarget[] }) {
  return (
    <NavLink to={target.path} end={exactMatch(target, targets)} className="to-sidebar__item">
      <ModuleIcon icon={target.icon} label={target.label} size={17} />
      <span>{target.label}</span>
      {target.shortcut && (
        <kbd className="to-kbd to-kbd--quiet">G {target.shortcut.toUpperCase()}</kbd>
      )}
    </NavLink>
  )
}

/**
 * Floating on desktop, a bottom bar on phones. On phones the first items
 * stay and the rest open from "more", so the bar never scrolls.
 */
function Dock({ targets, desktopHidden }: { targets: NavTarget[]; desktopHidden: boolean }) {
  const t = useCoreT()
  const { pathname } = useLocation()
  const [moreOpenAt, setMoreOpenAt] = useState<string | null>(null)
  // The sheet belongs to the page it was opened on: navigating closes it.
  const moreOpen = moreOpenAt === pathname
  const overflow = targets.slice(MOBILE_DOCK_ITEMS)

  return (
    <>
      <nav
        className={`to-dock${desktopHidden ? ' to-dock--mobile-only' : ''}`}
        aria-label={t('nav.main')}
      >
        {targets.map((target, index) => (
          <NavLink
            key={target.id}
            to={target.path}
            end={exactMatch(target, targets)}
            className={`to-dock__item${index >= MOBILE_DOCK_ITEMS ? ' to-dock__item--desktop' : ''}`}
            title={
              target.shortcut ? `${target.label} · G ${target.shortcut.toUpperCase()}` : target.label
            }
          >
            <ModuleIcon icon={target.icon} label={target.label} size={19} />
            <span className="to-dock__label">{target.label}</span>
          </NavLink>
        ))}
        {overflow.length > 0 && (
          <button
            type="button"
            className="to-dock__item to-dock__item--mobile"
            onClick={() => setMoreOpenAt(moreOpen ? null : pathname)}
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={19} />
            <span className="to-dock__label">{t('nav.more')}</span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="to-sheet__backdrop" onClick={() => setMoreOpenAt(null)}>
          <div className="to-sheet" onClick={(event) => event.stopPropagation()}>
            {overflow.map((target) => (
              <NavLink key={target.id} to={target.path} className="to-sheet__item">
                <ModuleIcon icon={target.icon} label={target.label} size={18} />
                <span>{target.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  )
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

/**
 * Ctrl/⌘+K opens the palette anywhere. "G" then a letter jumps to a place,
 * but never while the user is typing in a field.
 */
function useShortcuts(targets: NavTarget[], openPalette: () => void) {
  const navigate = useNavigate()

  useEffect(() => {
    let pendingG = 0

    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openPalette()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return

      const key = event.key.toLowerCase()
      if (pendingG && Date.now() - pendingG < 1500) {
        pendingG = 0
        const target = targets.find((item) => item.shortcut === key)
        if (target) {
          event.preventDefault()
          navigate(target.path)
        }
        return
      }
      if (key === 'g') pendingG = Date.now()
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, openPalette)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, openPalette)
    }
  }, [targets, openPalette, navigate])
}

/**
 * A link is active only on its exact path when another entry lives under
 * it: Tarefas is '/lists', and must not light up on '/lists/kanban'.
 */
function exactMatch(target: NavTarget, targets: NavTarget[]): boolean {
  return target.path === '/' || targets.some((other) => other !== target && other.path.startsWith(`${target.path}/`))
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
