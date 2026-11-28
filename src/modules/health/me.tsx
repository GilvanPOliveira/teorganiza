import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Dumbbell, Flame, Info, Ruler, Scale, ShieldAlert, Trash2, UserRound } from 'lucide-react'
import {
  ACTIVITIES,
  Button,
  Card,
  DateInput,
  GOALS,
  LEVELS,
  PLACES,
  RESTRICTIONS,
  Segmented,
  SEXES,
  Stat,
  StatGrid,
  toLocalISODate,
  useFormat,
  useProfile,
  useT,
  type Envelope,
  type Restriction,
  type WeightEntry,
} from '@core/api'
import { BodyCard } from './body'
import { useRemembered } from './fold'

const decimal = (text: string): number | null => {
  const value = Number(text.replace(',', '.'))
  return text.trim() && Number.isFinite(value) && value > 0 ? value : null
}
const kgLabel = (kg: number) => `${String(Math.round(kg * 10) / 10).replace('.', ',')} kg`


/**
 * Meus dados: filled in once, used across Saúde. Each choice can be left
 * empty; the "what this changes" card shows what each one unlocks.
 *
 * About you and goal & routine sit on the left, the weight on the right at
 * their combined height: its chart gets room and its history scrolls inside
 * the card instead of stretching the page.
 */
export function MeScreen() {
  const t = useT()
  const { profile, facts, save } = useProfile()
  // '' stands for "not said" in the segmented choices.
  const pick = <V extends string>(value: V | null) => (value ?? '') as V | ''

  return (
    <div className="to-stack to-me">
      <div className="to-me__top">
        <div className="to-me__left">
          <Card
            title={<CardTitle icon={<UserRound size={16} />} text={t('me.about')} />}
            actions={<AboutSummary age={facts.age} height={profile.height} weight={facts.weight?.kg ?? null} />}
          >
            <div className="to-me__fields">
              <span className="to-me__label">{t('me.sex')}</span>
              <Segmented<'' | (typeof SEXES)[number]>
                label={t('me.sex')}
                value={pick(profile.sex)}
                onChange={(sex) => void save({ sex: sex || null })}
                options={[{ value: '', label: '—' }, ...SEXES.map((value) => ({ value, label: t(`me.sex.${value}`) }))]}
              />
              <label className="to-me__label" htmlFor="me-birth">
                {t('me.birth')}
              </label>
              <DateInput id="me-birth" className="to-input--date" value={profile.birth} min="1900-01-01" max={toLocalISODate(new Date())} onSave={(birth) => void save({ birth })} />
              <label className="to-me__label" htmlFor="me-height">
                {t('me.height')}
              </label>
              <input
                id="me-height"
                className="to-field__input to-me__num"
                inputMode="numeric"
                placeholder="cm"
                key={String(profile.height)}
                defaultValue={profile.height ?? ''}
                onBlur={(e) => {
                  const cm = decimal(e.target.value)
                  void save({ height: cm && cm >= 50 && cm <= 260 ? Math.round(cm) : null })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
            </div>
          </Card>

          <Card title={<CardTitle icon={<Dumbbell size={16} />} text={t('me.training')} />}>
            <div className="to-me__fields to-me__fields--compact">
              <span className="to-me__label">{t('me.goal')}</span>
              <Segmented<'' | (typeof GOALS)[number]>
                label={t('me.goal')}
                value={pick(profile.goal)}
                onChange={(goal) => void save({ goal: goal || null })}
                options={GOALS.map((value) => ({ value, label: t(`me.goal.${value}`) }))}
              />
              <span className="to-me__label">{t('me.levelShort')}</span>
              <Segmented<'' | (typeof LEVELS)[number]>
                label={t('me.level')}
                value={pick(profile.level)}
                onChange={(level) => void save({ level: level || null })}
                options={LEVELS.map((value) => ({ value, label: t(`me.level.${value}`) }))}
              />
              <span className="to-me__label">{t('me.daysShort')}</span>
              <Segmented<string>
                label={t('me.days')}
                value={profile.days ? String(profile.days) : ''}
                onChange={(days) => void save({ days: days ? Number(days) : null })}
                options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `${n}×` }))}
              />
              <span className="to-me__label">{t('me.place')}</span>
              <Segmented<'' | (typeof PLACES)[number]>
                label={t('me.place')}
                value={pick(profile.place)}
                onChange={(place) => void save({ place: place || null })}
                options={PLACES.map((value) => ({ value, label: t(`me.place.${value}`) }))}
              />
              <span className="to-me__label">{t('me.activityShort')}</span>
              <Segmented<'' | (typeof ACTIVITIES)[number]>
                label={t('me.activity')}
                value={pick(profile.activity)}
                onChange={(activity) => void save({ activity: activity || null })}
                options={ACTIVITIES.map((value) => ({ value, label: t(`me.activity.${value}`) }))}
              />
            </div>
          </Card>
        </div>

        <WeightCard />
      </div>

      <BodyCard />

      <RestrictionsCard />

      <FactsCard />
    </div>
  )
}

/** Age, height and the latest weighing, at a glance in the card's header. */
function AboutSummary({ age, height, weight }: { age: number | null; height: number | null; weight: number | null }) {
  const t = useT()
  const parts = [
    age !== null && t('me.years', { count: age }),
    height !== null && `${String(height / 100).replace('.', ',')} m`,
    weight !== null && kgLabel(weight),
  ].filter(Boolean) as string[]
  if (parts.length === 0) return null
  return (
    <span className="to-me__summary">
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
    </span>
  )
}

function CardTitle({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="to-card__titleicon">
      {icon}
      {text}
    </span>
  )
}

function WeightCard() {
  const t = useT()
  const format = useFormat()
  const { weights, facts, addWeight, removeWeight } = useProfile()
  const today = toLocalISODate(new Date())
  const [kg, setKg] = useState('')
  const [date, setDate] = useState(today)

  const add = async () => {
    const value = decimal(kg)
    if (!value || value < 20 || value > 400) return
    await addWeight({ date, kg: Math.round(value * 10) / 10 })
    setKg('')
    setDate(today)
  }

  const first = weights[weights.length - 1]
  const change = facts.weight && first && first !== weights[0] ? facts.weight.kg - first.data.kg : null

  return (
    <Card
      className="to-me__weightcard"
      title={<CardTitle icon={<Scale size={16} />} text={t('me.weight')} />}
      actions={weights.length > 0 ? <span className="to-muted">{t('me.weighings', { count: weights.length })}</span> : undefined}
    >
      <div className="to-me__weight">
        <strong className="to-me__big">{facts.weight ? kgLabel(facts.weight.kg) : '—'}</strong>
        <span className="to-muted">
          {facts.weight ? t('me.weighedOn', { date: format.date(facts.weight.date) }) : t('me.noWeight')}
          {change !== null && change !== 0 && (
            <>
              {' · '}
              <span className={change < 0 ? 'to-positive' : undefined}>
                {change > 0 ? '+' : '−'}
                {kgLabel(Math.abs(change))}
              </span>{' '}
              {t('me.sinceFirst')}
            </>
          )}
        </span>
      </div>
      <WeightChart weights={weights} />
      <form
        className="to-me__weighin"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input className="to-field__input to-me__num" inputMode="decimal" placeholder="kg" aria-label={t('me.weight')} value={kg} onChange={(e) => setKg(e.target.value)} />
        <input className="to-field__input to-input--date" type="date" aria-label={t('me.weightDate')} value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
        <Button type="submit" variant="primary" disabled={!decimal(kg)}>
          {t('me.addWeight')}
        </Button>
      </form>
      {weights.length > 0 ? (
        <WeightHistory weights={weights} onRemove={(id) => void removeWeight(id)} />
      ) : (
        <div className="to-me__history to-me__history--empty">{t('me.historyEmpty')}</div>
      )}
    </Card>
  )
}

/**
 * The weighings, newest first, scrolling inside the card. The edge that
 * hides more fades, and a "more" pill at the bottom glides down to them.
 */
function WeightHistory({ weights, onRemove }: { weights: Envelope<WeightEntry>[]; onRemove: (id: string) => void }) {
  const t = useT()
  const format = useFormat()
  const listRef = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ above: false, below: 0 })

  const measure = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const bottom = list.scrollTop + list.clientHeight
    const below = Array.from(list.children).filter((li) => (li as HTMLElement).offsetTop + (li as HTMLElement).offsetHeight / 2 > bottom).length
    const above = list.scrollTop > 2
    setEdges((e) => (e.above === above && e.below === below ? e : { above, below }))
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [measure, weights.length])

  const more = () => {
    const list = listRef.current
    if (list) list.scrollBy({ top: list.clientHeight * 0.75, behavior: 'smooth' })
  }

  return (
    <div className={`to-me__history${edges.above ? ' has-above' : ''}${edges.below ? ' has-below' : ''}`}>
      <ul ref={listRef} className="to-list to-me__weights" onScroll={measure}>
        {weights.map((w, i) => {
          const previous = weights[i + 1]
          const diff = previous ? Math.round((w.data.kg - previous.data.kg) * 10) / 10 : 0
          return (
            <li key={w.id} className="to-list__item">
              <span className="to-list__main">{format.date(w.data.date)}</span>
              {diff !== 0 && (
                <span className={`to-me__diff${diff < 0 ? ' to-positive' : ''}`}>
                  {diff > 0 ? '+' : '−'}
                  {String(Math.abs(diff)).replace('.', ',')}
                </span>
              )}
              <strong>{kgLabel(w.data.kg)}</strong>
              <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('me.removeWeight')} onClick={() => onRemove(w.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="to-me__morepill" tabIndex={edges.below ? 0 : -1} aria-hidden={!edges.below} onClick={more}>
        <ChevronDown size={14} />
        {t('me.moreWeighings', { count: edges.below })}
      </button>
    </div>
  )
}

/**
 * The weight over time, across the card's width. Its space is always
 * there: empty, it shows the frame and says what fills it.
 */
function WeightChart({ weights }: { weights: Envelope<WeightEntry>[] }) {
  const t = useT()
  const format = useFormat()
  const points = [...weights].reverse().slice(-30)
  const w = 300
  const h = 100
  const grid = [0.2, 0.5, 0.8].map((f) => <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} className="to-me__grid" />)

  if (points.length < 2) {
    return (
      <figure className="to-me__chart is-empty">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
          {grid}
          {points.length === 1 && <path d={`M${w},${h / 2} l0,0`} className="to-me__dot" />}
        </svg>
        <span className="to-me__chartnote">{t(points.length === 1 ? 'me.chartOne' : 'me.chartEmpty')}</span>
        <figcaption>
          <span>{points.length === 1 ? format.date(points[0].data.date) : ' '}</span>
        </figcaption>
      </figure>
    )
  }

  const values = points.map((p) => p.data.kg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const coords = points.map((p, i) => [(i / (points.length - 1)) * w, h - 8 - ((p.data.kg - min) / span) * (h - 16)])
  const path = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = coords[coords.length - 1]
  return (
    <figure className="to-me__chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        {grid}
        <path d={`${path} L${w},${h} L0,${h} Z`} className="to-me__area" />
        <path d={path} className="to-me__stroke" />
        {/* A zero-length round-capped line: stays a dot however the chart is stretched. */}
        <path d={`M${lx.toFixed(1)},${ly.toFixed(1)} l0,0`} className="to-me__dot" />
      </svg>
      <figcaption>
        <span>{format.date(points[0].data.date)}</span>
        <span>
          {kgLabel(min)} – {kgLabel(max)}
        </span>
        <span>{format.date(points[points.length - 1].data.date)}</span>
      </figcaption>
    </figure>
  )
}

/** Restrictions: folded by default, with what is written shown in the header. */
function RestrictionsCard() {
  const t = useT()
  const { profile, save } = useProfile()
  const [open, setOpen] = useRemembered('restrictions')
  const flags = profile.flags ?? []
  const toggle = (flag: Restriction) => void save({ flags: flags.includes(flag) ? flags.filter((f) => f !== flag) : [...flags, flag] })
  const summary = [...flags.map((f) => t(`me.flag.${f}`)), profile.restrictions].filter(Boolean).join(' · ')
  return (
    <section className={`to-card to-me__fold${open ? ' is-open' : ''}`}>
      <button type="button" className="to-card__header to-me__foldhead" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <CardTitle icon={<ShieldAlert size={16} />} text={t('me.restrictions')} />
        <span className="to-me__foldsummary">{summary || t('me.noRestrictions')}</span>
        <ChevronDown size={16} className="to-me__chevron" />
      </button>
      {open && (
        <div className="to-card__body to-restr">
          {/* What changes the training: each option is a rule on exercises. */}
          <div className="to-restr__group">
            <div className="to-restr__head">
              <strong>{t('me.flagsTitle')}</strong>
              <span className="to-muted">{t('me.flagsHint')}</span>
            </div>
            <div className="to-restr__options" role="group" aria-label={t('me.flagsTitle')}>
              {RESTRICTIONS.map((flag) => {
                const on = flags.includes(flag)
                return (
                  <button key={flag} type="button" role="checkbox" aria-checked={on} className={`to-restr__opt${on ? ' is-on' : ''}`} onClick={() => toggle(flag)}>
                    <span className="to-restr__box">{on && <Check size={12} strokeWidth={3} />}</span>
                    <span className="to-restr__text">
                      <span className="to-restr__name">{t(`me.flag.${flag}`)}</span>
                      <span className="to-restr__desc">{t(`me.flagDesc.${flag}`)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes only: kept for reference, read by no rule. */}
          <div className="to-restr__group">
            <div className="to-restr__head">
              <label htmlFor="me-notes">
                <strong>{t('me.notesTitle')}</strong>
              </label>
              <span className="to-muted">{t('me.notesHint')}</span>
            </div>
            <textarea
              id="me-notes"
              className="to-field__input to-restr__notes"
              rows={3}
              key={profile.restrictions}
              defaultValue={profile.restrictions}
              placeholder={t('me.restrictionsPlaceholder')}
              onBlur={(e) => void save({ restrictions: e.target.value.trim() })}
            />
          </div>
        </div>
      )}
    </section>
  )
}

/** What the data unlocks; where it is used, and how, behind "Mais informações". */
function FactsCard() {
  const t = useT()
  const { facts, profile } = useProfile()
  const [more, setMore] = useRemembered('facts')
  const missing = (keys: string[]) => t('me.needs', { what: keys.map((k) => t(`me.field.${k}`)).join(', ') })

  const needsEnergy = [
    !profile.sex && 'sex',
    facts.age === null && 'birth',
    !profile.height && 'height',
    !facts.weight && 'weight',
  ].filter(Boolean) as string[]

  return (
    <Card title={<CardTitle icon={<Flame size={16} />} text={t('me.facts')} />}>
      <StatGrid>
        <Stat
          label={t('me.bmi')}
          value={facts.bmi === null ? '—' : String(facts.bmi).replace('.', ',')}
          hint={facts.bmiBand ? t(`me.bmi.${facts.bmiBand}`) : missing([!profile.height && 'height', !facts.weight && 'weight'].filter(Boolean) as string[])}
          tone={facts.bmiBand === 'normal' ? 'positive' : undefined}
        />
        <Stat
          label={t('me.daily')}
          value={facts.daily === null ? '—' : `${facts.daily} kcal`}
          hint={facts.daily === null ? missing(needsEnergy) : t(facts.restingFrom === 'leanMass' ? 'me.dailyHintLean' : 'me.dailyHint', { resting: facts.resting })}
        />
        <Stat
          label={t('me.kcal')}
          value={facts.kcal === null ? '—' : `${facts.kcal} kcal`}
          hint={facts.kcal === null ? missing(needsEnergy) : t(`me.kcalHint.${profile.goal ?? 'health'}`)}
        />
        <Stat
          label={t('me.protein')}
          value={facts.protein === null ? '—' : `${facts.protein} g`}
          hint={facts.protein === null ? missing(['weight']) : t('me.perDay')}
        />
        <Stat
          label={t('me.water')}
          value={facts.waterMl === null ? '—' : `${(facts.waterMl / 1000).toFixed(1).replace('.', ',')} L`}
          hint={facts.waterGlasses === null ? missing(['weight']) : t('me.glasses', { count: facts.waterGlasses })}
        />
      </StatGrid>
      <button type="button" className="to-me__more" aria-expanded={more} onClick={() => setMore((v) => !v)}>
        <Info size={14} />
        {more ? t('me.lessInfo') : t('me.moreInfo')}
      </button>
      {more && (
        <div className="to-me__info">
          <ul className="to-me__uses">
            <li>
              <Dumbbell size={14} /> {t('me.use.workouts')}
            </li>
            <li>
              <Flame size={14} /> {t('me.use.diet')}
            </li>
            <li>
              <Ruler size={14} /> {t('me.use.day')}
            </li>
            <li>
              <ShieldAlert size={14} /> {t('me.use.exams')}
            </li>
          </ul>
          <p className="to-muted to-me__note">{t('me.disclaimer')}</p>
        </div>
      )}
    </Card>
  )
}
