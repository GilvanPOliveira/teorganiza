import { createElement, useMemo } from 'react'
import { Button, Card, EmptyState } from '@core/api/ui'
import { translate } from '@core/i18n/catalog'
import { getModules } from '@core/registry/registry'
import { useAppState } from '@core/runtime/app-context'
import { ModuleScope } from '@core/runtime/module-context'
import { useCoreRecords, useCoreWriter } from './useCoreCollection'

interface DashboardEntry {
  widget: string
  order: number
}

const COLUMNS: Record<string, number> = { sm: 2, md: 3, lg: 6 }

/**
 * Widgets are read-only plus a link. No forms, no inline editing: otherwise
 * every new module ships a mini-app onto the home screen and it turns to noise.
 *
 * The user chooses which widgets and in what order; installing a module does
 * not fill the dashboard by itself. The layout lives in `core/dashboard`, so
 * it follows the user from phone to desktop.
 */
export function Dashboard() {
  const { locale } = useAppState()
  const t = (key: string, vars?: Record<string, unknown>) =>
    translate(locale, 'core', key, vars)

  const entries = useCoreRecords<DashboardEntry>('dashboard', {
    sort: { field: 'order', dir: 'asc' },
  })
  const { create, remove } = useCoreWriter<DashboardEntry>('dashboard')

  const available = useMemo(
    () =>
      getModules().flatMap((mod) =>
        (mod.widgets ?? []).map((widget) => ({
          key: `${mod.id}/${widget.id}`,
          moduleId: mod.id,
          moduleName: mod.name,
          widget,
        })),
      ),
    [],
  )

  const chosen = entries
    .map((entry) => ({
      recordId: entry.id,
      found: available.find((candidate) => candidate.key === entry.data.widget),
    }))
    .filter((item) => item.found)

  return (
    <div className="to-dashboard">
      {chosen.length === 0 ? (
        <EmptyState title={t('dashboard.empty.title')} body={t('dashboard.empty.body')} />
      ) : (
        <div className="to-grid">
          {chosen.map(({ recordId, found }) => (
            <div
              key={recordId}
              className="to-grid__cell"
              style={{ gridColumn: `span ${COLUMNS[found!.widget.size]}` }}
            >
              <Card
                title={found!.widget.label}
                actions={
                  <Button variant="ghost" onClick={() => void remove(recordId)}>
                    {t('dashboard.remove')}
                  </Button>
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

      {available.length > 0 && (
        <section className="to-available">
          <h2 className="to-available__title">{t('dashboard.available')}</h2>
          <ul className="to-available__list">
            {available
              .filter((candidate) => !entries.some((e) => e.data.widget === candidate.key))
              .map((candidate) => (
                <li key={candidate.key}>
                  <span>
                    {candidate.moduleName} · {candidate.widget.label}
                  </span>
                  <Button
                    onClick={() =>
                      void create({ widget: candidate.key, order: entries.length })
                    }
                  >
                    {t('dashboard.add')}
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}
