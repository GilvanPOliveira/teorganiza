import { useState } from 'react'
import { Minus, Plus, Trash2, Trophy } from 'lucide-react'
import {
  Badge,
  EmptyState,
  Progress,
  QuickAdd,
  useCollection,
  useFormat,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import type { Goal } from './schema'

function GoalTile({ goal }: { goal: Envelope<Goal> }) {
  const t = useT()
  const format = useFormat()
  const { update, remove } = useCollection<Goal>('goals')
  const { title, target, current, unit, due } = goal.data
  const done = current >= target
  const step = Math.max(1, Math.round(target / 20))
  const set = (value: number) => update(goal.id, { current: Math.max(0, Math.round(value * 100) / 100) })

  return (
    <article className="to-tile">
      <span className="to-tile__row">
        <h3 className="to-tile__title">{title}</h3>
        {done ? (
          <Badge tone="positive">
            <Trophy size={11} />
            {t('goal.done')}
          </Badge>
        ) : (
          due && <Badge>{t('goal.due', { date: format.date(due) })}</Badge>
        )}
      </span>
      <Progress value={current} max={target} label={title} />
      <span className="to-tile__row">
        <span>
          {current} / {target} {unit}
        </span>
        <span>{Math.min(100, Math.round((current / target) * 100))}%</span>
      </span>
      <span className="to-tile__row">
        <span className="to-toolbar">
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('goal.less')} onClick={() => void set(current - step)}>
            <Minus size={14} />
          </button>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('goal.more')} onClick={() => void set(current + step)}>
            <Plus size={14} />
          </button>
        </span>
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('goal.remove')} onClick={() => void remove(goal.id)}>
          <Trash2 size={14} />
        </button>
      </span>
    </article>
  )
}

export function GoalsScreen() {
  const t = useT()
  const goals = useRecords<Goal>('goals')
  const { create } = useCollection<Goal>('goals')
  const [target, setTarget] = useState('10')
  const [unit, setUnit] = useState('')
  const [due, setDue] = useState('')

  const add = async (title: string) => {
    const value = Number(target.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return
    await create({ title, target: value, current: 0, unit: unit.trim(), due: due || null })
  }

  const open = goals.filter((goal) => goal.data.current < goal.data.target)
  const reached = goals.filter((goal) => goal.data.current >= goal.data.target)

  return (
    <div className="to-stack">
      <QuickAdd placeholder={t('goal.placeholder')} onAdd={add}>
        <input className="to-field__input to-input--short" inputMode="decimal" value={target} aria-label={t('goal.target')} onChange={(e) => setTarget(e.target.value)} />
        <input className="to-field__input to-input--short" value={unit} placeholder={t('goal.unit')} aria-label={t('goal.unit')} onChange={(e) => setUnit(e.target.value)} />
        <input type="date" className="to-field__input" value={due} aria-label={t('goal.deadline')} onChange={(e) => setDue(e.target.value)} />
      </QuickAdd>
      {goals.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <>
          <div className="to-cards">
            {open.map((goal) => (
              <GoalTile key={goal.id} goal={goal} />
            ))}
          </div>
          {reached.length > 0 && (
            <>
              <h2 className="to-section-title">{t('goal.reached')}</h2>
              <div className="to-cards">
                {reached.map((goal) => (
                  <GoalTile key={goal.id} goal={goal} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
