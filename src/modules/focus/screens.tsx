import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import {
  Button,
  Segmented,
  Stat,
  StatGrid,
  toLocalISODate,
  useCollection,
  useFormat,
  useRecords,
  useT,
} from '@core/api'
import type { FocusSession } from './module'

const LENGTHS = ['25', '50', '15'] as const
type Length = (typeof LENGTHS)[number]

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * A focus timer measured against the wall clock, not by counting ticks:
 * a tab in the background is throttled, and the count would drift.
 */
export function FocusScreen() {
  const t = useT()
  const format = useFormat()
  const { create } = useCollection<FocusSession>('sessions')
  const [length, setLength] = useState<Length>('25')
  const [label, setLabel] = useState('')
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [pausedLeft, setPausedLeft] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const saved = useRef(false)

  const total = Number(length) * 60
  const left = endsAt !== null ? Math.max(0, Math.round((endsAt - now) / 1000)) : (pausedLeft ?? total)
  const running = endsAt !== null

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (!running || left > 0 || saved.current) return
    saved.current = true
    void create({ date: toLocalISODate(), minutes: Number(length), label: label.trim() })
    setEndsAt(null)
    setPausedLeft(null)
  }, [running, left, length, label, create])

  const start = () => {
    saved.current = false
    setNow(Date.now())
    setEndsAt(Date.now() + left * 1000)
    setPausedLeft(null)
  }
  const pause = () => {
    setPausedLeft(left)
    setEndsAt(null)
  }
  const reset = () => {
    setEndsAt(null)
    setPausedLeft(null)
  }

  const today = toLocalISODate()
  const sessions = useRecords<FocusSession>('sessions', { sort: { field: 'date', dir: 'desc' } })
  // `now` is state, refreshed by the timer: render stays pure.
  const weekStart = toLocalISODate(new Date(now - 6 * 86400000))
  const minutesToday = sessions.filter((s) => s.data.date === today).reduce((sum, s) => sum + s.data.minutes, 0)
  const minutesWeek = sessions.filter((s) => s.data.date >= weekStart).reduce((sum, s) => sum + s.data.minutes, 0)

  return (
    <div className="to-stack">
      <StatGrid>
        <Stat label={t('stats.today')} value={t('stats.minutes', { count: minutesToday })} />
        <Stat label={t('stats.week')} value={t('stats.hours', { count: Math.round((minutesWeek / 60) * 10) / 10 })} />
        <Stat label={t('stats.sessions')} value={sessions.length} />
      </StatGrid>

      <div className="to-timer">
        <Segmented<Length>
          label={t('timer.length')}
          value={length}
          onChange={(value) => {
            if (!running) {
              setLength(value)
              setPausedLeft(null)
            }
          }}
          options={LENGTHS.map((value) => ({ value, label: t('timer.minutes', { count: value }) }))}
        />
        <span className="to-timer__clock" role="timer" aria-live="off">
          {clock(left)}
        </span>
        <input
          className="to-field__input to-timer__label"
          value={label}
          placeholder={t('timer.label')}
          aria-label={t('timer.label')}
          onChange={(event) => setLabel(event.target.value)}
        />
        <div className="to-toolbar">
          {running ? (
            <Button onClick={pause}>
              <Pause size={15} />
              {t('timer.pause')}
            </Button>
          ) : (
            <Button variant="primary" onClick={start}>
              <Play size={15} />
              {pausedLeft !== null ? t('timer.resume') : t('timer.start')}
            </Button>
          )}
          <Button variant="ghost" onClick={reset}>
            <RotateCcw size={15} />
            {t('timer.reset')}
          </Button>
        </div>
        <p className="to-muted">{t('timer.note')}</p>
      </div>

      {sessions.length > 0 && (
        <>
          <h2 className="to-section-title">{t('history.title')}</h2>
          <ul className="to-list">
            {sessions.slice(0, 10).map((session) => (
              <li key={session.id} className="to-list__item">
                <div className="to-list__main">
                  <span className="to-list__title">{session.data.label || t('history.untitled')}</span>
                  <span className="to-list__meta">{format.date(session.data.date)}</span>
                </div>
                <strong>{t('stats.minutes', { count: session.data.minutes })}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
