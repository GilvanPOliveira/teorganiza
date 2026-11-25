import { createElement, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Search, X } from 'lucide-react'
import { Button, Card, EmptyState } from '@core/api/ui'
import { getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ModuleScope } from '@core/runtime/module-context'
import { Cover } from './Cover'
import { ModuleIcon } from './ModuleIcon'
import { enabledModules, greetingKey } from './navigation'
import { MOD_KEY, OPEN_PALETTE_EVENT } from './palette-event'
import { useCoreRecords, useCoreWriter } from './useCoreCollection'
import { useCoreT } from './useShell'

interface DashboardEntry {
  widget: string
  order: number
}

const COLUMNS: Record<string, number> = { sm: 2, md: 3, lg: 6 }

/**
 * The home: a greeting, one box to go anywhere, and the widgets the user
 * chose. Widgets are read-only plus a link — no forms, or every module ships
 * a mini-app onto the home screen and it turns to noise.
 *
 * The layout lives in `core/dashboard`, so it follows the user from phone
 * to desktop.
 */
export function Dashboard() {
  const t = useCoreT()
  const { locale, preferences } = useAppState()
  const [editing, setEditing] = useState(false)
  const [now] = useState(() => new Date())

  const entries = useCoreRecords<DashboardEntry>('dashboard', {
    sort: { field: 'order', dir: 'asc' },
  })
  const { create, remove } = useCoreWriter<DashboardEntry>('dashboard')

  const disabledKey = preferences.disabledModules.join(',')
  const available = useMemo(
    () =>
      enabledModules(getModules(), disabledKey ? disabledKey.split(',') : []).flatMap((mod) =>
        (mod.widgets ?? []).map((widget) => ({
          key: `${mod.id}/${widget.id}`,
          moduleId: mod.id,
          moduleName: mod.name,
          icon: mod.icon,
          widget,
        })),
      ),
    [disabledKey],
  )

  const chosen = entries
    .map((entry) => ({
      recordId: entry.id,
      found: available.find((candidate) => candidate.key === entry.data.widget),
    }))
    .filter((item) => item.found)

  const notChosen = available.filter(
    (candidate) => !entries.some((entry) => entry.data.widget === candidate.key),
  )

  const longDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)
  // Only the first letter: CSS capitalize would also turn "de" into "De".
  const today = longDate.charAt(0).toLocaleUpperCase(locale) + longDate.slice(1)

  return (
    <div className="to-home">
      <section className="to-hero">
        <Cover />
        <div className="to-hero__content">
          <h1 className="to-hero__greeting">{t(greetingKey(now.getHours()))}</h1>
          <p className="to-hero__date">{today}</p>
          <button
            type="button"
            className="to-hero__search"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
          >
            <Search size={17} aria-hidden />
            <span>{t('home.search')}</span>
            <kbd className="to-kbd">{MOD_KEY} K</kbd>
          </button>
        </div>
      </section>

      <section className="to-section">
        <header className="to-section__header">
          <h2 className="to-section__title">{t('home.today')}</h2>
          {available.length > 0 && (
            <Button variant="ghost" onClick={() => setEditing((value) => !value)}>
              {editing ? <Check size={15} /> : <Pencil size={15} />}
              {editing ? t('home.done') : t('home.customize')}
            </Button>
          )}
        </header>

        {chosen.length === 0 && !editing ? (
          <EmptyState
            title={t('dashboard.empty.title')}
            body={t('dashboard.empty.body')}
            action={
              available.length > 0 && (
                <Button variant="primary" onClick={() => setEditing(true)}>
                  <Plus size={15} />
                  {t('home.customize')}
                </Button>
              )
            }
          />
        ) : (
          <div className="to-grid">
            {chosen.map(({ recordId, found }) => (
              <div
                key={recordId}
                className="to-grid__cell"
                style={{ gridColumn: `span ${COLUMNS[found!.widget.size]}` }}
              >
                <Card
                  title={
                    <span className="to-card__titleicon">
                      <ModuleIcon icon={found!.icon} label={found!.moduleName} size={15} />
                      {found!.widget.label}
                    </span>
                  }
                  actions={
                    editing && (
                      <button
                        type="button"
                        className="to-iconbutton to-iconbutton--small"
                        aria-label={t('dashboard.remove')}
                        onClick={() => void remove(recordId)}
                      >
                        <X size={15} />
                      </button>
                    )
                  }
                >
                  <ModuleScope moduleId={found!.moduleId}>
                    {createElement(found!.widget.element)}
                  </ModuleScope>
                </Card>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="to-available">
            <h3 className="to-available__title">{t('dashboard.available')}</h3>
            {notChosen.length === 0 ? (
              <p className="to-muted">{t('home.allAdded')}</p>
            ) : (
              <ul className="to-available__list">
                {notChosen.map((candidate) => (
                  <li key={candidate.key}>
                    <span className="to-card__titleicon">
                      <ModuleIcon icon={candidate.icon} label={candidate.moduleName} size={16} />
                      {candidate.moduleName} · {candidate.widget.label}
                    </span>
                    <Button
                      onClick={() =>
                        void create({ widget: candidate.key, order: entries.length })
                      }
                    >
                      <Plus size={15} />
                      {t('dashboard.add')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
