import { useState } from 'react'
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import { Button, EmptyState, toLocalISODate, useCollection, useFormat, useNavigate, useParams, useT } from '@core/api'
import { useSessions } from './data'
import { clock, doneSets, sessionVolume } from './logic'
import type { Session } from './schema'
import { Records } from './today'
import { WorkoutLog } from './workout'

export function HistoryScreen() {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const sessions = useSessions().filter((s) => s.data.finishedAt)
  const { create } = useCollection<Session>('sessions')
  const [date, setDate] = useState(toLocalISODate())

  // A workout done on paper: logged afterwards, already finished.
  const logPast = async () => {
    const id = await create({
      date,
      name: t('history.pastName'),
      routineId: null,
      startedAt: null,
      finishedAt: `${date}T12:00:00.000Z`,
      note: '',
      entries: [],
    })
    navigate(`history/${id}`)
  }

  const months = new Map<string, typeof sessions>()
  for (const s of sessions) months.set(s.data.date.slice(0, 7), [...(months.get(s.data.date.slice(0, 7)) ?? []), s])

  return (
    <div className="to-stack">
      <div className="to-toolbar">
        <input type="date" className="to-field__input" value={date} max={toLocalISODate()} aria-label={t('history.date')} onChange={(e) => setDate(e.target.value)} />
        <Button onClick={() => void logPast()} disabled={!date}>
          <Plus size={15} />
          {t('history.logPast')}
        </Button>
      </div>
      {sessions.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('history.emptyBody')} />
      ) : (
        [...months.entries()].map(([month, list]) => (
          <section key={month} className="to-stack to-stack--tight">
            <h2 className="to-section-title">
              {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00`))} · {list.length}
            </h2>
            <ul className="to-list">
              {list.map((s) => {
                const duration = s.data.startedAt && s.data.finishedAt ? (Date.parse(s.data.finishedAt) - Date.parse(s.data.startedAt)) / 1000 : null
                return (
                  <li key={s.id} className="to-list__item">
                    <button type="button" className="to-list__main to-rowbutton" onClick={() => navigate(`history/${s.id}`)}>
                      <span className="to-list__title">{s.data.name}</span>
                      <span className="to-list__meta">
                        <span>{format.date(s.data.date)}</span>
                        <span>{t('history.exercises', { count: s.data.entries.length })}</span>
                        <span>{t('history.sets', { count: doneSets(s.data) })}</span>
                        <span>{sessionVolume(s.data).toLocaleString('pt-BR')} kg</span>
                        {duration !== null && <span>{clock(duration)}</span>}
                      </span>
                    </button>
                    <ChevronRight size={15} className="to-muted" aria-hidden />
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
      <Records />
    </div>
  )
}

/** A past workout, corrected with the same screen used to log it. */
export function SessionScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const record = useSessions().find((s) => s.id === id)
  return (
    <div className="to-stack">
      <div className="to-toolbar">
        <Button variant="ghost" onClick={() => navigate('history')}>
          <ArrowLeft size={15} />
          {t('history.back')}
        </Button>
      </div>
      {record ? <WorkoutLog record={record} live={!record.data.finishedAt} onFinished={() => navigate('history')} /> : <EmptyState title={t('history.missing')} />}
    </div>
  )
}
