import { useEffect, useRef, useState } from 'react'
import { CalendarCheck, Check, ChevronRight, ExternalLink, FileText, Stethoscope, Trash2, UserRound, X } from 'lucide-react'
import {
  Button,
  DateInput,
  toLocalISODate,
  useBlobUrl,
  useCollection,
  useFiles,
  useFormat,
  useOpenHref,
  useProfile,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import { checkupsFor } from './checkups'
import { FoldCard } from './fold'
import { ImportPdf } from './importpdf'
import { Indicators, LabResults } from './indicators'
import { formatValue, MARKERS, markerOf } from './markers'
import type { Exam, Reading } from './schema'

const EXAMS_PATH = 'health/exams'

/**
 * Exames: bring in a lab report first; then what can be measured at home,
 * what the reports said, the routine check-ups, and the reports themselves.
 */
export function ExamsScreen() {
  const exams = useRecords<Exam>('exams').sort((a, b) => b.data.date.localeCompare(a.data.date))
  const readings = useRecords<Reading>('readings')
  useMoveLegacyValues(exams)
  useMoveWaist(readings)

  return (
    <div className="to-stack to-exams">
      <ImportPdf />
      <Indicators />
      <LabResults />
      <ImportedExams exams={exams} readings={readings} />
      <Checkups exams={exams} readings={readings} />
    </div>
  )
}

/**
 * Values used to be written on the exam itself (pressure, glucose, LDL).
 * They become readings tied to their exam, once, so they show in the
 * indicator cards like any other.
 */
function useMoveLegacyValues(exams: Envelope<Exam>[]) {
  const { create } = useCollection<Reading>('readings')
  const { update } = useCollection<Exam>('exams')
  const moved = useRef(new Set<string>())
  useEffect(() => {
    for (const exam of exams) {
      const v = exam.data.values
      if (!v || moved.current.has(exam.id) || !Object.values(v).some((x) => x)) continue
      moved.current.add(exam.id)
      const base = { date: exam.data.date, time: null, examId: exam.id }
      void (async () => {
        if (v.systolic && v.diastolic) await create({ ...base, marker: 'pressure', value: v.systolic, value2: v.diastolic })
        if (v.glucose) await create({ ...base, marker: 'glucose', value: v.glucose, value2: null })
        if (v.ldl) await create({ ...base, marker: 'ldl', value: v.ldl, value2: null })
        await update(exam.id, { values: undefined })
      })()
    }
  }, [exams, create, update])
}

/** The waist used to be a home measure here; it now lives with the body measures in Meus dados. */
function useMoveWaist(readings: Envelope<Reading>[]) {
  const { addMeasures } = useProfile()
  const { remove } = useCollection<Reading>('readings')
  const moved = useRef(new Set<string>())
  useEffect(() => {
    for (const r of readings) {
      if (r.data.marker !== 'waist' || moved.current.has(r.id)) continue
      moved.current.add(r.id)
      void addMeasures(r.data.date, { waist: r.data.value }).then(() => remove(r.id))
    }
  }, [readings, addMeasures, remove])
}

/**
 * Exames importados: the reports brought in as PDF, newest first. Nothing
 * is added here (that is what importing is for); each opens in a window
 * with the report itself next to the values read from it.
 */
function ImportedExams({ exams, readings }: { exams: Envelope<Exam>[]; readings: Envelope<Reading>[] }) {
  const t = useT()
  const format = useFormat()
  const files = useFiles()
  const [opened, setOpened] = useState<string | null>(null)
  const withPdf = new Set(files.filter((f) => f.data.attachedTo?.path === EXAMS_PATH).map((f) => f.data.attachedTo!.id))
  const imported = exams.filter((e) => withPdf.has(e.id))
  const current = imported.find((e) => e.id === opened)

  return (
    <>
      <FoldCard
        id="exams.imported"
        icon={<Stethoscope size={16} />}
        title={t('exam.listTitle')}
        summary={imported.length ? t('exam.count', { count: imported.length }) : t('exam.none')}
        className="to-examlist"
      >
        {imported.length === 0 ? (
          <p className="to-examlist__empty">{t('exam.emptyBody')}</p>
        ) : (
          <ul className="to-examlist__items">
            {imported.map((exam) => {
              const count = readings.filter((r) => r.data.examId === exam.id).length
              return (
                <li key={exam.id}>
                  <button type="button" className="to-examrow" onClick={() => setOpened(exam.id)}>
                    <FileText size={18} className="to-examrow__icon" />
                    <span className="to-examrow__main">
                      <strong>{exam.data.name}</strong>
                      <span className="to-examcard__meta">
                        <span>{format.date(exam.data.date)}</span>
                        {exam.data.place && <span>{exam.data.place}</span>}
                        {count > 0 && <span>{t('exam.valuesCount', { count })}</span>}
                      </span>
                    </span>
                    <ChevronRight size={16} className="to-muted" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </FoldCard>
      {current && <ExamDialog exam={current} readings={readings.filter((r) => r.data.examId === current.id)} onClose={() => setOpened(null)} />}
    </>
  )
}

/** One imported exam in a window: the PDF on one side, what was read from it on the other. */
function ExamDialog({ exam, readings, onClose }: { exam: Envelope<Exam>; readings: Envelope<Reading>[]; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const { profile } = useProfile()
  const { update, remove } = useCollection<Exam>('exams')
  const { remove: removeReading } = useCollection<Reading>('readings')
  const files = useFiles({ path: EXAMS_PATH, id: exam.id })
  const pdf = files.find((f) => f.data.type === 'application/pdf' || f.data.name.toLowerCase().endsWith('.pdf')) ?? files[0]
  const url = useBlobUrl(pdf?.data.hash ?? null)
  const { name, date, place, result, next } = exam.data
  const ordered = [...readings].sort((a, b) => MARKERS.findIndex((m) => m.id === a.data.marker) - MARKERS.findIndex((m) => m.id === b.data.marker))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const removeExam = async () => {
    if (!confirm(t('exam.removeConfirm', { name }))) return
    for (const r of readings) await removeReading(r.id)
    await remove(exam.id)
    onClose()
  }

  return (
    <div className="to-palette__backdrop to-examdialog__backdrop" onMouseDown={onClose}>
      <section className="to-palette to-examdialog" role="dialog" aria-modal="true" aria-label={name} onMouseDown={(e) => e.stopPropagation()}>
        <header className="to-examdialog__head">
          <div>
            <strong>{name}</strong>
            <span className="to-examcard__meta">
              <span>{format.date(date)}</span>
              {place && <span>{place}</span>}
              {pdf && <span>{pdf.data.name}</span>}
            </span>
          </div>
          {url && (
            <a className="to-button to-button--ghost" href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> {t('exam.openTab')}
            </a>
          )}
          <button type="button" className="to-iconbutton" aria-label={t('exam.close')} onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="to-examdialog__body">
          <div className="to-examdialog__pdf">{url ? <iframe src={url} title={pdf?.data.name ?? name} /> : <span className="to-muted">{t('exam.noPdf')}</span>}</div>

          <aside className="to-examdialog__side">
            <div className="to-examdialog__section">
              <span className="to-examcard__label">{t('exam.values')}</span>
              {ordered.length === 0 ? (
                <span className="to-muted">{t('exam.noValues')}</span>
              ) : (
                <ul className="to-examdialog__values">
                  {ordered.map((r) => {
                    const marker = markerOf(r.data.marker)
                    if (!marker) return null
                    const status = marker.status(r.data.value, r.data.value2 ?? undefined, profile.sex)
                    return (
                      <li key={r.id}>
                        <span>{marker.label}</span>
                        <strong className={`is-${status}`}>
                          {formatValue(marker, r.data.value, r.data.value2 ?? undefined)} <span className="to-muted">{marker.unit}</span>
                        </strong>
                        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('exam.removeValue', { name: marker.short })} onClick={() => void removeReading(r.id)}>
                          <Trash2 size={12} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <label className="to-examcard__field">
              <span>{t('exam.result')}</span>
              <textarea
                className="to-field__input"
                rows={4}
                key={result}
                defaultValue={result}
                placeholder={t('exam.resultHint')}
                onBlur={(e) => e.target.value !== result && void update(exam.id, { result: e.target.value })}
              />
            </label>
            <label className="to-examcard__field">
              <span>{t('exam.nextLabel')}</span>
              <DateInput value={next} min={toLocalISODate()} onSave={(d) => void update(exam.id, { next: d })} />
            </label>
            <div className="to-examdialog__danger">
              <Button variant="ghost" onClick={() => void removeExam()}>
                <Trash2 size={14} /> {t('exam.remove')}
              </Button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

/**
 * Exames de rotina, as a checklist. The list is worked out from Meus dados
 * (age, sex, BMI, restrictions, training days) and the latest readings
 * (pressure, glucose, glycated hemoglobin, LDL), says who it was worked out
 * for, and why an item is there or comes more often. Ticking one records it
 * as done today; it moves to "Em dia" and comes back on its own when due.
 * A report or reading that covers it ticks it too; unticking undoes only a
 * tick made here.
 */
function Checkups({ exams, readings }: { exams: Envelope<Exam>[]; readings: Envelope<Reading>[] }) {
  const t = useT()
  const format = useFormat()
  const openHref = useOpenHref()
  const { profile, facts } = useProfile()
  const { create, remove } = useCollection<Exam>('exams')
  const files = useFiles()
  const today = toLocalISODate()

  if (facts.age === null || !profile.sex) {
    return (
      <button type="button" className="to-plans__hint" onClick={() => openHref('/health/me')}>
        <CalendarCheck size={14} />
        {t('checkup.fillProfile')}
      </button>
    )
  }

  const latest = (marker: string) =>
    readings
      .filter((r) => r.data.marker === marker && r.data.date <= today)
      .sort((x, y) => (y.data.date + (y.data.time ?? '')).localeCompare(x.data.date + (x.data.time ?? '')))[0]?.data
  const pressure = latest('pressure')
  const person = {
    age: facts.age,
    sex: profile.sex,
    bmi: facts.bmi,
    flags: profile.flags ?? [],
    glucose: latest('glucose')?.value ?? null,
    hba1c: latest('hba1c')?.value ?? null,
    ldl: latest('ldl')?.value ?? null,
    pressureHigh: Boolean(pressure && (pressure.value >= 140 || (pressure.value2 ?? 0) >= 90)),
    trainingDays: profile.days,
    waistRisk: facts.waistRisk,
  }

  const withFile = new Set(files.filter((f) => f.data.attachedTo?.path === EXAMS_PATH).map((f) => f.data.attachedTo!.id))
  const asExams = [...exams.map((e) => e.data), ...readings.map((r) => ({ name: markerOf(r.data.marker)?.label ?? '', date: r.data.date }))]
  const plans = checkupsFor(person, asExams, today)
  const pending = plans.filter((p) => p.status === 'due')
  const upToDate = plans.filter((p) => p.status !== 'due')
  const month = (iso: string) => format.date(iso).slice(3)
  const frequency = (every: number) =>
    every === 1 ? t('checkup.monthly') : every % 12 === 0 ? t('checkup.everyYears', { count: every / 12 }) : t('checkup.everyMonths', { count: every })

  /** The tick made here for this check-up, on the date it was last done. */
  const tickOf = (name: string, date: string | null) =>
    date ? exams.find((e) => e.data.name === name && e.data.date === date && !e.data.result && !withFile.has(e.id) && !readings.some((r) => r.data.examId === e.id)) : undefined

  const toggle = (name: string, kind: Exam['kind'], done: boolean, last: string | null) => {
    if (!done) return void create({ date: today, name, kind, place: '', result: '', next: null })
    const tick = tickOf(name, last)
    if (tick) void remove(tick.id)
  }

  const flags = profile.flags ?? []
  const about = [
    t(`checkup.for.${profile.sex}`, { age: facts.age }),
    facts.bmi !== null && t('checkup.forBmi', { bmi: String(facts.bmi).replace('.', ',') }),
    ...flags.map((f) => t(`me.flag.${f}`).toLowerCase()),
    person.pressureHigh && !flags.includes('hypertension') && t('checkup.forPressure'),
  ].filter(Boolean) as string[]

  const row = ({ checkup, every, reasons, last, next, status }: (typeof plans)[number]) => {
    const done = status !== 'due'
    const undoable = !done || Boolean(tickOf(checkup.name, last))
    return (
      <li key={checkup.id} className={`to-checkrow${done ? ' is-done' : ''}${status === 'soon' ? ' is-soon' : ''}`}>
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={checkup.name}
          className="to-checkrow__box"
          disabled={!undoable}
          title={done && !undoable ? t('checkup.fromExam') : done ? t('checkup.undo') : t('checkup.markDone')}
          onClick={() => toggle(checkup.name, checkup.kind, done, last)}
        >
          {done && <Check size={13} strokeWidth={3} />}
        </button>
        <span className="to-checkrow__text">
          <span className="to-checkrow__name">{checkup.name}</span>
          <span className="to-checkrow__meta">
            {done && last ? t('checkup.doneOn', { date: format.date(last) }) : last ? t('checkup.last', { date: format.date(last) }) : t('checkup.never')}
            {reasons.map((r) => (
              <span key={r} className="to-checkrow__reason">
                {t(`checkup.reason.${r}`)}
              </span>
            ))}
          </span>
        </span>
        <span className="to-checkrow__when">{done && next ? t(status === 'soon' ? 'checkup.backSoon' : 'checkup.back', { date: month(next) }) : frequency(every)}</span>
      </li>
    )
  }

  return (
    <FoldCard
      id="exams.checkups"
      icon={<CalendarCheck size={16} />}
      title={t('checkup.title')}
      summary={pending.length ? t('checkup.dueCount', { count: pending.length }) : t('checkup.allOk')}
      className="to-checkups"
    >
      <button type="button" className="to-checkups__for" onClick={() => openHref('/health/me')} title={t('checkup.forHint')}>
        <UserRound size={13} />
        <span>
          <strong>{t('checkup.forTitle')}</strong> {about.join(' · ')}
        </span>
      </button>
      {pending.length > 0 && (
        <div className="to-checkgroup">
          <span className="to-checkgroup__title">{t('checkup.pending')}</span>
          <ul>{pending.map(row)}</ul>
        </div>
      )}
      {upToDate.length > 0 && (
        <div className="to-checkgroup">
          <span className="to-checkgroup__title">{t('checkup.upToDate')}</span>
          <ul>{upToDate.map(row)}</ul>
        </div>
      )}
    </FoldCard>
  )
}
