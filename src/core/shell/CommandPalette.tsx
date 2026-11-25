import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Moon, PanelBottom, PanelLeft, Plus, Search, Sun } from 'lucide-react'
import { getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ModuleIcon } from './ModuleIcon'
import { filterPalette, type PaletteItem } from './navigation'
import type { ShellNavigation } from './useShell'
import { useCoreT } from './useShell'

type Item = PaletteItem & { icon: ReactNode }

/**
 * One box for going anywhere and doing the common things. Modules take part
 * only declaratively, through `commands`, which navigate to their own routes.
 */
export function CommandPalette({ nav, onClose }: { nav: ShellNavigation; onClose: () => void }) {
  const t = useCoreT()
  const navigate = useNavigate()
  const { theme, preferences, setPreferences } = useAppState()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => {
      navigate(path)
      onClose()
    }
    const enabled = new Set(nav.modules.map((m) => m.id))

    const actions: Item[] = getModules()
      .filter((mod) => enabled.has(mod.id))
      .flatMap((mod) =>
        (mod.commands ?? []).map((command) => ({
          id: `${mod.id}/${command.id}`,
          group: 'actions' as const,
          label: command.label,
          hint: mod.name,
          keywords: command.keywords,
          icon: <Plus size={16} />,
          run: go(`/${mod.id}/${command.path}`.replace(/\/$/, '')),
        })),
      )

    const places: Item[] = [nav.home, ...nav.modules, nav.settings, nav.trash].map((target) => ({
      id: `goto/${target.id}`,
      group: 'goto' as const,
      label: target.label,
      shortcut: target.shortcut,
      icon: <ModuleIcon icon={target.icon} label={target.label} size={16} />,
      run: go(target.path),
    }))

    const app: Item[] = [
      {
        id: 'app/theme',
        group: 'app',
        label: theme === 'dark' ? t('palette.themeLight') : t('palette.themeDark'),
        keywords: ['tema', 'theme', 'escuro', 'claro', 'dark', 'light'],
        icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
        run: () => {
          void setPreferences({ theme: theme === 'dark' ? 'light' : 'dark' })
          onClose()
        },
      },
      {
        id: 'app/navigation',
        group: 'app',
        label:
          preferences.navigation === 'dock' ? t('palette.useSidebar') : t('palette.useDock'),
        keywords: ['dock', 'sidebar', 'barra', 'lateral', 'menu'],
        icon: preferences.navigation === 'dock' ? <PanelLeft size={16} /> : <PanelBottom size={16} />,
        run: () => {
          void setPreferences({ navigation: preferences.navigation === 'dock' ? 'sidebar' : 'dock' })
          onClose()
        },
      },
    ]

    return [...actions, ...places, ...app]
  }, [nav, navigate, onClose, t, theme, preferences.navigation, setPreferences])

  const visible = filterPalette(items, query)
  const active = Math.min(cursor, Math.max(visible.length - 1, 0))

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      onClose()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = (active + step + visible.length) % Math.max(visible.length, 1)
      setCursor(next)
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      visible[active]?.run()
    }
  }

  const groups: Item['group'][] = ['actions', 'goto', 'app']

  return (
    <div className="to-palette__backdrop" onMouseDown={onClose}>
      <div
        className="to-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.open')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="to-palette__input">
          <Search size={17} aria-hidden />
          <input
            autoFocus
            value={query}
            placeholder={t('palette.placeholder')}
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            onKeyDown={onKeyDown}
            aria-label={t('palette.placeholder')}
          />
          <kbd className="to-kbd">Esc</kbd>
        </div>

        {visible.length === 0 ? (
          <p className="to-palette__empty">{t('palette.empty')}</p>
        ) : (
          <ul className="to-palette__list" ref={listRef} role="listbox">
            {groups.flatMap((group) => {
              const inGroup = visible.filter((item) => item.group === group)
              if (inGroup.length === 0) return []
              return [
                <li key={`h-${group}`} className="to-palette__group" role="presentation">
                  {t(`palette.group.${group}`)}
                </li>,
                ...inGroup.map((item) => {
                  const position = visible.indexOf(item)
                  const selected = position === active
                  return (
                    <li
                      key={item.id}
                      data-index={position}
                      role="option"
                      aria-selected={selected}
                      className={`to-palette__item${selected ? ' is-active' : ''}`}
                      onMouseEnter={() => setCursor(position)}
                      onClick={item.run}
                    >
                      <span className="to-palette__icon">{item.icon}</span>
                      <span className="to-palette__label">{item.label}</span>
                      {item.hint && <span className="to-palette__hint">{item.hint}</span>}
                      {item.shortcut && (
                        <kbd className="to-kbd to-kbd--quiet">G {item.shortcut.toUpperCase()}</kbd>
                      )}
                      {selected && <CornerDownLeft size={14} className="to-palette__enter" />}
                    </li>
                  )
                }),
              ]
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
