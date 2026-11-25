import { toLocalISODate, useRecords, useT } from '@core/api'
import type { CalendarEvent } from './schema'

export function TodayAgenda() {
  const t = useT()
  const events = useRecords<CalendarEvent>('events', { where: { date: toLocalISODate() } })
  const sorted = [...events].sort((a, b) => (a.data.time ?? '').localeCompare(b.data.time ?? ''))
  return (
    <div className="to-widget">
      <p className="to-widget__value">{events.length}</p>
      <p className="to-muted">{t('widget.today.caption', { count: events.length })}</p>
      <ul className="to-widget__lines">
        {sorted.slice(0, 4).map((event) => (
          <li key={event.id}>
            {event.data.time ?? t('event.allDay')} · {event.data.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
