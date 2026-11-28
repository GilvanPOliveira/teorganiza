import { useState } from 'react'
import { Baby, Beef, CalendarDays, Droplets, Dumbbell, Eye, HeartPulse, Salad, Utensils, Wheat } from 'lucide-react'
import {
  Card,
  NoteList,
  RecordActions,
  RecordCard,
  RecordField,
  RecordForm,
  RecordInput,
  RecordRow,
  RecordStrip,
  RecordValue,
  RecordWhen,
  Segmented,
  TargetBars,
  toLocalISODate,
  useCollection,
  useFormat,
  useOpenHref,
  useProfile,
  useRecords,
  useSettings,
  useSignals,
  useT,
  type DataNote,
  type Envelope,
  type RecordTone,
  type TargetItem,
} from '@core/api'
import { byMoment, dietNotes, favourites, macroTargets, momentAt, pastDays, sum, type DietNote, type Favourite, type Targets } from './logic'
import { MOMENTS, type Meal, type MealMoment } from './schema'

/** mode '' is a person who has never chosen: hand-typed targets that differ from the default stay theirs. */
const DEFAULTS = { mode: '' as '' | 'profile' | 'manual', target: 2000, protein: 120 }

const NUMBERS = ['kcal', 'protein', 'carbs', 'fat'] as const
type NumberKey = (typeof NUMBERS)[number]
const UNIT: Record<NumberKey, string> = { kcal: 'kcal', protein: 'g', carbs: 'g', fat: 'g' }

const number = (text: string) => {
  const n = Number(text.replace(',', '.'))
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null
}
const decimal = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** The day's targets: from Meus dados unless the person typed their own. */
function useTargets() {
  const [settings, setSettings] = useSettings(DEFAULTS)
  const { facts } = useProfile()
  const signals = useSignals()
  const fromProfile = facts.kcal !== null && facts.protein !== null
  const manual = settings.mode === 'manual' || !fromProfile || (settings.mode === '' && settings.target !== facts.kcal && settings.target !== DEFAULTS.target)
  const targets: Targets = manual ? macroTargets(settings.target, settings.protein, signals) : macroTargets(facts.kcal, facts.protein, signals)
  return { targets, manual, fromProfile, settings, setSettings }
}

export function DietScreen() {
  const t = useT()
  const format = useFormat()
  const today = toLocalISODate()
  const [day, setDay] = useState(today)
  const all = useRecords<Meal>('meals', { sort: { field: 'date', dir: 'desc' } })
  const { targets, manual } = useTargets()
  const signals = useSignals()
  const { profile, facts } = useProfile()
  const [draft, setDraft] = useState<Favourite | null>(null)

  const list = all.map((m) => m.data)
  const meals = all.filter((m) => m.data.date === day)
  const totals = sum(meals.map((m) => m.data))
  const isToday = day === today

  const items: TargetItem[] = NUMBERS.map((key) => ({
    key,
    label: t(`num.${key}`),
    value: totals[key],
    target: targets[key],
    unit: UNIT[key],
    over: key === 'kcal' || key === 'fat' ? 'bad' : 'fine',
  }))
  if (isToday && (facts.waterGlasses !== null || signals.water))
    items.push({ key: 'water', label: t('num.water'), value: signals.water?.value ?? 0, target: facts.waterGlasses, unit: t('num.glasses'), over: 'fine', from: t('from.day') })

  const notes = isToday ? dietNotes({ signals, flags: profile.flags ?? [], goal: profile.goal, facts, totals, targets, hour: new Date().getHours() }) : []

  return (
    <div className="to-stack">
      <Card
        className="to-ind to-diet"
        title={
          <span className="to-card__titleicon">
            <Utensils size={16} /> {isToday ? t('today.title') : t('today.dayTitle', { date: format.date(day) })}
          </span>
        }
        actions={
          isToday ? (
            <span className="to-muted">{manual ? t('today.targetManual') : t('today.targetProfile')}</span>
          ) : (
            <button type="button" className="to-linkbutton" onClick={() => setDay(today)}>
              {t('today.back')}
            </button>
          )
        }
      >
        <div className="to-ind__layout">
          <section className="to-ind__latest" aria-label={t('today.title')}>
            <TargetBars items={items} />
            <DietNotes notes={notes} />
            {meals.length === 0 ? (
              <p className="to-diet__empty">{isToday ? t('empty.today') : t('empty.day')}</p>
            ) : (
              <RecordStrip label={t('today.meals')}>{byMoment(meals).flatMap((group) => group.meals.map((meal) => <MealCard key={meal.id} meal={meal} />))}</RecordStrip>
            )}
          </section>
          <MealForm day={day} draft={draft} meals={list} onUsed={() => setDraft(null)} />
        </div>
      </Card>

      <Again meals={list} onPick={setDraft} />
      <PastDays meals={list} today={today} target={targets.kcal} selected={day} onOpen={setDay} />
      <TargetCard />
    </div>
  )
}

const NOTE_ICON: Record<DietNote['kind'], typeof Dumbbell> = {
  trained: Dumbbell,
  training: Dumbbell,
  sodium: HeartPulse,
  carbs: Wheat,
  fat: Salad,
  pregnancy: Baby,
  water: Droplets,
  proteinLeft: Beef,
}

/** Where each note's data lives, to open it. */
const NOTE_SOURCE: Record<DietNote['kind'], string> = {
  trained: '/workouts',
  training: '/workouts',
  sodium: '/health/exams',
  carbs: '/health/exams',
  fat: '/health/exams',
  pregnancy: '/health/me',
  water: '/health',
  proteinLeft: '',
}

/** What Treino, Exames, Meus dados and the day say about eating today. */
function DietNotes({ notes }: { notes: DietNote[] }) {
  const t = useT()
  const openHref = useOpenHref()
  const list: DataNote[] = notes.map((note) => {
    const Icon = NOTE_ICON[note.kind]
    const key = note.kind === 'sodium' ? `note.sodium.${note.reason}` : note.kind === 'carbs' ? `note.carbs.${note.reason}` : `note.${note.kind}`
    const text = t(key, { ...note, value: 'value' in note ? decimal(note.value) : undefined })
    const href = NOTE_SOURCE[note.kind]
    return {
      key: note.kind,
      tone: note.kind === 'trained' || note.kind === 'training' ? 'good' : 'warn',
      icon: <Icon size={15} />,
      text: href ? (
        <button type="button" className="to-diet__notelink" onClick={() => openHref(href)}>
          {text}
        </button>
      ) : (
        text
      ),
    }
  })
  return <NoteList notes={list} className="to-diet__notes" />
}

/**
 * One meal: which meal of the day and when on top, what was eaten, its
 * numbers, edit and delete at the base. Editing changes the name and numbers.
 */
function MealCard({ meal }: { meal: Envelope<Meal> }) {
  const t = useT()
  const { update, remove } = useCollection<Meal>('meals')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const m = meal.data

  const start = () => {
    setDraft({ name: m.name, ...Object.fromEntries(NUMBERS.map((k) => [k, m[k] ? decimal(m[k]) : ''])) })
    setError(false)
    setEditing(true)
  }
  const save = async () => {
    const name = (draft.name ?? '').trim()
    const values = Object.fromEntries(NUMBERS.map((k) => [k, (draft[k] ?? '').trim() ? number(draft[k]) : 0]))
    if (!name || Object.values(values).some((v) => v === null)) return setError(true)
    await update(meal.id, { name, ...(values as Record<NumberKey, number>) })
    setEditing(false)
  }
  const set = (key: string) => (value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setError(false)
  }

  return (
    <RecordCard
      title={m.moment ? t(`moment.${m.moment}`) : t('moment.none')}
      aside={m.time ?? ''}
      editing={editing}
      error={error}
      actions={
        <RecordActions
          editing={editing}
          onEdit={start}
          onRemove={() => {
            if (confirm(t('meal.removeAsk', { name: m.name }))) void remove(meal.id)
          }}
          onSave={() => void save()}
          onCancel={() => setEditing(false)}
        />
      }
    >
      <div className="to-diet__name">{editing ? <RecordInput label={t('form.name')} value={draft.name ?? ''} onChange={set('name')} inputMode="text" wide /> : <span title={m.name}>{m.name}</span>}</div>
      {NUMBERS.map((k) => (
        <RecordRow key={k} name={t(`num.${k}`)} unit={UNIT[k]}>
          {editing ? (
            <span className="to-readcards__cell to-readcards__cell--edit">
              <RecordInput label={t(`num.${k}`)} value={draft[k] ?? ''} onChange={set(k)} />
            </span>
          ) : (
            <RecordValue tone={m[k] ? undefined : 'empty'}>{m[k] ? decimal(m[k]) : '—'}</RecordValue>
          )}
        </RecordRow>
      ))}
    </RecordCard>
  )
}

const EMPTY_VALUES: Record<NumberKey, string> = { kcal: '', protein: '', carbs: '', fat: '' }

/**
 * Registrar refeição: when, which meal (guessed from the time until chosen),
 * what was eaten (what was eaten before is offered as it is typed) and its
 * numbers; only the name is required.
 */
function MealForm({ day, draft, meals, onUsed }: { day: string; draft: Favourite | null; meals: readonly Meal[]; onUsed: () => void }) {
  const t = useT()
  const today = toLocalISODate()
  const { create } = useCollection<Meal>('meals')
  const [date, setDate] = useState(day)
  const [time, setTime] = useState(nowTime())
  const [moment, setMoment] = useState<MealMoment | null>(null)
  const [name, setName] = useState('')
  const [values, setValues] = useState(EMPTY_VALUES)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [seen, setSeen] = useState({ day, draft })
  const known = favourites(meals, 50)

  const fill = (f: Favourite) => {
    setName(f.name)
    setValues({ kcal: decimal(f.kcal), protein: f.protein ? decimal(f.protein) : '', carbs: f.carbs ? decimal(f.carbs) : '', fat: f.fat ? decimal(f.fat) : '' })
    setError('')
    setSaved(false)
  }

  // A day opened from the history, or a meal picked to eat again, lands in the form.
  if (seen.day !== day || seen.draft !== draft) {
    setSeen({ day, draft })
    if (seen.day !== day) setDate(day)
    if (draft && seen.draft !== draft) fill(draft)
  }

  const save = async () => {
    if (!name.trim()) return setError(t('form.noName'))
    const numbers = {} as Record<NumberKey, number>
    for (const k of NUMBERS) {
      const v = values[k].trim() ? number(values[k]) : 0
      if (v === null || v > (k === 'kcal' ? 5000 : 500)) return setError(t('form.invalid', { name: t(`num.${k}`) }))
      numbers[k] = v
    }
    await create({ date, time: time || null, moment: moment ?? (time ? momentAt(time) : null), name: name.trim(), ...numbers })
    setName('')
    setValues(EMPTY_VALUES)
    setMoment(null)
    setTime(nowTime())
    setSaved(true)
    onUsed()
  }

  const guessed = time ? momentAt(time) : null
  return (
    <RecordForm title={t('form.title')} submitLabel={t('form.save')} error={error} saved={saved ? t('form.saved') : undefined} onSubmit={() => void save()}>
      <RecordWhen date={date} time={time} today={today} onDate={setDate} onTime={setTime} />
      <div className="to-record__fields to-diet__what">
        <label className="to-record__field">
          <span className="to-body__fieldlabel">{t('form.moment')}</span>
          <select className="to-field__input" value={moment ?? ''} onChange={(e) => setMoment((e.target.value || null) as MealMoment | null)}>
            <option value="">{guessed ? t('form.byTime', { moment: t(`moment.${guessed}`) }) : t('moment.none')}</option>
            {MOMENTS.map((m) => (
              <option key={m} value={m}>
                {t(`moment.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="to-record__field">
          <span className="to-body__fieldlabel">{t('form.name')}</span>
          <input
            className="to-field__input"
            list="to-diet-known"
            placeholder={t('form.namePlaceholder')}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
              setSaved(false)
              const match = known.find((f) => f.name.toLocaleLowerCase('pt-BR') === e.target.value.trim().toLocaleLowerCase('pt-BR'))
              if (match && NUMBERS.every((k) => !values[k].trim())) fill(match)
            }}
          />
          <datalist id="to-diet-known">
            {known.map((f) => (
              <option key={f.name} value={f.name} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="to-record__fields to-diet__numbers">
        {NUMBERS.map((k) => (
          <RecordField key={k} label={t(`num.${k}`)} unit={UNIT[k]}>
            <input
              inputMode="decimal"
              placeholder="—"
              value={values[k]}
              onChange={(e) => {
                setValues((v) => ({ ...v, [k]: e.target.value }))
                setError('')
                setSaved(false)
              }}
            />
          </RecordField>
        ))}
      </div>
    </RecordForm>
  )
}

/** Comer de novo: what is eaten most; one click puts it in the form. */
function Again({ meals, onPick }: { meals: readonly Meal[]; onPick: (f: Favourite) => void }) {
  const t = useT()
  const list = favourites(meals, 12)
  if (list.length === 0) return null
  return (
    <Card title={t('again.title')} actions={<span className="to-muted">{t('again.hint')}</span>}>
      <div className="to-diet__again">
        {list.map((f) => (
          <button key={f.name} type="button" className="to-diet__food" onClick={() => onPick(f)}>
            <span className="to-diet__foodname">{f.name}</span>
            <span className="to-diet__foodmeta">
              {Math.round(f.kcal)} kcal · {decimal(f.protein)} g {t('num.proteinShort')}
              {f.count > 1 && <span className="to-diet__count">{t('again.times', { count: f.count })}</span>}
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}

/** Dias anteriores: one card per day, the calories against the target, opening the day above. */
function PastDays({ meals, today, target, selected, onOpen }: { meals: readonly Meal[]; today: string; target: number | null; selected: string; onOpen: (day: string) => void }) {
  const t = useT()
  const format = useFormat()
  const days = pastDays(meals, today)
  if (days.length === 0) return null
  const week = days.slice(0, 7)
  const avg = Math.round(week.reduce((n, d) => n + d.kcal, 0) / week.length)
  const tone = (kcal: number): RecordTone | undefined => {
    if (!target) return undefined
    const share = kcal / target
    return share > 1.1 ? 'high' : share < 0.75 ? 'attention' : 'normal'
  }
  return (
    <Card
      className="to-ind"
      title={
        <span className="to-card__titleicon">
          <CalendarDays size={16} /> {t('history.title')}
        </span>
      }
      actions={<span className="to-muted">{t('history.avg', { kcal: avg })}</span>}
    >
      <RecordStrip label={t('history.title')}>
        {days.map((d) => (
          <RecordCard
            key={d.date}
            title={format.date(d.date).slice(0, 5)}
            aside={new Date(`${d.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
            editing={d.date === selected}
            actions={
              <button
                type="button"
                className="to-readcards__btn to-diet__open"
                onClick={() => {
                  onOpen(d.date)
                  document.querySelector('.to-diet')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                <Eye size={13} /> {t('history.open', { count: d.meals })}
              </button>
            }
          >
            {NUMBERS.map((k) => (
              <RecordRow key={k} name={t(`num.${k}`)} unit={UNIT[k]}>
                <RecordValue tone={k === 'kcal' ? tone(d.kcal) : d[k] ? undefined : 'empty'}>{d[k] ? Math.round(d[k]) : '—'}</RecordValue>
              </RecordRow>
            ))}
            {target && (
              <RecordRow name={t('history.vsTarget')}>
                <RecordValue tone={tone(d.kcal)}>{Math.round((d.kcal / target) * 100)}%</RecordValue>
              </RecordRow>
            )}
          </RecordCard>
        ))}
      </RecordStrip>
    </Card>
  )
}

/** Meta diária: from Meus dados by default, or typed by hand. */
function TargetCard() {
  const t = useT()
  const openHref = useOpenHref()
  const { facts } = useProfile()
  const { targets, manual, fromProfile, settings, setSettings } = useTargets()
  return (
    <Card title={t('target.title')}>
      <div className="to-diet__target">
        <Segmented
          label={t('target.title')}
          value={manual ? 'manual' : 'profile'}
          onChange={(mode) => void setSettings(mode === 'manual' && fromProfile && settings.mode !== 'manual' ? { mode, target: facts.kcal!, protein: facts.protein! } : { mode })}
          options={[
            { value: 'profile', label: t('target.profile') },
            { value: 'manual', label: t('target.manual') },
          ]}
        />
        {!fromProfile && (
          <button type="button" className="to-plans__hint" onClick={() => openHref('/health/me')}>
            {t('target.fillProfile')}
          </button>
        )}
        {manual ? (
          <div className="to-record__fields to-diet__numbers">
            <RecordField label={t('num.kcal')} unit="kcal">
              <input inputMode="numeric" defaultValue={settings.target} key={`k${settings.target}`} onBlur={(e) => void setSettings({ mode: 'manual', target: number(e.target.value) || DEFAULTS.target })} />
            </RecordField>
            <RecordField label={t('num.protein')} unit="g">
              <input inputMode="numeric" defaultValue={settings.protein} key={`p${settings.protein}`} onBlur={(e) => void setSettings({ mode: 'manual', protein: number(e.target.value) || DEFAULTS.protein })} />
            </RecordField>
          </div>
        ) : (
          <p className="to-diet__targetline">{t('target.fromProfile', { kcal: targets.kcal, protein: targets.protein })}</p>
        )}
        {targets.carbs !== null && <p className="to-muted to-diet__targetline">{t('target.split', { carbs: targets.carbs, fat: targets.fat })}</p>}
      </div>
    </Card>
  )
}
