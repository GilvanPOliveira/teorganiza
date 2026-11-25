import { toLocalISODate, useRecords, useT } from '@core/api'
import type { Item } from './schema'

/** Read-only plus a link, by contract. */
export function TodayTasks() {
  const t = useT()
  const today = toLocalISODate()
  const items = useRecords<Item>('items', { where: { done: false } })
  const due = items.filter((item) => item.data.due !== null && item.data.due <= today)
  return (
    <div className="to-widget">
      <p className="to-widget__value">{due.length}</p>
      <p className="to-muted">{t('widget.today.caption', { count: due.length })}</p>
      <ul className="to-widget__lines">
        {due.slice(0, 4).map((item) => (
          <li key={item.id}>{item.data.title}</li>
        ))}
      </ul>
    </div>
  )
}
