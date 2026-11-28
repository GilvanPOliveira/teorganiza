import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Ruler, Trash2 } from 'lucide-react'
import { BODY_MEASURES, Button, toLocalISODate, useFormat, useProfile, useT, type BodyMeasureKey, type Envelope, type Measurement, type Risk } from '@core/api'
import { FoldCard } from './fold'

type Def = (typeof BODY_MEASURES)[number]
const GROUPS = ['tape', 'composition'] as const

const fmt = (def: Def, value: number) => value.toFixed(def.decimals).replace('.', ',')
const number = (text: string) => {
  const n = Number(text.replace(',', '.'))
  return text.trim() && Number.isFinite(n) ? n : null
}

/**
 * Medidas do corpo: the tape measures and body composition a trainer or a
 * nutritionist takes, as assessments over time. The latest of each shows
 * with how it changed since the one before, and what they work out
 * (waist-to-hip, waist-to-height, fat and lean mass) feeds the rest:
 * resting energy from lean mass, the routine check-ups from the waist.
 */
export function BodyCard() {
  const t = useT()
  const format = useFormat()
  const { measures, facts } = useProfile()
  const [adding, setAdding] = useState(false)
  const [openKey, setOpenKey] = useState<BodyMeasureKey | null>(null)

  const byKey = (key: BodyMeasureKey) => measures.filter((m) => m.data.key === key)
  const lastDate = measures[0]?.data.date ?? null
  const lastCount = lastDate ? measures.filter((m) => m.data.date === lastDate).length : 0

  const ratios: { label: string; value: string; risk: Risk | null; hint: string }[] = []
  if (facts.waist !== null) ratios.push({ label: t('body.waist'), value: `${String(facts.waist).replace('.', ',')} cm`, risk: facts.waistRisk, hint: t('body.waistHint') })
  if (facts.waistHip !== null) ratios.push({ label: t('body.waistHip'), value: String(facts.waistHip).replace('.', ','), risk: facts.waistHipRisk, hint: t('body.waistHipHint') })
  if (facts.waistHeight !== null) ratios.push({ label: t('body.waistHeight'), value: String(facts.waistHeight).replace('.', ','), risk: facts.waistHeightRisk, hint: t('body.waistHeightHint') })
  if (facts.fatMass !== null && facts.leanMass !== null)
    ratios.push({ label: t('body.mass'), value: t('body.massValue', { fat: String(facts.fatMass).replace('.', ','), lean: String(facts.leanMass).replace('.', ',') }), risk: null, hint: t('body.massHint') })

  return (
    <FoldCard
      id="me.body"
      icon={<Ruler size={16} />}
      title={t('body.title')}
      summary={lastDate ? t('body.summary', { date: format.date(lastDate), count: lastCount }) : t('body.none')}
      className="to-body"
    >
      {adding ? (
        <Assessment onDone={() => setAdding(false)} />
      ) : (
        <div className="to-body__top">
          <span className="to-body__last">
            {lastDate ? (
              <>
                {t('body.lastLabel')} <strong>{format.date(lastDate)}</strong>
              </>
            ) : (
              t('body.firstHint')
            )}
          </span>
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={14} /> {t('body.new')}
          </Button>
        </div>
      )}

      {ratios.length > 0 && (
        <section className="to-body__section">
          <span className="to-checkgroup__title">{t('body.group.ratios')}</span>
          <div className="to-body__ratios">
          {ratios.map((r) => (
            <div key={r.label} className={`to-body__ratio${r.risk ? ` is-${r.risk}` : ''}`} title={r.hint}>
              <span className="to-body__ratiohead">
                <span className="to-body__ratiolabel">{r.label}</span>
                {r.risk && <span className={`to-indcard__status is-${r.risk}`}>{t(`body.risk.${r.risk}`)}</span>}
              </span>
              <strong>{r.value}</strong>
            </div>
          ))}
          </div>
        </section>
      )}

      {GROUPS.map((group) => (
        <section key={group} className="to-body__section">
          <span className="to-checkgroup__title">{t(`body.group.${group}`)}</span>
          <div className="to-body__grid">
            {BODY_MEASURES.filter((d) => d.group === group).map((def) => (
              <MeasureTile key={def.key} def={def} history={byKey(def.key)} open={openKey === def.key} onToggle={() => setOpenKey((k) => (k === def.key ? null : def.key))} />
            ))}
          </div>
        </section>
      ))}
    </FoldCard>
  )
}

function MeasureTile({ def, history, open, onToggle }: { def: Def; history: Envelope<Measurement>[]; open: boolean; onToggle: () => void }) {
  const t = useT()
  const format = useFormat()
  const { removeMeasure } = useProfile()
  const [latest, previous] = history
  const delta = latest && previous ? Math.round((latest.data.value - previous.data.value) * 10) / 10 : 0

  return (
    <div className={`to-body__tile${latest ? '' : ' is-empty'}${open ? ' is-open' : ''}`}>
      <button type="button" className="to-body__tilehead" disabled={!latest} onClick={onToggle} title={'how' in def ? def.how : undefined}>
        <span className="to-body__label">{def.label}</span>
        <span className="to-body__value">
          {latest ? fmt(def, latest.data.value) : '—'}
          <span className="to-body__unit">{def.unit}</span>
        </span>
        <span className="to-body__meta">
          {delta !== 0 && (
            <span className={`to-body__delta${delta < 0 ? ' is-down' : ' is-up'}`}>
              {delta < 0 ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
              {String(Math.abs(delta)).replace('.', ',')}
            </span>
          )}
          {latest ? format.date(latest.data.date) : t('body.noValue')}
        </span>
      </button>
      {open && (
        <ul className="to-body__history">
          {history.slice(0, 12).map((m) => (
            <li key={m.id}>
              <span className="to-muted">{format.date(m.data.date)}</span>
              <strong>{fmt(def, m.data.value)}</strong>
              <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('body.remove')} onClick={() => void removeMeasure(m.id)}>
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A new assessment: one date, any measures filled in; the last value of each as a hint. */
function Assessment({ onDone }: { onDone: () => void }) {
  const t = useT()
  const { measures, addMeasures } = useProfile()
  const [date, setDate] = useState(toLocalISODate())
  const [values, setValues] = useState<Partial<Record<BodyMeasureKey, string>>>({})
  const [error, setError] = useState('')
  const last = (key: BodyMeasureKey) => measures.find((m) => m.data.key === key)?.data.value

  const save = async () => {
    const out: Partial<Record<BodyMeasureKey, number>> = {}
    for (const def of BODY_MEASURES) {
      const text = values[def.key]
      if (!text?.trim()) continue
      const n = number(text)
      if (n === null || n < def.min || n > def.max) return setError(t('body.invalid', { name: def.label, min: def.min, max: def.max }))
      out[def.key] = n
    }
    if (Object.keys(out).length === 0) return setError(t('body.empty'))
    await addMeasures(date, out)
    onDone()
  }

  return (
    <form
      className="to-body__form"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <header className="to-body__formhead">
        <strong>{t('body.new')}</strong>
        <label className="to-body__date">
          <span>{t('body.date')}</span>
          <input className="to-field__input" type="date" value={date} max={toLocalISODate()} onChange={(e) => setDate(e.target.value || toLocalISODate())} />
        </label>
      </header>
      {GROUPS.map((group) => (
        <fieldset key={group} className="to-body__fields">
          <legend className="to-checkgroup__title">{t(`body.group.${group}`)}</legend>
          <div className="to-body__fieldgrid">
            {BODY_MEASURES.filter((d) => d.group === group).map((def) => {
              const previous = last(def.key)
              return (
                <label key={def.key} className="to-body__field" title={'how' in def ? def.how : undefined}>
                  <span className="to-body__fieldlabel">{def.label}</span>
                  <span className="to-body__inputgroup">
                    <input
                      inputMode="decimal"
                      placeholder={previous !== undefined ? fmt(def, previous) : '—'}
                      value={values[def.key] ?? ''}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, [def.key]: e.target.value }))
                        setError('')
                      }}
                    />
                    <span>{def.unit}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <footer className="to-body__actions">
        {error && <span className="to-indcard__error">{error}</span>}
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('body.cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {t('body.save')}
        </Button>
      </footer>
    </form>
  )
}
