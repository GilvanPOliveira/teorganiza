import { Progress, useRecords, useT } from '@core/api'
import type { Goal } from './schema'

export function GoalsWidget() {
  const t = useT()
  const goals = useRecords<Goal>('goals')
  const open = goals.filter((goal) => goal.data.current < goal.data.target)
  return (
    <div className="to-widget to-stack">
      <p className="to-muted">{t('widget.caption', { count: open.length })}</p>
      {open.slice(0, 3).map((goal) => (
        <div key={goal.id}>
          <span className="to-list__meta">{goal.data.title}</span>
          <Progress value={goal.data.current} max={goal.data.target} label={goal.data.title} />
        </div>
      ))}
    </div>
  )
}
