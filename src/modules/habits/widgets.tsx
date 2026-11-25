import { toLocalISODate, useRecords, useT } from '@core/api'
import type { Check, Habit } from './schema'

export function TodayHabits() {
  const t = useT()
  const today = toLocalISODate()
  const habits = useRecords<Habit>('habits', { where: { archived: false } })
  const checks = useRecords<Check>('checks', { where: { date: today } })
  return (
    <div className="to-widget">
      <p className="to-widget__value">
        {checks.length}/{habits.length}
      </p>
      <p className="to-muted">{t('widget.caption')}</p>
    </div>
  )
}
