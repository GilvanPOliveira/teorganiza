import { useMemo, useState } from 'react'
import { Bell, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  QuickAdd,
  parseDate,
  toLocalISODate,
  useAppContext,
  useCollection,
  useFormat,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import { monthGrid } from './month'
import type { CalendarEvent } from './schema'

function byTime(a: Envelope<CalendarEvent>, b: Envelope<CalendarEvent>) {
  return `${a.data.date}${a.data.time ?? '00:00'}`.localeCompare(`${b.data.date}${b.data.time ?? '00:00'}`)
}

function EventRow({ event, showDate }: { event: Envelope<CalendarEvent>; showDate?: boolean }) {
  const t = useT()
  const format = useFormat()
  const { update, remove } = useCollection<CalendarEvent>('events')
  return (
    <li className="to-list__item">
      <div className="to-list__main">
        <span className="to-list__title">{event.data.title}</span>
        <span className="to-list__meta">
          {showDate && <span>{format.date(event.data.date)}</span>}
          <Badge tone="accent">{event.data.time ?? t('event.allDay')}</Badge>
          {event.data.remind && (
            <Badge>
              <Bell size={11} />
              {t('event.reminder')}
            </Badge>
          )}
        </span>
      </div>
      <div className="to-list__actions">
        <button
          type="button"
          className="to-iconbutton to-iconbutton--small"
          aria-label={event.data.remind ? t('event.unremind') : t('event.remind')}
          onClick={() => void update(event.id, { remind: !event.data.remind })}
        >
          <Bell size={14} />
        </button>
        <button
          type="button"
          className="to-iconbutton to-iconbutton--small"
          aria-label={t('event.remove')}
          onClick={() => void remove(event.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}

function useAddEvent() {
  const { create } = useCollection<CalendarEvent>('events')
  return (title: string, date: string, time: string, remind: boolean) =>
    create({ title, date, time: time || null, remind, note: '' })
}

export function CalendarScreen() {
  const t = useT()
  const { locale } = useAppContext()
  const today = toLocalISODate()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  const [time, setTime] = useState('')
  const add = useAddEvent()

  const grid = monthGrid(cursor.year, cursor.month)
  const events = useRecords<CalendarEvent>('events', {
    where: { date: { gte: grid[0].date, lte: grid[grid.length - 1].date } },
  })
  const byDay = useMemo(() => {
    const map = new Map<string, Envelope<CalendarEvent>[]>()
    for (const event of [...events].sort(byTime)) {
      map.set(event.data.date, [...(map.get(event.data.date) ?? []), event])
    }
    return map
  }, [events])

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(cursor.year, cursor.month, 1),
  )
  // 1 November 2026 is a Sunday: seven days from it name the week's columns.
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 10, 1 + index)),
  )
  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  const dayEvents = byDay.get(selected) ?? []
  const selectedLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parseDate(selected))

  return (
    <div className="to-stack">
      <div className="to-toolbar to-toolbar--center">
        <Button variant="ghost" aria-label={t('month.previous')} onClick={() => shift(-1)}>
          <ChevronLeft size={16} />
        </Button>
        <strong className="to-capitalize-first">{monthLabel}</strong>
        <Button variant="ghost" aria-label={t('month.next')} onClick={() => shift(1)}>
          <ChevronRight size={16} />
        </Button>
        <Button
          onClick={() => {
            const now = new Date()
            setCursor({ year: now.getFullYear(), month: now.getMonth() })
            setSelected(today)
          }}
        >
          {t('month.today')}
        </Button>
      </div>

      <div className="to-calendar">
        {weekdays.map((day) => (
          <div key={day} className="to-calendar__head">
            {day}
          </div>
        ))}
        {grid.map(({ date, inMonth }) => (
          <button
            key={date}
            type="button"
            className={[
              'to-calendar__day',
              !inMonth && 'is-outside',
              date === today && 'is-today',
              date === selected && 'is-selected',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setSelected(date)}
          >
            <span className="to-calendar__num">{Number(date.slice(8))}</span>
            {(byDay.get(date) ?? []).slice(0, 3).map((event) => (
              <span key={event.id} className="to-calendar__event">
                {event.data.time && `${event.data.time} `}
                {event.data.title}
              </span>
            ))}
          </button>
        ))}
      </div>

      <h2 className="to-section-title to-capitalize-first">{selectedLabel}</h2>
      <QuickAdd
        placeholder={t('event.placeholder')}
        onAdd={async (title) => void (await add(title, selected, time, false))}
      >
        <input
          type="time"
          className="to-field__input"
          value={time}
          aria-label={t('event.time')}
          onChange={(event) => setTime(event.target.value)}
        />
      </QuickAdd>
      {dayEvents.length === 0 ? (
        <p className="to-muted">{t('day.empty')}</p>
      ) : (
        <ul className="to-list">
          {dayEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function RemindersScreen() {
  const t = useT()
  const today = toLocalISODate()
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('09:00')
  const add = useAddEvent()
  const reminders = useRecords<CalendarEvent>('events', { where: { remind: true } }).sort(byTime)
  const upcoming = reminders.filter((event) => event.data.date >= today)
  const past = reminders.filter((event) => event.data.date < today).reverse().slice(0, 10)

  return (
    <div className="to-stack">
      <p className="to-muted">{t('reminders.note')}</p>
      <QuickAdd
        placeholder={t('reminders.placeholder')}
        onAdd={async (title) => void (await add(title, date, time, true))}
      >
        <input
          type="date"
          className="to-field__input"
          value={date}
          aria-label={t('event.date')}
          onChange={(event) => setDate(event.target.value)}
        />
        <input
          type="time"
          className="to-field__input"
          value={time}
          aria-label={t('event.time')}
          onChange={(event) => setTime(event.target.value)}
        />
      </QuickAdd>
      {upcoming.length === 0 ? (
        <EmptyState title={t('reminders.empty.title')} body={t('reminders.empty.body')} />
      ) : (
        <ul className="to-list">
          {upcoming.map((event) => (
            <EventRow key={event.id} event={event} showDate />
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <>
          <h2 className="to-section-title">{t('reminders.past')}</h2>
          <ul className="to-list">
            {past.map((event) => (
              <EventRow key={event.id} event={event} showDate />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
