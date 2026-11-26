import { Progress, useProgressSources, useRecords, useT } from '@core/api'
import { goalProgress } from './progress'
import type { Goal } from './schema'

export function GoalsWidget() {
  const t = useT()
  const goals = useRecords<Goal>('goals')
  const sources = new Map(useProgressSources().map((entry) => [entry.key, entry]))
  const state = goals.map((goal) => ({ goal, ...goalProgress(goal.data, goal.data.source ? sources.get(goal.data.source) : undefined) }))
  const open = state.filter((entry) => !entry.reached)
  return (
    <div className="to-widget to-stack">
      <p className="to-muted">{t('widget.caption', { count: open.length })}</p>
      {open.slice(0, 3).map(({ goal, value, max }) => (
        <div key={goal.id}>
          <span className="to-list__meta">{goal.data.title}</span>
          <Progress value={value} max={max} label={goal.data.title} />
        </div>
      ))}
    </div>
  )
}
