import { useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import {
  Button,
  EmptyState,
  Segmented,
  Stat,
  StatGrid,
  toLocalISODate,
  useCollection,
  useFormat,
  useNavigate,
  useParams,
  useT,
  type Envelope,
} from '@core/api'
import { BodyMap } from './BodyMap'
import { SHORT_DAYS } from './browser'
import type { Muscle } from './catalog'
import { useExerciseIndex, useRoutines, useSessions, useTrainingSettings, withIds } from './data'
import { Fold } from './fold'
import { clock, doneSets, entryFor, sessionVolume } from './logic'
import { useKeepPlanHistory, usePlanSnapshots } from './plans'
import { RecordsList, useRecordsList } from './records'
import type { PlanSnapshot, Session } from './schema'
import { ExerciseStrip } from './strip'
import { WorkoutLog } from './workout'

type View = 'workouts' | 'plans'
const VIEW_KEY = 'teorganiza.workouts.history.view'

const kg = (n: number) => `${n.toLocaleString('pt-BR')} kg`
const durationOf = (s: Session) => (s.startedAt && s.finishedAt ? (Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 1000 : 0)
const monthName = (month: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00`))

function weekdayOf(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** The day of a workout or of a sheet version, in its own column like the week's day. */
function DateColumn({ date }: { date: string }) {
  return (
    <span className="to-datecol">
      <strong>{Number(date.slice(8, 10))}</strong>
      <small>{SHORT_DAYS[weekdayOf(date)]}</small>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Logging a workout done without the app
 * ------------------------------------------------------------------ */

function PastWorkout({ onClose }: { onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const routines = useRoutines()
  const index = useExerciseIndex()
  const sessions = withIds(useSessions()).filter((s) => s.finishedAt)
  const [settings] = useTrainingSettings()
  const { create } = useCollection<Session>('sessions')
  const [date, setDate] = useState(toLocalISODate())
  const [routineId, setRoutineId] = useState('')

  const log = async () => {
    const routine = routines.find((r) => r.id === routineId)
    // From a routine, its sets come in as done, the way they were planned: correct what differed.
    const entries = routine
      ? routine.data.items.flatMap((item) => {
          const def = index.get(item.exerciseId)
          if (!def) return []
          const entry = entryFor(def, sessions, item, settings.rest)
          return [{ ...entry, sets: entry.sets.map((set) => ({ ...set, done: set.type !== 'warmup' })) }]
        })
      : []
    const id = await create({
      date,
      name: routine?.data.name ?? t('history.pastName'),
      routineId: routine?.id ?? null,
      startedAt: null,
      finishedAt: `${date}T12:00:00.000Z`,
      note: '',
      entries,
    })
    onClose()
    navigate(`history/${id}`)
  }

  return (
    <section className="to-panel to-pastform">
      <strong>{t('history.logTitle')}</strong>
      <label className="to-itemfield">
        <span>{t('history.date')}</span>
        <input type="date" className="to-field__input" value={date} max={toLocalISODate()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="to-itemfield">
        <span>{t('history.routine')}</span>
        <select className="to-field__input" value={routineId} onChange={(e) => setRoutineId(e.target.value)}>
          <option value="">{t('history.free')}</option>
          {routines.map((r) => (
            <option key={r.id} value={r.id}>
              {r.data.name}
            </option>
          ))}
        </select>
      </label>
      <span className="to-pastform__actions">
        <button type="button" className="to-linkbutton" onClick={onClose}>
          {t('action.cancel')}
        </button>
        <button type="button" className="to-pill" onClick={() => void log()} disabled={!date}>
          {t('history.log')}
        </button>
      </span>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Workouts
 * ------------------------------------------------------------------ */

function WorkoutRow({ session }: { session: Envelope<Session> }) {
  const t = useT()
  const navigate = useNavigate()
  const index = useExerciseIndex()
  const { remove } = useCollection<Session>('sessions')
  const data = session.data
  const muscles = [...new Set(data.entries.map((e) => index.get(e.exerciseId)?.muscle).filter(Boolean))] as Muscle[]
  const duration = durationOf(data)
  const meta = [
    t('history.exercises', { count: data.entries.length }),
    t('history.sets', { count: doneSets(data) }),
    kg(sessionVolume(data)),
    duration ? clock(duration) : null,
  ].filter(Boolean)

  return (
    <div className="to-dayrow to-dayrow--line to-dayrow--week to-dayrow--link" onClick={() => navigate(`history/${session.id}`)}>
      <DateColumn date={data.date} />
      <span className="to-dayrow__body">
        <BodyMap primary={muscles} size="tiny" />
      </span>
      <button type="button" className="to-dayrow__main" onClick={() => navigate(`history/${session.id}`)}>
        <strong>{data.name}</strong>
        <span className="to-muted">{meta.join(' · ')}</span>
      </button>
      <div className="to-dayrow__thumbs">
        <ExerciseStrip ids={data.entries.map((e) => e.exerciseId)} small />
      </div>
      <span className="to-rowtool" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="to-plainicon to-plainicon--danger"
          aria-label={t('history.removeNamed', { name: data.name })}
          title={t('history.remove')}
          onClick={() => confirm(t('workout.deleteConfirm')) && void remove(session.id)}
        >
          <Trash2 size={17} />
        </button>
      </span>
    </div>
  )
}

function WorkoutsView({ month }: { month: string }) {
  const t = useT()
  const marks = useRecordsList(12)
  const sessions = useSessions().filter((s) => s.data.finishedAt && (month === 'all' || s.data.date.startsWith(month)))

  const months = new Map<string, Envelope<Session>[]>()
  for (const s of sessions) months.set(s.data.date.slice(0, 7), [...(months.get(s.data.date.slice(0, 7)) ?? []), s])
  const volume = sessions.reduce((sum, s) => sum + sessionVolume(s.data), 0)
  const sets = sessions.reduce((sum, s) => sum + doneSets(s.data), 0)
  const time = sessions.reduce((sum, s) => sum + durationOf(s.data), 0)

  if (sessions.length === 0) return <EmptyState title={t('empty.title')} body={t('history.emptyBody')} />

  return (
    <>
      <div className="to-historystats">
      <StatGrid>
        <Stat label={t('history.statWorkouts')} value={sessions.length} />
        <Stat label={t('history.statSets')} value={sets} />
        <Stat label={t('history.statVolume')} value={kg(volume)} />
        <Stat label={t('history.statTime')} value={time ? clock(time) : '—'} />
      </StatGrid>
      </div>

      {[...months.entries()].map(([key, list], i) => (
        <Fold
          key={key}
          id={`history-${key}`}
          defaultOpen={i === 0}
          title={monthName(key)}
          summary={t('history.monthSummary', { count: list.length, volume: kg(list.reduce((sum, s) => sum + sessionVolume(s.data), 0)) })}
        >
          {list.map((s) => (
            <WorkoutRow key={s.id} session={s} />
          ))}
        </Fold>
      ))}

      {marks.length > 0 && (
        <Fold id="history-records" title={t('records.titleAll')} summary={t('history.recordsSummary', { count: marks.length })}>
          <RecordsList marks={marks} />
        </Fold>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Sheet versions
 * ------------------------------------------------------------------ */

function PlanRow({ snapshot, current }: { snapshot: Envelope<PlanSnapshot>; current: boolean }) {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const index = useExerciseIndex()
  const routines = snapshot.data.routines
  const ids = [...new Set(routines.flatMap((r) => r.items.map((item) => item.exerciseId)))]
  const muscles = [...new Set(ids.map((id) => index.get(id)?.muscle).filter(Boolean))] as Muscle[]
  const days = routines.filter((r) => r.weekday !== null && !r.off).length
  const exercises = routines.reduce((sum, r) => sum + r.items.length, 0)

  return (
    <div className="to-dayrow to-dayrow--line to-dayrow--week to-dayrow--link" onClick={() => navigate(`history/plans/${snapshot.id}`)}>
      <DateColumn date={snapshot.data.date} />
      <span className="to-dayrow__body">
        <BodyMap primary={muscles} size="tiny" />
      </span>
      <button type="button" className="to-dayrow__main" onClick={() => navigate(`history/plans/${snapshot.id}`)}>
        <strong>
          {t('history.planTitle', { date: format.date(snapshot.data.date) })}
          {current && <span className="to-badge-inline">{t('history.current')}</span>}
        </strong>
        <span className="to-muted">
          {t('history.planDays', { count: days })} · {t('history.exercises', { count: exercises })}
        </span>
      </button>
      <div className="to-dayrow__thumbs">
        <ExerciseStrip ids={ids} small />
      </div>
    </div>
  )
}

function PlansView() {
  const t = useT()
  const snapshots = usePlanSnapshots()
  if (snapshots.length === 0) return <EmptyState title={t('history.plansEmpty')} body={t('history.plansEmptyBody')} />
  return (
    <Fold id="history-plans" defaultOpen title={t('history.plansTitle')} summary={t('history.plansSummary', { count: snapshots.length })}>
      {snapshots.map((s, i) => (
        <PlanRow key={s.id} snapshot={s} current={i === 0} />
      ))}
    </Fold>
  )
}

/* ------------------------------------------------------------------ *
 * The screen
 * ------------------------------------------------------------------ */

/** Every workout done and every version of the sheet, as the rest of Treino shows them. */
export function HistoryScreen() {
  const t = useT()
  const navigate = useNavigate()
  useKeepPlanHistory()
  const sessions = useSessions().filter((s) => s.data.finishedAt)
  const [view, setViewState] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'plans' ? 'plans' : 'workouts'
    } catch {
      return 'workouts'
    }
  })
  const setView = (next: View) => {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // It still switches; it just opens on Treinos next time.
    }
  }
  const [month, setMonth] = useState('all')
  const [logging, setLogging] = useState(false)
  const months = [...new Set(sessions.map((s) => s.data.date.slice(0, 7)))]

  return (
    <div className="to-stack">
      <section className="to-panel to-panel--row to-howpanel to-historybar">
        <Segmented<View>
          label={t('history.view')}
          value={view}
          onChange={setView}
          options={[
            { value: 'workouts', label: t('history.viewWorkouts') },
            { value: 'plans', label: t('history.viewPlans') },
          ]}
        />
        {view === 'workouts' && (
          <select className="to-field__input to-filters__select" value={month} aria-label={t('history.month')} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">{t('history.allMonths')}</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        )}
        <span className="to-push">
          {view === 'workouts' ? (
            <button type="button" className={`to-filters__btn${logging ? ' is-active' : ''}`} aria-expanded={logging} onClick={() => setLogging((v) => !v)}>
              {t('history.logPast')}
            </button>
          ) : (
            <button type="button" className="to-filters__btn to-filters__btn--accent" onClick={() => navigate('sheet')}>
              {t('history.currentSheet')}
            </button>
          )}
        </span>
      </section>

      {view === 'workouts' && logging && <PastWorkout onClose={() => setLogging(false)} />}
      {view === 'workouts' ? <WorkoutsView month={month} /> : <PlansView />}
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
