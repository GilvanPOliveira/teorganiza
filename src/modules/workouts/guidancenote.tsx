import { HeartPulse, ShieldAlert } from 'lucide-react'
import { useFormat, useOpenHref, useT, type Goal } from '@core/api'
import type { Guidance } from './guidance'

/**
 * Says what the suggestions take into account and where it came from
 * (marked in Meus dados, worked out from the BMI, read from an exam), so a
 * swapped exercise never looks arbitrary. Links back to Meus dados.
 */
export function GuidanceNote({ guidance, goal }: { guidance: Guidance; goal: Goal | null }) {
  const t = useT()
  const format = useFormat()
  const openHref = useOpenHref()
  const items = [...guidance.restrictions].map(([restriction, source]) => {
    const label = t(`flag.${restriction}`)
    if (source === 'bmi') return t('guidance.fromBmi', { label })
    if (source === 'pressure' && guidance.pressure)
      return t('guidance.fromExam', {
        label,
        value: `${guidance.pressure.value}/${guidance.pressure.value2 ?? '?'}`,
        date: format.date(guidance.pressure.date),
      })
    return label
  })
  if (guidance.senior) items.push(t('guidance.senior'))
  const cardio = goal === 'lose' || guidance.highGlucose

  if (items.length === 0 && !cardio) return null
  return (
    <div className="to-guidance">
      {items.length > 0 && (
        <button type="button" className="to-guidance__row" onClick={() => openHref('/health/me')}>
          <ShieldAlert size={14} />
          <span>
            <strong>{t('guidance.considering')}</strong> {items.join(' · ')}
          </span>
        </button>
      )}
      {cardio && (
        <span className="to-guidance__row">
          <HeartPulse size={14} />
          <span>{t(guidance.highGlucose ? 'guidance.cardioGlucose' : 'guidance.cardioLose')}</span>
        </span>
      )}
    </div>
  )
}
