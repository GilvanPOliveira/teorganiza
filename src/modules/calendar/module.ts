import { Bell, CalendarDays } from 'lucide-react'
import { defineModule } from '@core/api'
import { eventSchema, type CalendarEvent } from './schema'
import { CalendarScreen, RemindersScreen } from './screens'
import { TodayAgenda } from './widgets'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'calendar',
  name: 'Agenda',
  apiVersion: 1,
  version: '0.1.0',
  icon: CalendarDays,

  collections: [
    {
      name: 'events',
      schema: eventSchema,
      schemaVersion: 1,
      describe: (record) => {
        const { title, date, time } = record.data as CalendarEvent
        return `${title} · ${date}${time ? ` ${time}` : ''}`
      },
      indexes: ['date', 'remind'],
      /** Grows with time, so it partitions by month like the ledger. */
      partition: (record) => (record.data as CalendarEvent).date.slice(0, 7),
    },
  ],

  routes: [
    {
      path: '',
      element: CalendarScreen,
      area: { id: 'calendar', label: 'Agenda', icon: CalendarDays, order: 40, tabLabel: 'Calendário' },
    },
    {
      path: 'reminders',
      element: RemindersScreen,
      area: { id: 'reminders', label: 'Lembretes', icon: Bell, order: 50, within: 'calendar/calendar' },
    },
  ],

  commands: [
    { id: 'new-event', label: 'Novo evento', path: '', keywords: ['evento', 'agenda', 'compromisso'] },
    { id: 'new-reminder', label: 'Novo lembrete', path: 'reminders', keywords: ['lembrete', 'aviso'] },
  ],

  widgets: [{ id: 'today', label: 'Agenda de hoje', size: 'sm', element: TodayAgenda }],

  provides: {
    /** Events and reminders, for the day summary. The agenda itself reads them directly. */
    dated: async (read, { from, to }) =>
      (await read<CalendarEvent>('events'))
        .filter((event) => event.data.date >= from && event.data.date <= to)
        .map((event) => ({
          id: event.id,
          date: event.data.date,
          time: event.data.time,
          title: event.data.title,
          kind: event.data.remind ? 'Lembrete' : 'Evento',
          path: event.data.remind ? 'reminders' : '',
        })),
  },

  locales: { 'pt-BR': ptBR },
})
