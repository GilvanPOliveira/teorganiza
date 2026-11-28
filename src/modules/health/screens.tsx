import { useState } from 'react'
import { Angry, Droplets, Frown, Laugh, Meh, Minus, Moon, Plus, Smile, Trash2 } from 'lucide-react'
import {
  Card,
  Checkbox,
  EmptyState,
  QuickAdd,
  Stat,
  StatGrid,
  Table,
  toLocalISODate,
  useCollection,
  useFormat,
  useProfile,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import type { Day, Dose, Medicine } from './schema'

const FACES = [Angry, Frown, Meh, Smile, Laugh]
const EMPTY_DAY = (date: string): Day => ({ date, sleep: null, water: 0, mood: null, energy: null, note: '' })

/** Today's record, created on the first change so an untouched day leaves nothing behind. */
function useToday() {
  const today = toLocalISODate()
  const [record] = useRecords<Day>('days', { where: { date: today } })
  const { create, update } = useCollection<Day>('days')
  const data = record?.data ?? EMPTY_DAY(today)
  const patch = (changes: Partial<Day>) =>
    record ? update(record.id, changes) : create({ ...EMPTY_DAY(today), ...changes })
  return { data, patch }
}

function Scale({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  const t = useT()
  return (
    <div className="to-settings__row">
      <span>{label}</span>
      <span className="to-segmented" role="radiogroup" aria-label={label}>
        {FACES.map((Face, index) => (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={value === index + 1}
            aria-label={t(`scale.${index + 1}`)}
            className={`to-segmented__item${value === index + 1 ? ' is-active' : ''}`}
            onClick={() => onChange(index + 1)}
          >
            <Face size={16} />
          </button>
        ))}
      </span>
    </div>
  )
}

function SleepInput({ value, onSave }: { value: number | null; onSave: (hours: number | null) => void }) {
  const t = useT()
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','))
  return (
    <input
      className="to-field__input to-input--short"
      inputMode="decimal"
      value={text}
      placeholder="7,5"
      aria-label={t('checkin.sleep')}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const hours = Number(text.replace(',', '.'))
        onSave(text.trim() && Number.isFinite(hours) ? Math.min(24, Math.max(0, hours)) : null)
      }}
    />
  )
}

function CheckIn() {
  const waterGoal = useProfile().facts.waterGlasses
  const t = useT()
  const { data, patch } = useToday()

  return (
    <Card title={t('checkin.title')}>
      <div className="to-settings__rows">
        <Scale label={t('checkin.mood')} value={data.mood} onChange={(mood) => void patch({ mood })} />
        <Scale label={t('checkin.energy')} value={data.energy} onChange={(energy) => void patch({ energy })} />
        <div className="to-settings__row">
          <span className="to-toolbar to-toolbar--center">
            <Moon size={16} /> {t('checkin.sleep')}
          </span>
          {/* Keyed by the stored value: when the day loads, the field shows it. */}
          <SleepInput key={String(data.sleep)} value={data.sleep} onSave={(sleep) => void patch({ sleep })} />
        </div>
        <div className="to-settings__row">
          <span className="to-toolbar to-toolbar--center">
            <Droplets size={16} /> {t('checkin.water')}
            {waterGoal !== null && <span className="to-muted">· {t('checkin.waterGoal', { count: waterGoal })}</span>}
          </span>
          <span className="to-toolbar to-toolbar--center">
            <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('checkin.waterLess')} onClick={() => void patch({ water: Math.max(0, data.water - 1) })}>
              <Minus size={14} />
            </button>
            <strong className={waterGoal && data.water >= waterGoal ? 'to-positive' : undefined}>{t('checkin.glasses', { count: data.water })}</strong>
            <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('checkin.waterMore')} onClick={() => void patch({ water: data.water + 1 })}>
              <Plus size={14} />
            </button>
          </span>
        </div>
      </div>
    </Card>
  )
}

function Medicines() {
  const t = useT()
  const today = toLocalISODate()
  const medicines = useRecords<Medicine>('medicines', { where: { active: true } })
  const doses = useRecords<Dose>('doses', { where: { date: today } })
  const meds = useCollection<Medicine>('medicines')
  const { create, remove } = useCollection<Dose>('doses')
  const [times, setTimes] = useState('08:00')

  const taken = (medicine: Envelope<Medicine>, time: string) =>
    doses.find((dose) => dose.data.medicineId === medicine.id && dose.data.time === time)

  return (
    <Card title={t('meds.title')}>
      <div className="to-stack">
        <QuickAdd
          placeholder={t('meds.placeholder')}
          onAdd={(name) =>
            void meds.create({
              name,
              dose: '',
              times: times.split(/[,\s]+/).filter((v) => /^\d{2}:\d{2}$/.test(v)),
              active: true,
            })
          }
        >
          <input className="to-field__input to-input--short" value={times} aria-label={t('meds.times')} title={t('meds.timesHint')} onChange={(e) => setTimes(e.target.value)} />
        </QuickAdd>
        {medicines.length === 0 ? (
          <p className="to-muted">{t('meds.empty')}</p>
        ) : (
          <ul className="to-list">
            {medicines.map((medicine) => (
              <li key={medicine.id} className="to-list__item">
                <div className="to-list__main">
                  <span className="to-list__title">{medicine.data.name}</span>
                  <span className="to-list__meta">
                    {medicine.data.times.map((time) => {
                      const dose = taken(medicine, time)
                      return (
                        <span key={time} className="to-toolbar to-toolbar--center">
                          <Checkbox
                            checked={!!dose}
                            label={t('meds.take', { name: medicine.data.name, time })}
                            onChange={() => void (dose ? remove(dose.id) : create({ medicineId: medicine.id, date: today, time }))}
                          />
                          {time}
                        </span>
                      )
                    })}
                  </span>
                </div>
                <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('meds.remove')} onClick={() => void meds.remove(medicine.id)}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export function HealthScreen() {
  const t = useT()
  const format = useFormat()
  const days = useRecords<Day>('days', { sort: { field: 'date', dir: 'desc' }, limit: 14 })
  const week = days.slice(0, 7)
  const avg = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v !== null)
    return present.length ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10 : null
  }
  const sleep = avg(week.map((d) => d.data.sleep))
  const mood = avg(week.map((d) => d.data.mood))
  const water = avg(week.map((d) => d.data.water))

  return (
    <div className="to-stack">
      <StatGrid>
        <Stat label={t('stats.sleep')} value={sleep === null ? '—' : t('stats.hours', { count: sleep })} hint={t('stats.week')} />
        <Stat label={t('stats.mood')} value={mood === null ? '—' : `${mood}/5`} hint={t('stats.week')} />
        <Stat label={t('stats.water')} value={water === null ? '—' : t('checkin.glasses', { count: water })} hint={t('stats.week')} />
      </StatGrid>
      <CheckIn />
      <Medicines />
      {days.length === 0 ? (
        <EmptyState title={t('history.empty')} />
      ) : (
        <Card title={t('history.title')}>
          <Table headers={[t('history.date'), t('checkin.sleep'), t('checkin.mood'), t('checkin.energy'), t('checkin.water')]}>
            {days.map((day) => (
              <tr key={day.id}>
                <td>{format.date(day.data.date)}</td>
                <td>{day.data.sleep ?? '—'}</td>
                <td>{day.data.mood ?? '—'}</td>
                <td>{day.data.energy ?? '—'}</td>
                <td>{day.data.water}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  )
}
