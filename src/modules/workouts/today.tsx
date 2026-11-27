import { useMemo, useState } from 'react'
import { CalendarClock, Dumbbell, Play, Trophy } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Stat,
  StatGrid,
  toLocalISODate,
  useCollection,
  useNavigate,
  useT,
  type Envelope,
} from '@core/api'
import type { ExerciseDef } from './catalog'
import { useExerciseIndex, useRoutines, useSessions, useTrainingSettings, withIds } from './data'
import { bestOf, clock, doneSets, entryFor, moveRoutine, plannedRoutine, sessionVolume } from './logic'
import type { Routine, Session } from './schema'
import { WorkoutLog } from './workout'

function unknownExercise(id: string): ExerciseDef {
  return { id, name: id, muscle: 'corpo', secondary: [], equipment: 'nenhum', kind: 'weight', perSide: false, compound: false, instructions: '' }
}

function Summary({ session }: { session: Session & { id: string } }) {
  const t = useT()
  const duration = session.startedAt && session.finishedAt ? (Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 1000 : null
  return (
    <Card title={<span className="to-card__titleicon"><Trophy size={15} />{t('summary.title', { name: session.name })}</span>}>
      <StatGrid>
        {duration !== null && <Stat label={t('summary.duration')} value={clock(duration)} />}
        <Stat label={t('summary.volume')} value={`${sessionVolume(session).toLocaleString('pt-BR')} kg`} />
        <Stat label={t('summary.sets')} value={doneSets(session)} />
      </StatGrid>
    </Card>
  )
}

/** Personal bests by estimated 1RM, from every finished workout. */
export function Records() {
  const t = useT()
  const sessions = withIds(useSessions()).filter((s) => s.finishedAt)
  const top = useMemo(() => {
    const seen = new Map<string, { name: string; kg: number }>()
    for (const s of sessions) {
      for (const entry of s.entries) {
        const key = entry.exerciseId ?? entry.name.trim().toLocaleLowerCase()
        if (seen.has(key) || entry.kind !== 'weight') continue
        seen.set(key, { name: entry.name, kg: bestOf(sessions, entry).oneRepMax })
      }
    }
    return [...seen.values()].filter((r) => r.kg > 0).sort((a, b) => b.kg - a.kg).slice(0, 8)
  }, [sessions])
  if (top.length === 0) return null
  return (
    <Card title={<span className="to-card__titleicon"><Trophy size={15} />{t('records.title')}</span>}>
      <ul className="to-plainlist">
        {top.map((r) => (
          <li key={r.name} className="to-tile__row">
            <span>
              <Dumbbell size={13} /> {r.name}
            </span>
            <strong>{t('records.oneRepMax', { kg: r.kg })}</strong>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function TodayScreen() {
  const t = useT()
  const navigate = useNavigate()
  const today = toLocalISODate()
  const sessions = useSessions()
  const routines = useRoutines()
  const index = useExerciseIndex()
  const [settings, setSettings] = useTrainingSettings()
  const { create } = useCollection<Session>('sessions')
  const [moveTo, setMoveTo] = useState('')
  const [pickRoutine, setPickRoutine] = useState('')

  const all = withIds(sessions)
  const active = sessions.find((s) => !s.data.finishedAt)
  const finished = all.filter((s) => s.finishedAt)
  const finishedToday = finished.filter((s) => s.date === today)
  const planned = plannedRoutine(today, routines, settings, finished)
  const doneToday = planned && finishedToday.some((s) => s.routineId === planned.id)

  const start = async (routine: Envelope<Routine> | null) => {
    const entries = routine
      ? routine.data.items.map((item) => entryFor(index.get(item.exerciseId) ?? unknownExercise(item.exerciseId), finished, item, settings.rest))
      : []
    await create({
      date: today,
      name: routine?.data.name ?? t('today.free'),
      routineId: routine?.id ?? null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      note: '',
      entries,
    })
  }

  if (active) return <WorkoutLog record={active} live />

  const month = today.slice(0, 7)
  const thisMonth = finished.filter((s) => s.date.startsWith(month))

  return (
    <div className="to-stack">
      {finishedToday.map((s) => (
        <Summary key={s.id} session={s} />
      ))}

      {planned && !doneToday ? (
        <Card title={<span className="to-card__titleicon"><CalendarClock size={15} />{t('today.planned')}</span>}>
          <h3 className="to-tile__title">{planned.data.name}</h3>
          <ul className="to-plainlist">
            {planned.data.items.map((item, i) => (
              <li key={i} className="to-tile__row">
                <span>{index.get(item.exerciseId)?.name ?? item.exerciseId}</span>
                <span className="to-muted">
                  {item.sets.filter((s) => s.type !== 'warmup').length} ×{' '}
                  {item.sets[0]?.seconds ? `${item.sets[0].seconds}s` : item.sets[0]?.repsMax ? `${item.sets[0].reps}–${item.sets[0].repsMax}` : item.sets[0]?.reps ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          <div className="to-toolbar">
            <Button variant="primary" onClick={() => void start(planned)}>
              <Play size={15} />
              {t('today.start')}
            </Button>
            <label className="to-inline-field">
              <span className="to-muted">{t('today.moveTo')}</span>
              <input type="date" className="to-field__input" value={moveTo} min={today} onChange={(e) => setMoveTo(e.target.value)} />
            </label>
            {moveTo && moveTo !== today && (
              <Button
                onClick={() => {
                  void setSettings({ moved: moveRoutine(settings, today, moveTo, planned.id) })
                  setMoveTo('')
                }}
              >
                {t('today.move')}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card title={t(doneToday ? 'today.doneTitle' : 'today.restTitle')}>
          <p className="to-muted">{t(routines.length === 0 ? 'today.noRoutines' : doneToday ? 'today.doneBody' : 'today.restBody')}</p>
          <div className="to-toolbar">
            {routines.length > 0 && (
              <>
                <select className="to-field__input" value={pickRoutine} aria-label={t('today.pick')} onChange={(e) => setPickRoutine(e.target.value)}>
                  <option value="">{t('today.pick')}</option>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.data.name}
                    </option>
                  ))}
                </select>
                {pickRoutine && (
                  <Button variant="primary" onClick={() => void start(routines.find((r) => r.id === pickRoutine) ?? null)}>
                    <Play size={15} />
                    {t('today.start')}
                  </Button>
                )}
              </>
            )}
            {routines.length === 0 && (
              <Button variant="primary" onClick={() => navigate('routines')}>
                {t('today.createRoutine')}
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="to-toolbar">
        <Button onClick={() => void start(null)}>
          <Play size={15} />
          {t('today.freeStart')}
        </Button>
        {settings.mode === 'rotation' && <Badge>{t('today.rotation')}</Badge>}
      </div>

      <StatGrid>
        <Stat label={t('stats.month')} value={thisMonth.length} hint={t('stats.sessions')} />
        <Stat label={t('stats.volume')} value={`${thisMonth.reduce((sum, s) => sum + sessionVolume(s), 0).toLocaleString('pt-BR')} kg`} hint={t('stats.monthHint')} />
        <Stat label={t('stats.total')} value={finished.length} hint={t('stats.sessions')} />
      </StatGrid>

      {finished.length === 0 && <EmptyState title={t('empty.title')} body={t('empty.body')} />}
      <Records />
    </div>
  )
}
