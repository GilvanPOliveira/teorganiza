import type { FormEvent, ReactNode } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { translate } from '@core/i18n/catalog'
import { useAppState } from '@core/runtime/app-context'
import { Button } from './ui'

/**
 * The pieces every "record something, see what was recorded" screen is
 * built from: a form beside the data with a fixed slot for its messages,
 * the history as cards side by side, bars of done against a target, and
 * notes read from the person's data. Exames and Refeições use them; the
 * markup and look are the same wherever they appear.
 */

function useCoreT() {
  const { locale } = useAppState()
  return (key: string, vars?: Record<string, unknown>) => translate(locale, 'core', key, vars)
}

export type RecordTone = 'normal' | 'attention' | 'high' | 'low' | 'empty' | 'good'

/** The history: cards side by side, newest first, scrolling sideways. */
export function RecordStrip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="to-readcards" aria-label={label}>
      <div className="to-readcards__body">
        <div className="to-readcards__scroll">{children}</div>
      </div>
    </section>
  )
}

/** One moment of the history: a title and an aside on top, its rows, its actions at the base. */
export function RecordCard({
  title,
  aside,
  editing = false,
  error = false,
  actions,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  editing?: boolean
  error?: boolean
  actions: ReactNode
  children: ReactNode
}) {
  return (
    <article className={`to-readcards__col${editing ? ' is-editing' : ''}${error ? ' has-error' : ''}`}>
      <header className="to-readcards__head">
        <strong>{title}</strong>
        <span>{aside}</span>
      </header>
      <div className="to-readcards__values">{children}</div>
      <footer className="to-readcards__actions">{actions}</footer>
    </article>
  )
}

/** A row of a card: the name (and unit) on the left, the value on the right. */
export function RecordRow({ name, unit, children }: { name: ReactNode; unit?: string; children: ReactNode }) {
  return (
    <div className="to-readcards__row">
      <span className="to-readcards__name">
        {name}
        {unit && <small>{unit}</small>}
      </span>
      {children}
    </div>
  )
}

/** A value in a row, coloured by how it compares. */
export function RecordValue({ tone, title, children }: { tone?: RecordTone; title?: string; children: ReactNode }) {
  return (
    <span className={`to-readcards__cell${tone ? ` is-${tone}` : ''}`} title={title}>
      {children}
    </span>
  )
}

/** A field in a row while the card is being edited. */
export function RecordInput({ label, value, onChange, inputMode = 'decimal', wide = false }: { label: string; value: string; onChange: (value: string) => void; inputMode?: 'decimal' | 'numeric' | 'text'; wide?: boolean }) {
  return (
    <input
      className={wide ? 'is-wide' : undefined}
      inputMode={inputMode === 'text' ? undefined : inputMode}
      aria-label={label}
      placeholder="—"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * The base of a card: edit on one side and delete on the other; save and
 * cancel while editing; or a note when the card can't be changed here.
 */
export function RecordActions({
  editing,
  note,
  noteTitle,
  onEdit,
  onRemove,
  onSave,
  onCancel,
}: {
  editing?: boolean
  note?: string
  noteTitle?: string
  onEdit?: () => void
  onRemove?: () => void
  onSave?: () => void
  onCancel?: () => void
}) {
  const t = useCoreT()
  if (note)
    return (
      <span className="to-readcards__note" title={noteTitle}>
        {note}
      </span>
    )
  if (editing)
    return (
      <>
        <button type="button" className="to-readcards__btn is-save" aria-label={t('records.save')} title={t('records.save')} onClick={onSave}>
          <Check size={13} />
        </button>
        <button type="button" className="to-readcards__btn" aria-label={t('records.cancel')} title={t('records.cancel')} onClick={onCancel}>
          <X size={13} />
        </button>
      </>
    )
  return (
    <>
      <button type="button" className="to-readcards__btn" aria-label={t('records.edit')} title={t('records.edit')} onClick={onEdit}>
        <Pencil size={12} />
      </button>
      <button type="button" className="to-readcards__btn is-danger" aria-label={t('records.remove')} title={t('records.remove')} onClick={onRemove}>
        <Trash2 size={12} />
      </button>
    </>
  )
}

/**
 * The record form beside the data: a title, its fields, a fixed slot for
 * the error or the confirmation (so the card never jumps), and the button.
 */
export function RecordForm({
  title,
  submitLabel,
  error,
  saved,
  onSubmit,
  children,
}: {
  title: string
  submitLabel: string
  error?: string
  saved?: string
  onSubmit: () => void
  children: ReactNode
}) {
  return (
    <form
      className="to-record"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <span className="to-checkgroup__title">{title}</span>
      {children}
      <div className="to-record__message" role="status" aria-live="polite">
        {error ? <span className="to-indcard__error">{error}</span> : saved && <span className="to-record__saved">{saved}</span>}
      </div>
      <Button type="submit" variant="primary" className="to-record__save">
        {submitLabel}
      </Button>
    </form>
  )
}

/** Date and time of what is being recorded; the date can't be in the future. */
export function RecordWhen({ date, time, today, onDate, onTime }: { date: string; time: string; today: string; onDate: (date: string) => void; onTime: (time: string) => void }) {
  const t = useCoreT()
  return (
    <div className="to-record__when">
      <label>
        <span>{t('records.date')}</span>
        <input className="to-field__input" type="date" value={date} max={today} onChange={(e) => onDate(e.target.value || today)} />
      </label>
      <label>
        <span>{t('records.time')}</span>
        <input className="to-field__input" type="time" value={time} onChange={(e) => onTime(e.target.value)} />
      </label>
    </div>
  )
}

/** A labelled field with its unit inside, as the record forms use. */
export function RecordField({ label, unit, title, children }: { label: string; unit?: string; title?: string; children: ReactNode }) {
  return (
    <label className="to-record__field" title={title}>
      <span className="to-body__fieldlabel">{label}</span>
      <span className="to-body__inputgroup">
        {children}
        {unit !== undefined && <span>{unit}</span>}
      </span>
    </label>
  )
}

export interface TargetItem {
  key: string
  label: string
  value: number
  /** Nothing to compare with when null: the bar shows the value alone. */
  target: number | null
  unit: string
  /** Over the target is bad (calories) or fine (protein, water). */
  over?: 'bad' | 'fine'
  /** Where the value comes from, when it isn't this screen. */
  from?: string
}

/** Done against the target, one bar per item. */
export function TargetBars({ items }: { items: TargetItem[] }) {
  const t = useCoreT()
  return (
    <div className="to-targets">
      {items.map((item) => {
        const share = item.target ? item.value / item.target : 0
        const tone = item.target === null ? '' : share > 1.05 && item.over !== 'fine' ? ' is-over' : share >= 0.9 ? ' is-done' : ''
        const left = item.target === null ? null : Math.round(item.target - item.value)
        return (
          <div key={item.key} className={`to-targets__item${tone}`}>
            <div className="to-targets__top">
              <span className="to-targets__label">{item.label}</span>
              <span className="to-targets__value">
                <strong>{Math.round(item.value)}</strong>
                {item.target !== null && <span> / {item.target}</span>} <small>{item.unit}</small>
              </span>
            </div>
            <div className="to-targets__bar" aria-hidden>
              <span style={{ width: `${Math.min(100, share * 100)}%` }} />
            </div>
            <span className="to-targets__hint">
              {item.target === null
                ? t('records.noTarget')
                : left! > 0
                  ? t('records.left', { value: left, unit: item.unit })
                  : left === 0 || item.over === 'fine'
                    ? t('records.reached')
                    : t('records.over', { value: -left!, unit: item.unit })}
              {item.from && <span className="to-targets__from"> · {item.from}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export interface DataNote {
  key: string
  tone: 'warn' | 'good' | 'info'
  icon: ReactNode
  text: ReactNode
}

/** Notes worked out from the person's data, each with where it came from in its text. */
export function NoteList({ notes, className }: { notes: DataNote[]; className?: string }) {
  if (notes.length === 0) return null
  return (
    <ul className={`to-readiness${className ? ` ${className}` : ''}`}>
      {notes.map((note) => (
        <li key={note.key} className={`to-readiness__item is-${note.tone}`}>
          {note.icon}
          <span>{note.text}</span>
        </li>
      ))}
    </ul>
  )
}
