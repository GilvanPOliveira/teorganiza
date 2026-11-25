import { useMemo } from 'react'
import { Flame, Trash2 } from 'lucide-react'
import {
  Checkbox,
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
import type { Check, Habit } from './schema'
import { lastDays, streak } from './streak'

const DAYS = 28

function HabitRow({ habit, checks }: { habit: Envelope<Habit>; checks: Envelope<Check>[] }) {
  const t = useT()
  const format = useFormat()
  const { create, remove } = useCollection<Check>('checks')
  const habits = useCollection<Habit>('habits')
  const today = toLocalISODate()
  const days = lastDays(DAYS)
  const byDate = new Map(checks.map((check) => [check.data.date, check]))
  const marked = new Set(byDate.keys())
  const current = streak(marked)

  const toggle = (date: string) => {
    const existing = byDate.get(date)
    return existing ? remove(existing.id) : create({ habitId: habit.id, date })
  }

  return (
    <li className="to-habit">
      <span className="to-list__main">
        <span className="to-toolbar to-toolbar--center">
          <Checkbox checked={marked.has(today)} label={t('habit.today', { name: habit.data.name })} onChange={() => void toggle(today)} />
          <strong>{habit.data.name}</strong>
        </span>
        <span className="to-list__meta">{t('habit.month', { count: days.filter((d) => marked.has(d)).length })}</span>
      </span>
      <span className="to-dots" role="group" aria-label={habit.data.name}>
        {days.map((date) => (
          <button
            key={date}
            type="button"
            title={format.date(date)}
            aria-label={`${format.date(date)} — ${marked.has(date) ? t('habit.done') : t('habit.notDone')}`}
            aria-pressed={marked.has(date)}
            className={`to-dot${marked.has(date) ? ' is-on' : ''}${date === today ? ' is-today' : ''}`}
            onClick={() => void toggle(date)}
          />
        ))}
      </span>
      <span className="to-toolbar to-toolbar--center">
        <span className="to-streak" title={t('habit.streak')}>
          <Flame size={14} /> {current}
        </span>
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('habit.remove')} onClick={() => void habits.remove(habit.id)}>
          <Trash2 size={14} />
        </button>
      </span>
    </li>
  )
}

export function HabitsScreen() {
  const t = useT()
  const habits = useRecords<Habit>('habits', { where: { archived: false } })
  const days = lastDays(DAYS)
  const checks = useRecords<Check>('checks', { where: { date: { gte: days[0] } } })
  const allChecks = useRecords<Check>('checks')
  const { create } = useCollection<Habit>('habits')
  const today = toLocalISODate()

  const byHabit = useMemo(() => {
    const map = new Map<string, Envelope<Check>[]>()
    for (const check of checks) map.set(check.data.habitId, [...(map.get(check.data.habitId) ?? []), check])
    return map
  }, [checks])

  const doneToday = habits.filter((habit) => (byHabit.get(habit.id) ?? []).some((c) => c.data.date === today)).length
  const best = Math.max(
    0,
    ...habits.map((habit) => streak(new Set(allChecks.filter((c) => c.data.habitId === habit.id).map((c) => c.data.date)))),
  )

  return (
    <div className="to-stack">
      <StatGrid>
        <Stat label={t('stats.today')} value={`${doneToday}/${habits.length}`} />
        <Stat label={t('stats.best')} value={t('stats.days', { count: best })} />
        <Stat label={t('stats.marks')} value={checks.length} hint={t('stats.marksHint')} />
      </StatGrid>
      <QuickAdd placeholder={t('habit.placeholder')} onAdd={(name) => void create({ name, archived: false })} />
      {habits.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <ul className="to-list">
          {habits.map((habit) => (
            <HabitRow key={habit.id} habit={habit} checks={byHabit.get(habit.id) ?? []} />
          ))}
        </ul>
      )}
    </div>
  )
}
