import { useLiveQuery } from 'dexie-react-hooks'
import { Card, EmptyState, Progress, Stat, StatGrid, Table } from '@core/api/ui'
import { getModule } from '@core/registry/registry'
import { daysAgo, readActivity } from './activity'
import { ModuleIcon } from './ModuleIcon'
import { useCoreT } from './useShell'

/** How much each module is used, from the envelopes alone. Shown inside the weekly review. */
export function UsageByModule() {
  const t = useCoreT()
  const week = useLiveQuery(() => readActivity(daysAgo(7)), [])
  const month = useLiveQuery(() => readActivity(daysAgo(30)), [])
  if (!week || !month) return null

  const rows = month
    .map((entry) => ({
      ...entry,
      week: week.find((w) => w.moduleId === entry.moduleId)?.touched ?? 0,
      module: getModule(entry.moduleId),
    }))
    .filter((row) => row.total > 0 || row.touched > 0)
    .sort((a, b) => b.touched - a.touched)
  const peak = Math.max(1, ...rows.map((row) => row.touched))

  return (
    <Card title={t('metrics.byModule')}>
      <p className="to-muted">{t('metrics.lead')}</p>
      <StatGrid>
        <Stat label={t('metrics.records')} value={month.reduce((sum, m) => sum + m.total, 0)} />
        <Stat label={t('metrics.week')} value={week.reduce((sum, w) => sum + w.touched, 0)} hint={t('metrics.weekHint')} />
        <Stat label={t('metrics.active')} value={rows.filter((row) => row.week > 0).length} hint={t('metrics.activeHint')} />
      </StatGrid>
      {rows.length === 0 ? (
        <EmptyState title={t('metrics.empty')} />
      ) : (
        <Table headers={[t('metrics.module'), t('metrics.records'), t('metrics.last7'), t('metrics.last30'), '']}>
          {rows.map((row) => (
            <tr key={row.moduleId}>
              <td>
                <span className="to-card__titleicon">
                  <ModuleIcon icon={row.module?.icon} label={row.module?.name ?? row.moduleId} size={15} />
                  {row.module?.name ?? row.moduleId}
                </span>
              </td>
              <td>{row.total}</td>
              <td>{row.week}</td>
              <td>{row.touched}</td>
              <td className="to-metrics__bar">
                <Progress value={row.touched} max={peak} label={row.module?.name} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
