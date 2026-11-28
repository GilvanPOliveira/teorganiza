import { useState } from 'react'
import { Activity, FlaskConical, Trash2, X } from 'lucide-react'
import {
  Card,
  RecordActions,
  RecordCard,
  RecordField,
  RecordForm,
  RecordInput,
  RecordRow,
  RecordStrip,
  RecordValue,
  RecordWhen,
  toLocalISODate,
  useCollection,
  useFormat,
  useProfile,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import { formatValue, MARKERS, type Marker } from './markers'
import type { Reading } from './schema'

const DAILY = MARKERS.filter((m) => m.kind === 'daily')
const LAB = MARKERS.filter((m) => m.kind === 'lab')

/** Newest first: by date, then time. */
const newestFirst = (a: Envelope<Reading>, b: Envelope<Reading>) =>
  (b.data.date + (b.data.time ?? '')).localeCompare(a.data.date + (a.data.time ?? ''))

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const number = (text: string) => {
  const n = Number(text.replace(',', '.'))
  return text.trim() && Number.isFinite(n) ? n : null
}

/**
 * Seus indicadores: what can be measured at home. On one side the latest
 * of each (value, how it compares with the usual range, the trend), on the
 * other the fields to record a new measurement, any of them at once.
 */
export function Indicators() {
  const t = useT()
  const readings = useRecords<Reading>('readings').sort(newestFirst)

  return (
    <Card
      className="to-ind"
      title={
        <span className="to-card__titleicon">
          <Activity size={16} /> {t('ind.title')}
        </span>
      }
    >
      <div className="to-ind__layout">
        <section className="to-ind__latest" aria-label={t('ind.latest')}>
          <div className="to-ind__grid">
            {DAILY.map((marker) => (
              <IndicatorCard key={marker.id} marker={marker} readings={readings.filter((r) => r.data.marker === marker.id)} />
            ))}
          </div>
          <ReadingsTable readings={readings.filter((r) => DAILY.some((m) => m.id === r.data.marker))} />
        </section>
        <RecordPanel />
      </div>
    </Card>
  )
}

/**
 * Resultados de laboratório: the measures read from imported reports.
 * They are never typed here; the card appears once a report brings one,
 * and shows only the measures that have a value.
 */
export function LabResults() {
  const t = useT()
  const readings = useRecords<Reading>('readings').sort(newestFirst)
  const shown = LAB.filter((m) => readings.some((r) => r.data.marker === m.id))
  if (shown.length === 0) return null
  return (
    <Card
      className="to-ind"
      title={
        <span className="to-card__titleicon">
          <FlaskConical size={16} /> {t('ind.labTitle')}
        </span>
      }
      actions={<span className="to-muted">{t('ind.labHint')}</span>}
    >
      <div className="to-ind__grid to-ind__grid--lab">
        {shown.map((marker) => (
          <IndicatorCard key={marker.id} marker={marker} readings={readings.filter((r) => r.data.marker === marker.id)} readOnly />
        ))}
      </div>
    </Card>
  )
}

function IndicatorCard({ marker, readings, readOnly = false }: { marker: Marker; readings: Envelope<Reading>[]; readOnly?: boolean }) {
  const t = useT()
  const format = useFormat()
  const { profile } = useProfile()
  const { remove } = useCollection<Reading>('readings')
  const [history, setHistory] = useState(false)
  const latest = readings[0]?.data
  const status = latest ? marker.status(latest.value, latest.value2 ?? undefined, profile.sex) : null

  const when = (r: Reading) => {
    const today = toLocalISODate()
    const day = r.date === today ? t('ind.today') : format.date(r.date)
    return r.time ? `${day}, ${r.time}` : day
  }

  return (
    <article className={`to-indcard${status ? ` is-${status}` : ''}${latest ? '' : ' is-empty'}`}>
      <div className="to-indcard__top">
        <span className="to-indcard__label">{marker.short}</span>
        {status && <span className={`to-indcard__status is-${status}`}>{t(`ind.status.${status}`)}</span>}
      </div>

      {history ? (
        <ul className="to-indcard__history">
          {readings.slice(0, 30).map((r) => (
            <li key={r.id}>
              <span className="to-muted">{when(r.data)}</span>
              <strong>{formatValue(marker, r.data.value, r.data.value2 ?? undefined)}</strong>
              {readOnly ? (
                <span />
              ) : (
                <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('ind.remove')} onClick={() => void remove(r.id)}>
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
          <li className="to-indcard__historyfoot">
            <button type="button" className="to-linkbutton" onClick={() => setHistory(false)}>
              <X size={12} /> {t('ind.close')}
            </button>
          </li>
        </ul>
      ) : (
        <>
          <button type="button" className="to-indcard__value" disabled={!latest} onClick={() => setHistory(true)} title={latest ? t('ind.seeHistory') : undefined}>
            {latest ? formatValue(marker, latest.value, latest.value2 ?? undefined) : '—'}
            <span className="to-indcard__unit">{marker.unit}</span>
          </button>
          {readings.length > 1 && <Sparkline marker={marker} readings={readings} />}
          {latest && <span className="to-indcard__when">{when(latest)}</span>}
        </>
      )}
    </article>
  )
}

/** The last readings as a line, oldest to newest; the second number of pressure as a fainter line. */
function Sparkline({ marker, readings }: { marker: Marker; readings: Envelope<Reading>[] }) {
  const points = readings.slice(0, 12).reverse()
  const values = points.flatMap((p) => [p.data.value, ...(p.data.value2 !== null ? [p.data.value2] : [])])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const y = (v: number) => 26 - ((v - min) / span) * 22
  const line = (pick: (r: Reading) => number | null) =>
    points
      .map((p, i) => [i, pick(p.data)] as const)
      .filter(([, v]) => v !== null)
      .map(([i, v], n) => `${n ? 'L' : 'M'}${((i / (points.length - 1)) * 100).toFixed(1)},${y(v!).toFixed(1)}`)
      .join(' ')
  return (
    <svg className="to-indcard__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      {marker.pair && <path d={line((r) => r.value2)} className="to-indcard__line is-second" />}
      <path d={line((r) => r.value)} className="to-indcard__line" />
    </svg>
  )
}

/**
 * Registrar medição: when (now by default) and a field per measure; only
 * what is filled in is saved, each as its own reading at that moment.
 */
function RecordPanel() {
  const t = useT()
  const today = toLocalISODate()
  const { create } = useCollection<Reading>('readings')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState(nowTime())
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setError('')
    setSaved(false)
  }

  const save = async () => {
    const out: Reading[] = []
    for (const marker of DAILY) {
      const text = values[marker.id] ?? ''
      const text2 = values[`${marker.id}2`] ?? ''
      if (!text.trim() && !text2.trim()) continue
      const v = number(text)
      const v2 = marker.pair ? number(text2) : null
      if (v === null || v < marker.min || v > marker.max) return setError(t('ind.invalidNamed', { name: marker.short, min: marker.min, max: marker.max }))
      if (marker.pair && (v2 === null || v2 < marker.pair.min || v2 > marker.pair.max)) return setError(t('ind.invalidPair'))
      out.push({ date, time: time || null, marker: marker.id, value: v, value2: v2, examId: null })
    }
    if (out.length === 0) return setError(t('ind.nothing'))
    for (const reading of out) await create(reading)
    setValues({})
    setTime(nowTime())
    setSaved(true)
  }

  return (
    <RecordForm title={t('ind.record')} submitLabel={t('ind.save')} error={error} saved={saved ? t('ind.saved') : undefined} onSubmit={() => void save()}>
      <RecordWhen date={date} time={time} today={today} onDate={setDate} onTime={setTime} />
      <div className="to-record__fields">
        {DAILY.map((marker) => (
          <RecordField key={marker.id} label={marker.short} unit={marker.unit} title={marker.how}>
            <input inputMode="decimal" placeholder={marker.pair ? t('ind.max') : '—'} value={values[marker.id] ?? ''} onChange={(e) => set(marker.id, e.target.value)} />
            {marker.pair && (
              <>
                <span className="to-record__slash">/</span>
                <input inputMode="decimal" placeholder={t('ind.min')} aria-label={marker.pair.label} value={values[`${marker.id}2`] ?? ''} onChange={(e) => set(`${marker.id}2`, e.target.value)} />
              </>
            )}
          </RecordField>
        ))}
      </div>
    </RecordForm>
  )
}

/**
 * Histórico de medições: one card per moment (the readings taken
 * together), newest first, side by side, scrolling sideways.
 */
function ReadingsTable({ readings }: { readings: Envelope<Reading>[] }) {
  const t = useT()
  const [editing, setEditing] = useState<string | null>(null)
  if (readings.length === 0) return null

  const moments = new Map<string, Envelope<Reading>[]>()
  for (const r of readings) {
    const key = `${r.data.date} ${r.data.time ?? ''}`
    moments.set(key, [...(moments.get(key) ?? []), r])
  }
  const used = DAILY.filter((m) => readings.some((r) => r.data.marker === m.id))

  return (
    <RecordStrip label={t('ind.history')}>
      {[...moments.entries()].map(([key, moment]) => (
        <MomentCard key={key} moment={moment} used={used} editing={editing === key} onEdit={(on) => setEditing(on ? key : null)} />
      ))}
    </RecordStrip>
  )
}

/**
 * One moment of the history: its date on top, a value per measure, and the
 * actions at the base. Editing turns the values into fields; a cleared
 * field removes that reading, a filled empty one adds it at the same moment.
 */
function MomentCard({ moment, used, editing, onEdit }: { moment: Envelope<Reading>[]; used: Marker[]; editing: boolean; onEdit: (on: boolean) => void }) {
  const t = useT()
  const format = useFormat()
  const { profile } = useProfile()
  const { create, update, remove } = useCollection<Reading>('readings')
  const first = moment[0].data
  const fromExam = Boolean(first.examId)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [error, setError] = useState(false)

  const start = () => {
    const values: Record<string, string> = {}
    for (const m of used) {
      const r = moment.find((x) => x.data.marker === m.id)
      if (!r) continue
      values[m.id] = String(r.data.value).replace('.', ',')
      if (m.pair && r.data.value2 !== null) values[`${m.id}2`] = String(r.data.value2).replace('.', ',')
    }
    setDraft(values)
    setError(false)
    onEdit(true)
  }

  const save = async () => {
    const changes: (() => Promise<unknown>)[] = []
    for (const m of used) {
      const r = moment.find((x) => x.data.marker === m.id)
      const text = (draft[m.id] ?? '').trim()
      const text2 = (draft[`${m.id}2`] ?? '').trim()
      if (!text && !text2) {
        if (r) changes.push(() => remove(r.id))
        continue
      }
      const v = number(text)
      const v2 = m.pair ? number(text2) : null
      if (v === null || v < m.min || v > m.max || (m.pair && (v2 === null || v2 < m.pair.min || v2 > m.pair.max))) return setError(true)
      if (r) {
        if (r.data.value !== v || r.data.value2 !== v2) changes.push(() => update(r.id, { value: v, value2: v2 }))
      } else changes.push(() => create({ date: first.date, time: first.time, marker: m.id, value: v, value2: v2, examId: null }))
    }
    for (const change of changes) await change()
    onEdit(false)
  }

  const removeAll = () => {
    if (confirm(t('ind.removeRow'))) for (const r of moment) void remove(r.id)
  }

  const field = (key: string, label: string) => (
    <RecordInput
      label={label}
      value={draft[key] ?? ''}
      onChange={(value) => {
        setDraft((d) => ({ ...d, [key]: value }))
        setError(false)
      }}
    />
  )

  /** A measure's value in this moment, or its field while editing. */
  const valueOf = (m: Marker) => {
    if (editing)
      return (
        <span className="to-readcards__cell to-readcards__cell--edit">
          {field(m.id, m.label)}
          {m.pair && <>/{field(`${m.id}2`, m.pair.label)}</>}
        </span>
      )
    const r = moment.find((x) => x.data.marker === m.id)
    if (!r) return <RecordValue tone="empty">—</RecordValue>
    return <RecordValue tone={m.status(r.data.value, r.data.value2 ?? undefined, profile.sex)}>{formatValue(m, r.data.value, r.data.value2 ?? undefined)}</RecordValue>
  }

  return (
    <RecordCard
      title={format.date(first.date).slice(0, 5)}
      aside={first.time ?? (fromExam ? t('ind.fromExam') : '')}
      editing={editing}
      error={error}
      actions={
        <RecordActions
          editing={editing}
          note={fromExam ? t('ind.examOnly') : undefined}
          noteTitle={t('ind.examOnlyHint')}
          onEdit={start}
          onRemove={removeAll}
          onSave={() => void save()}
          onCancel={() => onEdit(false)}
        />
      }
    >
      {used.map((m) => (
        <RecordRow key={m.id} name={m.short} unit={m.unit}>
          {valueOf(m)}
        </RecordRow>
      ))}
    </RecordCard>
  )
}
