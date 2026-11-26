import { useState } from 'react'
import { ExternalLink, Link2, Minus, Plus, Trash2, Trophy } from 'lucide-react'
import {
  Badge,
  EmptyState,
  Progress,
  QuickAdd,
  useCollection,
  useFormat,
  useOpenHref,
  useProgressSources,
  useRecords,
  useT,
  type CollectedProgress,
  type Envelope,
} from '@core/api'
import { goalProgress } from './progress'
import type { Goal } from './schema'

function GoalTile({ goal, source }: { goal: Envelope<Goal>; source?: CollectedProgress }) {
  const t = useT()
  const format = useFormat()
  const open = useOpenHref()
  const { update, remove } = useCollection<Goal>('goals')
  const { title, target, current, unit, due } = goal.data
  const linked = Boolean(goal.data.source)
  const { value, max, reached } = goalProgress(goal.data, source)
  const step = Math.max(1, Math.round(target / 20))
  const set = (next: number) => update(goal.id, { current: Math.max(0, Math.round(next * 100) / 100) })

  return (
    <article className="to-tile">
      <span className="to-tile__row">
        <h3 className="to-tile__title">{title}</h3>
        {reached ? (
          <Badge tone="positive">
            <Trophy size={11} />
            {t('goal.done')}
          </Badge>
        ) : (
          due && <Badge>{t('goal.due', { date: format.date(due) })}</Badge>
        )}
      </span>
      {linked && (
        <button type="button" className="to-linklike to-goal__source" disabled={!source} onClick={() => source && open(source.href)}>
          <Link2 size={12} />
          {source ? t('goal.followsProject', { name: source.label }) : t('goal.sourceGone')}
          {source && <ExternalLink size={11} />}
        </button>
      )}
      <Progress value={value} max={max} label={title} />
      <span className="to-tile__row">
        <span>{linked ? t('goal.tasks', { done: value, total: source?.total ?? 0 }) : `${current} / ${target} ${unit}`}</span>
        <span>{Math.min(100, Math.round((value / max) * 100))}%</span>
      </span>
      <span className="to-tile__row">
        {linked ? (
          <span className="to-muted">{t('goal.auto')}</span>
        ) : (
          <span className="to-toolbar">
            <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('goal.less')} onClick={() => void set(current - step)}>
              <Minus size={14} />
            </button>
            <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('goal.more')} onClick={() => void set(current + step)}>
              <Plus size={14} />
            </button>
          </span>
        )}
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
  const sources = useProgressSources()
  const { create } = useCollection<Goal>('goals')
  const [target, setTarget] = useState('10')
  const [unit, setUnit] = useState('')
  const [due, setDue] = useState('')
  const [source, setSource] = useState('')
  const byKey = new Map(sources.map((entry) => [entry.key, entry]))

  const add = async (title: string) => {
    if (source) {
      // A goal that follows a project: its deadline defaults to the project's.
      const followed = byKey.get(source)
      await create({ title, target: 1, current: 0, unit: '', due: due || followed?.due || null, source })
    } else {
      const value = Number(target.replace(',', '.'))
      if (!Number.isFinite(value) || value <= 0) return
      await create({ title, target: value, current: 0, unit: unit.trim(), due: due || null, source: null })
    }
    setSource('')
    setDue('')
  }

  const sourceOf = (goal: Envelope<Goal>) => (goal.data.source ? byKey.get(goal.data.source) : undefined)
  const open = goals.filter((goal) => !goalProgress(goal.data, sourceOf(goal)).reached)
  const reached = goals.filter((goal) => goalProgress(goal.data, sourceOf(goal)).reached)
  const tile = (goal: Envelope<Goal>) => <GoalTile key={goal.id} goal={goal} source={sourceOf(goal)} />

  return (
    <div className="to-stack">
      <QuickAdd placeholder={t('goal.placeholder')} onAdd={add}>
        {sources.length > 0 && (
          <select className="to-field__input" value={source} aria-label={t('goal.link')} title={t('goal.link')} onChange={(e) => setSource(e.target.value)}>
            <option value="">{t('goal.manual')}</option>
            {sources.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {t('goal.project', { name: entry.label })}
              </option>
            ))}
          </select>
        )}
        {!source && (
          <>
            <input className="to-field__input to-input--short" inputMode="decimal" value={target} aria-label={t('goal.target')} onChange={(e) => setTarget(e.target.value)} />
            <input className="to-field__input to-input--short" value={unit} placeholder={t('goal.unit')} aria-label={t('goal.unit')} onChange={(e) => setUnit(e.target.value)} />
          </>
        )}
        <input type="date" className="to-field__input" value={due} aria-label={t('goal.deadline')} onChange={(e) => setDue(e.target.value)} />
      </QuickAdd>
      {goals.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <>
          <div className="to-cards">{open.map(tile)}</div>
          {reached.length > 0 && (
            <>
              <h2 className="to-section-title">{t('goal.reached')}</h2>
              <div className="to-cards">{reached.map(tile)}</div>
            </>
          )}
        </>
      )}
    </div>
  )
}
