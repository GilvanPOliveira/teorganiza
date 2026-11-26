import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import {
  Attachments,
  Badge,
  EmptyState,
  QuickAdd,
  TextArea,
  toLocalISODate,
  useCollection,
  useFiles,
  useFormat,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import type { Exam } from './schema'

const KINDS: Exam['kind'][] = ['lab', 'image', 'consult', 'other']

function ExamRow({ exam }: { exam: Envelope<Exam> }) {
  const t = useT()
  const format = useFormat()
  const { update, remove } = useCollection<Exam>('exams')
  const [open, setOpen] = useState(false)
  const files = useFiles({ path: 'health/exams', id: exam.id })
  const { name, kind, date, place, result, next } = exam.data

  return (
    <li className="to-list__item to-list__item--wrap">
      <button type="button" className="to-list__main to-rowbutton" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="to-list__title">{name}</span>
        <span className="to-list__meta">
          <Badge>{t(`exam.kind.${kind}`)}</Badge>
          <span>{format.date(date)}</span>
          {place && <span>{place}</span>}
          {files.length > 0 && <span>{t('exam.files', { count: files.length })}</span>}
          {next && <Badge tone="accent">{t('exam.next', { date: format.date(next) })}</Badge>}
        </span>
      </button>
      <div className="to-list__actions">
        {open ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('exam.remove')} onClick={() => void remove(exam.id)}>
          <Trash2 size={14} />
        </button>
      </div>
      {open && (
        <div className="to-list__extra to-stack">
          <TextArea
            label={t('exam.result')}
            defaultValue={result}
            rows={4}
            onBlur={(e) => void update(exam.id, { result: e.target.value })}
          />
          <label className="to-inline-field">
            <span className="to-muted">{t('exam.nextLabel')}</span>
            <input
              type="date"
              className="to-field__input"
              value={next ?? ''}
              onChange={(e) => void update(exam.id, { next: e.target.value || null })}
            />
          </label>
          <Attachments collection="exams" id={exam.id} />
        </div>
      )}
    </li>
  )
}

export function ExamsScreen() {
  const t = useT()
  const exams = useRecords<Exam>('exams').sort((a, b) => b.data.date.localeCompare(a.data.date))
  const { create } = useCollection<Exam>('exams')
  const [date, setDate] = useState(toLocalISODate())
  const [kind, setKind] = useState<Exam['kind']>('lab')
  const [place, setPlace] = useState('')
  const [filter, setFilter] = useState<Exam['kind'] | 'all'>('all')
  const shown = filter === 'all' ? exams : exams.filter((exam) => exam.data.kind === filter)

  return (
    <div className="to-stack">
      <QuickAdd
        placeholder={t('exam.placeholder')}
        onAdd={async (name) => {
          await create({ date, name, kind, place: place.trim(), result: '', next: null })
          setPlace('')
        }}
      >
        <input type="date" className="to-field__input" value={date} aria-label={t('exam.date')} onChange={(e) => setDate(e.target.value)} />
        <select className="to-field__input" value={kind} aria-label={t('exam.kind')} onChange={(e) => setKind(e.target.value as Exam['kind'])}>
          {KINDS.map((value) => (
            <option key={value} value={value}>
              {t(`exam.kind.${value}`)}
            </option>
          ))}
        </select>
        <input className="to-field__input" value={place} placeholder={t('exam.place')} aria-label={t('exam.place')} onChange={(e) => setPlace(e.target.value)} />
      </QuickAdd>
      {exams.length > 0 && (
        <div className="to-toolbar">
          {(['all', ...KINDS] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`to-chip${filter === value ? ' is-active' : ''}`}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? t('exam.all') : t(`exam.kind.${value}`)}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState title={t('exam.empty')} body={t('exam.body')} />
      ) : (
        <ul className="to-list">
          {shown.map((exam) => (
            <ExamRow key={exam.id} exam={exam} />
          ))}
        </ul>
      )}
    </div>
  )
}
