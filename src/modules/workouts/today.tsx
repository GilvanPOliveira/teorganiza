import { useState } from 'react'
import { ArrowRightLeft, CalendarClock, Dumbbell, Moon, Play, Shuffle, Trophy } from 'lucide-react'
import {
  Card,
  Stat,
  StatGrid,
  toLocalISODate,
  useCollection,
  useNavigate,
  useT,
  type Envelope,
} from '@core/api'
import { BodyMap } from './BodyMap'
import type { ExerciseDef, Muscle } from './catalog'
import { useExerciseIndex, useRoutines, useSessions, useTrainingSettings, withIds } from './data'
import { clock, doneSets, entryFor, moveRoutine, plannedRoutine, sessionVolume } from './logic'
import type { Routine, Session } from './schema'
import { ReadinessNotes } from './readinessnotes'
import { ExerciseStrip } from './strip'
import { RecordsList, useRecordsList } from './records'
import { WorkoutLog } from './workout'

const SHORT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function unknownExercise(id: string): ExerciseDef {
  return { id, name: id, muscle: 'corpo', secondary: [], equipment: 'nenhum', kind: 'weight', perSide: false, compound: false, instructions: '' }
}

function shift(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return toLocalISODate(new Date(y, m - 1, d + days))
}

/** The muscles a routine works, as its exercises' main groups. */
export function useRoutineMuscles() {
  const index = useExerciseIndex()
  return (routine: Routine): Muscle[] => [...new Set(routine.items.map((item) => index.get(item.exerciseId)?.muscle).filter(Boolean))] as Muscle[]
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

/** Personal bests, from every finished workout. */
export function Records() {
  const t = useT()
  const marks = useRecordsList(8)
  if (marks.length === 0) return null
  return (
    <Card title={<span className="to-card__titleicon"><Trophy size={15} />{t('records.titleAll')}</span>}>
      <RecordsList marks={marks} />
    </Card>
  )
}

/** Monday to Sunday of the current week, with a dot on each day trained. */
function WeekStrip({
  today,
  trained,
  planned,
}: {
  today: string
  trained: Set<string>
  planned: Set<string>
}) {
  const t = useT()
  const [y, m, d] = today.split('-').map(Number)
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7
  const monday = shift(today, -offset)
  const days = Array.from({ length: 7 }, (_, i) => shift(monday, i))
  const left = days.filter((day) => day >= today && planned.has(day) && !trained.has(day)).length
  const total = days.filter((day) => planned.has(day)).length
  return (
    <div className="to-week">
      <div className="to-week__days">
        {days.map((day) => {
          const [yy, mm, dd] = day.split('-').map(Number)
          const weekday = new Date(yy, mm - 1, dd).getDay()
          return (
            <div key={day} className={`to-week__day${day === today ? ' is-today' : ''}`}>
              <span className="to-week__name">{SHORT_DAYS[weekday]}</span>
              <span className="to-week__num">{dd}</span>
              <span className={`to-week__dot${trained.has(day) ? ' is-done' : planned.has(day) ? ' is-planned' : ''}`} />
            </div>
          )
        })}
      </div>
      {total > 0 && <p className="to-week__left">{t('week.left', { left, total })}</p>}
    </div>
  )
}

export function TodayScreen() {
  const t = useT()
  const navigate = useNavigate()
  const today = toLocalISODate()
  const sessions = useSessions()
  const routines = useRoutines()
  const index = useExerciseIndex()
  const musclesOf = useRoutineMuscles()
  const [settings, setSettings] = useTrainingSettings()
  const { create } = useCollection<Session>('sessions')
  const [choosing, setChoosing] = useState(false)
  const [moveTo, setMoveTo] = useState('')

  const all = withIds(sessions)
  const active = sessions.find((s) => !s.data.finishedAt)
  const finished = all.filter((s) => s.finishedAt)
  const finishedToday = finished.filter((s) => s.date === today)
  const planned = plannedRoutine(today, routines, settings, finished)
  const doneToday = Boolean(planned && finishedToday.some((s) => s.routineId === planned.id))

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

  // The week: days trained, and days with something planned (week mode only).
  const trained = new Set(finished.map((s) => s.date))
  const plannedDays = new Set<string>()
  if (settings.mode === 'week') {
    for (let i = -7; i < 7; i++) {
      const day = shift(today, i)
      if (plannedRoutine(day, routines, settings, finished)) plannedDays.add(day)
    }
  }
  const nextPlanned = settings.mode === 'week' ? [1, 2, 3, 4, 5, 6, 7].map((i) => shift(today, i)).find((day) => plannedDays.has(day) || plannedRoutine(day, routines, settings, finished)) : undefined
  const nextName = nextPlanned ? plannedRoutine(nextPlanned, routines, settings, finished)?.data.name : undefined

  const month = today.slice(0, 7)
  const thisMonth = finished.filter((s) => s.date.startsWith(month))
  const others = routines.filter((r) => r.id !== planned?.id)

  return (
    <div className="to-stack">
      <section className="to-panel">
        <WeekStrip today={today} trained={trained} planned={plannedDays} />

        {planned && !doneToday ? (
          <div className="to-today">
            <span className="to-today__icon">
              <Dumbbell size={18} />
            </span>
            <div className="to-today__text">
              <span className="to-muted">{t('today.today')}</span>
              <strong className="to-today__name">{planned.data.name}</strong>
              <span className="to-muted">{t('today.count', { count: planned.data.items.length })}</span>
            </div>
            <BodyMap primary={musclesOf(planned.data)} size="tiny" />
            <button type="button" className="to-pill" onClick={() => void start(planned)}>
              <Play size={14} /> {t('today.start')}
            </button>
          </div>
        ) : (
          <div className="to-today to-today--rest">
            <span className="to-today__icon to-today__icon--rest">
              <Moon size={18} />
            </span>
            <div className="to-today__text">
              <strong className="to-today__name">{t(doneToday ? 'today.doneTitle' : 'today.restTitle')}</strong>
              <span className="to-muted">
                {doneToday
                  ? t('today.doneBody')
                  : routines.length === 0
                    ? t('today.noRoutines')
                    : nextPlanned && nextName
                      ? t('today.next', { name: nextName, day: SHORT_DAYS[new Date(`${nextPlanned}T12:00:00`).getDay()] })
                      : t('today.restBody')}
              </span>
            </div>
          </div>
        )}

        {planned && !doneToday && <ExerciseStrip ids={planned.data.items.map((item) => item.exerciseId)} />}
        {planned && !doneToday && <ReadinessNotes />}

        <div className="to-today__links">
          <button type="button" className="to-linkbutton" onClick={() => setChoosing((v) => !v)}>
            <ArrowRightLeft size={14} /> {t('today.choose')}
          </button>
          {planned && !doneToday && (
            <label className="to-inline-field">
              <span className="to-muted">{t('today.moveTo')}</span>
              <input type="date" className="to-field__input" value={moveTo} min={shift(today, 1)} onChange={(e) => setMoveTo(e.target.value)} />
              {moveTo && (
                <button
                  type="button"
                  className="to-linkbutton"
                  onClick={() => {
                    void setSettings({ moved: moveRoutine(settings, today, moveTo, planned.id) })
                    setMoveTo('')
                  }}
                >
                  {t('today.move')}
                </button>
              )}
            </label>
          )}
        </div>
      </section>

      {choosing && (
        <section className="to-stack to-stack--tight">
          <h2 className="to-section-title">{t('today.others')}</h2>
          {others.map((routine) => (
            <div key={routine.id} className="to-routinerow">
              <span className="to-today__icon to-today__icon--small">
                <Dumbbell size={14} />
              </span>
              <div className="to-today__text">
                <strong>{routine.data.name}</strong>
                <span className="to-muted">{t('today.count', { count: routine.data.items.length })}</span>
              </div>
              <BodyMap primary={musclesOf(routine.data)} size="tiny" />
              <button type="button" className="to-chip is-active" onClick={() => void start(routine)}>
                {t('today.startShort')}
              </button>
              <div className="to-routinerow__strip">
                <ExerciseStrip ids={routine.data.items.map((item) => item.exerciseId)} small />
              </div>
            </div>
          ))}
          <button type="button" className="to-linkbutton to-linkbutton--strong" onClick={() => void start(null)}>
            <Shuffle size={14} /> {t('today.freeStart')}
          </button>
          {routines.length === 0 && (
            <button type="button" className="to-linkbutton" onClick={() => navigate('routines')}>
              <CalendarClock size={14} /> {t('today.createRoutine')}
            </button>
          )}
        </section>
      )}

      {finishedToday.map((s) => (
        <Summary key={s.id} session={s} />
      ))}

      <StatGrid>
        <Stat label={t('stats.month')} value={thisMonth.length} hint={t('stats.sessions')} />
        <Stat label={t('stats.volume')} value={`${thisMonth.reduce((sum, s) => sum + sessionVolume(s), 0).toLocaleString('pt-BR')} kg`} hint={t('stats.monthHint')} />
        <Stat label={t('stats.total')} value={finished.length} hint={t('stats.sessions')} />
      </StatGrid>

      <Records />
    </div>
  )
}
