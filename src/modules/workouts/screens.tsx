import { useState } from 'react'
import { ChevronDown, ChevronRight, Dumbbell, Trash2, Trophy } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  QuickAdd,
  Stat,
  StatGrid,
  toLocalISODate,
  useCollection,
  useFormat,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import { oneRepMax, volume, type Exercise, type Session } from './schema'

function ExerciseForm({ onAdd }: { onAdd: (exercise: Exercise) => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [weight, setWeight] = useState('')

  const submit = () => {
    const parsed = {
      name: name.trim(),
      sets: Number(sets),
      reps: Number(reps),
      weight: Number(weight.replace(',', '.') || 0),
    }
    if (!parsed.name || !(parsed.sets >= 1) || !(parsed.reps >= 1) || !(parsed.weight >= 0)) return
    onAdd(parsed)
    setName('')
  }

  return (
    <form
      className="to-quickadd"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <input className="to-quickadd__input" value={name} placeholder={t('exercise.name')} aria-label={t('exercise.name')} onChange={(e) => setName(e.target.value)} />
      <input className="to-field__input to-input--tiny" inputMode="numeric" value={sets} aria-label={t('exercise.sets')} title={t('exercise.sets')} onChange={(e) => setSets(e.target.value)} />
      <span className="to-muted">×</span>
      <input className="to-field__input to-input--tiny" inputMode="numeric" value={reps} aria-label={t('exercise.reps')} title={t('exercise.reps')} onChange={(e) => setReps(e.target.value)} />
      <input className="to-field__input to-input--short" inputMode="decimal" value={weight} placeholder="kg" aria-label={t('exercise.weight')} onChange={(e) => setWeight(e.target.value)} />
      <button type="submit" className="to-button to-button--primary" aria-label={t('exercise.add')}>
        +
      </button>
    </form>
  )
}

function SessionCard({ session, open, onToggle }: { session: Envelope<Session>; open: boolean; onToggle: () => void }) {
  const t = useT()
  const format = useFormat()
  const { update, remove } = useCollection<Session>('sessions')
  const exercises = session.data.exercises

  return (
    <li className="to-list__item to-list__item--top to-list__item--column">
      <button type="button" className="to-rowbutton" onClick={onToggle} aria-expanded={open}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="to-list__main">
          <span className="to-list__title">{session.data.name}</span>
          <span className="to-list__meta">
            <span>{format.date(session.data.date)}</span>
            <Badge>{t('session.exercises', { count: exercises.length })}</Badge>
            {volume(session.data) > 0 && <Badge tone="accent">{t('session.volume', { kg: volume(session.data).toLocaleString() })}</Badge>}
          </span>
        </span>
      </button>
      {open && (
        <div className="to-stack to-indent">
          {exercises.length > 0 && (
            <ul className="to-plainlist">
              {exercises.map((exercise, index) => (
                <li key={index} className="to-tile__row">
                  <span>
                    <strong>{exercise.name}</strong> — {exercise.sets}×{exercise.reps}
                    {exercise.weight > 0 && ` · ${exercise.weight} kg`}
                  </span>
                  <button
                    type="button"
                    className="to-iconbutton to-iconbutton--small"
                    aria-label={t('exercise.remove')}
                    onClick={() => void update(session.id, { exercises: exercises.filter((_, i) => i !== index) })}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ExerciseForm onAdd={(exercise) => void update(session.id, { exercises: [...exercises, exercise] })} />
          <div className="to-toolbar">
            <Button variant="danger" onClick={() => void remove(session.id)}>
              <Trash2 size={15} />
              {t('session.remove')}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

export function WorkoutsScreen() {
  const t = useT()
  const sessions = useRecords<Session>('sessions', { sort: { field: 'date', dir: 'desc' } })
  const { create } = useCollection<Session>('sessions')
  const [openId, setOpenId] = useState<string | null>(null)
  const month = toLocalISODate().slice(0, 7)
  const thisMonth = sessions.filter((session) => session.data.date.startsWith(month))

  // Best estimated 1RM per exercise name, across every session.
  const records = new Map<string, number>()
  for (const session of sessions) {
    for (const exercise of session.data.exercises) {
      const key = exercise.name.trim().toLocaleLowerCase()
      records.set(key, Math.max(records.get(key) ?? 0, oneRepMax(exercise)))
    }
  }
  const top = [...records.entries()].filter(([, kg]) => kg > 0).sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <div className="to-stack">
      <StatGrid>
        <Stat label={t('stats.month')} value={thisMonth.length} hint={t('stats.sessions')} />
        <Stat label={t('stats.volume')} value={`${thisMonth.reduce((sum, s) => sum + volume(s.data), 0).toLocaleString()} kg`} hint={t('stats.monthHint')} />
        <Stat label={t('stats.total')} value={sessions.length} hint={t('stats.sessions')} />
      </StatGrid>
      <QuickAdd
        placeholder={t('session.placeholder')}
        onAdd={async (name) => {
          const id = await create({ date: toLocalISODate(), name, exercises: [] })
          setOpenId(id)
        }}
      />
      {sessions.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <ul className="to-list">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              open={openId === session.id}
              onToggle={() => setOpenId(openId === session.id ? null : session.id)}
            />
          ))}
        </ul>
      )}
      {top.length > 0 && (
        <Card title={<span className="to-card__titleicon"><Trophy size={15} />{t('records.title')}</span>}>
          <ul className="to-plainlist">
            {top.map(([name, kg]) => (
              <li key={name} className="to-tile__row">
                <span className="to-capitalize-first">
                  <Dumbbell size={13} /> {name}
                </span>
                <strong>{t('records.oneRepMax', { kg })}</strong>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
