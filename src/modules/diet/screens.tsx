import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Card,
  EmptyState,
  Field,
  Progress,
  QuickAdd,
  Stat,
  StatGrid,
  Table,
  toLocalISODate,
  useCollection,
  useFormat,
  useRecords,
  useSettings,
  useT,
} from '@core/api'
import type { Meal } from './schema'

const DEFAULTS = { target: 2000, protein: 120 }

function number(text: string): number {
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export function DietScreen() {
  const t = useT()
  const format = useFormat()
  const today = toLocalISODate()
  const [settings, setSettings] = useSettings(DEFAULTS)
  const meals = useRecords<Meal>('meals', { where: { date: today } })
  const recent = useRecords<Meal>('meals', { sort: { field: 'date', dir: 'desc' } })
  const { create, remove } = useCollection<Meal>('meals')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')

  const total = meals.reduce(
    (sum, meal) => ({
      kcal: sum.kcal + meal.data.kcal,
      protein: sum.protein + meal.data.protein,
      carbs: sum.carbs + meal.data.carbs,
      fat: sum.fat + meal.data.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  const left = settings.target - total.kcal

  const byDay = new Map<string, number>()
  for (const meal of recent) byDay.set(meal.data.date, (byDay.get(meal.data.date) ?? 0) + meal.data.kcal)
  const days = [...byDay.entries()].filter(([date]) => date !== today).slice(0, 7)

  return (
    <div className="to-stack">
      <StatGrid>
        <Stat
          label={t('stats.today')}
          value={`${Math.round(total.kcal)} kcal`}
          hint={left >= 0 ? t('stats.left', { kcal: Math.round(left) }) : t('stats.over', { kcal: Math.round(-left) })}
          tone={left < 0 ? 'negative' : undefined}
        />
        <Stat label={t('stats.protein')} value={`${Math.round(total.protein)} g`} hint={t('stats.of', { value: settings.protein })} />
        <Stat label={t('stats.carbsFat')} value={`${Math.round(total.carbs)} / ${Math.round(total.fat)} g`} />
      </StatGrid>
      <Progress value={total.kcal} max={settings.target} label={t('stats.today')} />

      <QuickAdd
        placeholder={t('meal.placeholder')}
        onAdd={async (name) => {
          await create({ date: today, name, kcal: number(kcal), protein: number(protein), carbs: 0, fat: 0 })
          setKcal('')
          setProtein('')
        }}
      >
        <input className="to-field__input to-input--short" inputMode="decimal" value={kcal} placeholder="kcal" aria-label={t('meal.kcal')} onChange={(e) => setKcal(e.target.value)} />
        <input className="to-field__input to-input--short" inputMode="decimal" value={protein} placeholder={t('meal.proteinShort')} aria-label={t('meal.protein')} onChange={(e) => setProtein(e.target.value)} />
      </QuickAdd>

      {meals.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <ul className="to-list">
          {meals.map((meal) => (
            <li key={meal.id} className="to-list__item">
              <div className="to-list__main">
                <span className="to-list__title">{meal.data.name}</span>
                <span className="to-list__meta">
                  {meal.data.kcal} kcal · {meal.data.protein} g {t('meal.proteinShort')}
                </span>
              </div>
              <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('meal.remove')} onClick={() => void remove(meal.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {days.length > 0 && (
        <Card title={t('history.title')}>
          <Table headers={[t('history.day'), 'kcal', t('history.vsTarget')]}>
            {days.map(([date, value]) => (
              <tr key={date}>
                <td>{format.date(date)}</td>
                <td>{Math.round(value)}</td>
                <td className={value > settings.target ? 'to-negative' : 'to-positive'}>
                  {Math.round((value / settings.target) * 100)}%
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card title={t('target.title')}>
        <div className="to-toolbar">
          <Field label={t('target.kcal')} inputMode="numeric" defaultValue={settings.target} key={`k${settings.target}`} onBlur={(e) => void setSettings({ target: number(e.target.value) || DEFAULTS.target })} />
          <Field label={t('target.protein')} inputMode="numeric" defaultValue={settings.protein} key={`p${settings.protein}`} onBlur={(e) => void setSettings({ protein: number(e.target.value) || DEFAULTS.protein })} />
        </div>
      </Card>
    </div>
  )
}
