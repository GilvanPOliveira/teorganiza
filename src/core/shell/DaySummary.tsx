import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Bell, Bot, CalendarClock, Check, ExternalLink, Sun } from 'lucide-react'
import { toLocalISODate } from '@core/api/dates'
import { useDated, useOpenHref } from '@core/api/hooks'
import { Badge, Button, Card, EmptyState } from '@core/api/ui'
import { openNex } from '@core/nex/key'
import type { CollectedDated } from '@core/providers/collect'
import { getModule } from '@core/registry/registry'
import { daysAgo, readActivity } from './activity'
import { useNexKey } from './NexPanel'
import { notificationsSupported, requestNotifications } from './notifier'
import { useCoreT } from './useShell'

function shiftDay(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return toLocalISODate(new Date(year, month - 1, day + days))
}

function EntryList({ entries, showDate }: { entries: CollectedDated[]; showDate?: boolean }) {
  const open = useOpenHref()
  return (
    <ul className="to-list">
      {entries.map((entry) => (
        <li key={entry.key} className={`to-list__item${entry.done ? ' is-done' : ''}`}>
          <button type="button" className="to-list__main to-rowbutton" onClick={() => open(entry.href)}>
            <span className="to-list__title">
              {entry.done && <Check size={13} aria-hidden />} {entry.title}
            </span>
            <span className="to-list__meta">
              <Badge>{entry.kind}</Badge>
              {showDate && <span>{entry.date.split('-').reverse().join('/')}</span>}
              {entry.time && <span>{entry.time}</span>}
            </span>
          </button>
          <ExternalLink size={13} className="to-muted" aria-hidden />
        </li>
      ))}
    </ul>
  )
}

/**
 * The day, put together from what every area offers: what is late, what
 * is today, what comes this week, and what was recorded since yesterday.
 * Built from the user's own records only; nothing is fetched.
 */
export function DaySummary() {
  const t = useCoreT()
  const apiKey = useNexKey()
  const today = toLocalISODate()
  const [permission, setPermission] = useState(() =>
    notificationsSupported() ? Notification.permission : 'unsupported',
  )

  const late = useDated('2000-01-01', shiftDay(today, -1)).filter((entry) => entry.done === false)
  const now = useDated(today, today)
  const next = useDated(shiftDay(today, 1), shiftDay(today, 7))
  const activity = useLiveQuery(() => readActivity(daysAgo(1)), []) ?? []
  const recorded = activity.filter((entry) => entry.touched > 0).sort((a, b) => b.touched - a.touched)

  return (
    <div className="to-stack">
      <div className="to-toolbar">
        {apiKey && (
          <Button onClick={() => openNex(t('summary.nexPrompt'))}>
            <Bot size={15} />
            {t('summary.nex')}
          </Button>
        )}
        {permission === 'default' && (
          <Button onClick={() => void requestNotifications().then(setPermission)}>
            <Bell size={15} />
            {t('summary.notify')}
          </Button>
        )}
      </div>

      {late.length > 0 && (
        <Card title={<span className="to-card__titleicon"><AlertTriangle size={15} />{t('summary.late', { count: late.length })}</span>}>
          <EntryList entries={late} showDate />
        </Card>
      )}

      <Card title={<span className="to-card__titleicon"><Sun size={15} />{t('summary.today')}</span>}>
        {now.length === 0 ? <EmptyState title={t('summary.today.empty')} body={t('summary.today.body')} /> : <EntryList entries={now} />}
      </Card>

      {next.length > 0 && (
        <Card title={<span className="to-card__titleicon"><CalendarClock size={15} />{t('summary.next')}</span>}>
          <EntryList entries={next} showDate />
        </Card>
      )}

      {recorded.length > 0 && (
        <Card title={t('summary.recorded')}>
          <p className="to-muted">
            {recorded
              .map((entry) => `${getModule(entry.moduleId)?.name ?? entry.moduleId}: ${entry.touched}`)
              .join(' · ')}
          </p>
        </Card>
      )}
    </div>
  )
}
