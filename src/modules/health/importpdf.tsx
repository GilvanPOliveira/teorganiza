import { useRef, useState } from 'react'
import { FileUp, LoaderCircle, Plus, X } from 'lucide-react'
import { Button, toLocalISODate, useAddFiles, useCollection, useProfile, useT } from '@core/api'
import { parseNumber, readLabReport } from './labreport'
import { MARKERS, markerOf } from './markers'
import type { Exam, Reading } from './schema'

interface Row {
  key: number
  marker: string
  value: string
  line: string | null
  on: boolean
}

interface Review {
  file: File
  name: string
  date: string
  place: string
  rows: Row[]
  /** The PDF had no text at all: a scan or a photo. */
  scanned: boolean
}

const LAB = MARKERS.filter((m) => m.kind === 'lab' || m.id === 'glucose')

/**
 * Importar exame em PDF. The report is read in the browser (nothing leaves
 * the computer), the values it names are listed for review, each one can
 * be corrected, unticked or added, and only on "Salvar" do the exam (with
 * the PDF attached) and its readings get written.
 */
export function ImportPdf() {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState('')

  const open = async (file: File | undefined) => {
    setError('')
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setError(t('pdf.notPdf'))
    setBusy(true)
    try {
      const { pdfLines } = await import('./pdftext')
      const lines = await pdfLines(await file.arrayBuffer())
      const report = readLabReport(lines)
      setReview({
        file,
        name: t('pdf.defaultName'),
        date: report.date ?? toLocalISODate(),
        place: '',
        rows: report.found.map((f, i) => ({ key: i, marker: f.marker, value: String(f.value).replace('.', ','), line: f.line, on: true })),
        scanned: lines.length === 0,
      })
    } catch {
      setError(t('pdf.unreadable'))
    } finally {
      setBusy(false)
    }
  }

  if (review) return <ReviewPanel review={review} onChange={setReview} onClose={() => setReview(null)} />

  return (
    <div
      className={`to-pdfdrop${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        void open(e.dataTransfer.files[0])
      }}
    >
      {busy ? <LoaderCircle size={22} className="to-spin" /> : <FileUp size={22} />}
      <div className="to-pdfdrop__text">
        <strong>{busy ? t('pdf.reading') : t('pdf.title')}</strong>
        <span className="to-muted">{error || t('pdf.body')}</span>
      </div>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void open(e.target.files?.[0] ?? undefined)} />
      <Button onClick={() => input.current?.click()} disabled={busy}>
        {t('pdf.choose')}
      </Button>
    </div>
  )
}

function ReviewPanel({ review, onChange, onClose }: { review: Review; onChange: (r: Review) => void; onClose: () => void }) {
  const t = useT()
  const { profile } = useProfile()
  const { create: createExam } = useCollection<Exam>('exams')
  const { create: createReading } = useCollection<Reading>('readings')
  const addFiles = useAddFiles()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (patch: Partial<Review>) => onChange({ ...review, ...patch })
  const setRow = (key: number, patch: Partial<Row>) => set({ rows: review.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) })
  const missing = LAB.filter((m) => !review.rows.some((r) => r.marker === m.id))
  const parse = (text: string) => (text.trim() ? parseNumber(text.trim()) : null)

  const save = async () => {
    const chosen = review.rows.filter((r) => r.on)
    for (const row of chosen) {
      const marker = markerOf(row.marker)!
      const v = parse(row.value)
      if (v === null || v < marker.min || v > marker.max) return setError(t('pdf.badValue', { name: marker.short }))
    }
    if (!review.name.trim()) return setError(t('pdf.needName'))
    setSaving(true)
    try {
      const examId = await createExam({ date: review.date, name: review.name.trim(), kind: 'lab', place: review.place.trim(), result: '', next: null })
      await addFiles([review.file], { path: 'health/exams', id: examId })
      for (const row of chosen) await createReading({ date: review.date, time: null, marker: row.marker, value: parse(row.value)!, value2: null, examId })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="to-card to-pdfreview">
      <header className="to-card__header">
        <span className="to-card__titleicon">
          <FileUp size={16} /> {t('pdf.reviewTitle')}
        </span>
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('pdf.cancel')} onClick={onClose}>
          <X size={14} />
        </button>
      </header>
      <div className="to-card__body to-pdfreview__body">
        <p className="to-muted to-pdfreview__file">
          {review.file.name} ·{' '}
          {review.scanned ? t('pdf.scanned') : review.rows.length ? t('pdf.found', { count: review.rows.length }) : t('pdf.noneFound')}
        </p>

        <div className="to-pdfreview__meta">
          <label>
            <span>{t('pdf.name')}</span>
            <input className="to-field__input" value={review.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label>
            <span>{t('pdf.date')}</span>
            <input className="to-field__input" type="date" value={review.date} max={toLocalISODate()} onChange={(e) => set({ date: e.target.value || review.date })} />
          </label>
          <label>
            <span>{t('pdf.place')}</span>
            <input className="to-field__input" value={review.place} placeholder={t('pdf.placeHint')} onChange={(e) => set({ place: e.target.value })} />
          </label>
        </div>

        {review.rows.length > 0 && (
          <ul className="to-pdfreview__rows">
            {review.rows.map((row) => {
              const marker = markerOf(row.marker)!
              const v = parse(row.value)
              const status = v !== null ? marker.status(v, undefined, profile.sex) : null
              return (
                <li key={row.key} className={row.on ? '' : 'is-off'}>
                  <input type="checkbox" checked={row.on} aria-label={t('pdf.keep', { name: marker.label })} onChange={(e) => setRow(row.key, { on: e.target.checked })} />
                  <span className="to-pdfreview__name">
                    <strong>{marker.label}</strong>
                    {row.line && <span className="to-pdfreview__line" title={row.line}>{row.line}</span>}
                  </span>
                  <span className="to-pdfreview__value">
                    <input className="to-field__input" inputMode="decimal" value={row.value} aria-label={marker.label} onChange={(e) => setRow(row.key, { value: e.target.value })} />
                    <span className="to-muted">{marker.unit}</span>
                  </span>
                  {status && row.on ? <span className={`to-indcard__status is-${status}`}>{t(`ind.status.${status}`)}</span> : <span />}
                </li>
              )
            })}
          </ul>
        )}

        {missing.length > 0 && (
          <label className="to-pdfreview__add">
            <Plus size={14} />
            <select
              className="to-field__input"
              value=""
              aria-label={t('pdf.addValue')}
              onChange={(e) => e.target.value && set({ rows: [...review.rows, { key: Date.now(), marker: e.target.value, value: '', line: null, on: true }] })}
            >
              <option value="">{t('pdf.addValue')}</option>
              {missing.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.unit})
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="to-indcard__error">{error}</p>}
        <div className="to-pdfreview__actions">
          <span className="to-muted">{t('pdf.saveHint', { count: review.rows.filter((r) => r.on).length })}</span>
          <Button variant="ghost" onClick={onClose}>
            {t('pdf.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {t('pdf.save')}
          </Button>
        </div>
      </div>
    </section>
  )
}

