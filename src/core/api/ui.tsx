import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/**
 * The base component set. Modules do not bring their own component
 * library: without this the app becomes a patchwork and the bundle grows
 * without control.
 *
 * This is deliberately thin. The design system matures alongside the first
 * real screens, not on paper before them.
 */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  return <button className={cx('to-button', `to-button--${variant}`, className)} {...rest} />
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={cx('to-card', className)}>
      {(title || actions) && (
        <header className="to-card__header">
          {title && <h3 className="to-card__title">{title}</h3>}
          {actions}
        </header>
      )}
      <div className="to-card__body">{children}</div>
    </section>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }

export function Field({ label, hint, id, className, ...rest }: FieldProps) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className={cx('to-field', className)}>
      <label className="to-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input className="to-field__input" id={inputId} {...rest} />
      {hint && <p className="to-field__hint">{hint}</p>}
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="to-toolbar">{children}</div>
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="to-empty">
      <p className="to-empty__title">{title}</p>
      {body && <p className="to-empty__body">{body}</p>}
      {action}
    </div>
  )
}

export function Table({
  headers,
  children,
}: {
  headers: ReactNode[]
  children: ReactNode
}) {
  return (
    <div className="to-table__wrap">
      <table className="to-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** A small set of mutually exclusive choices, shown side by side. */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V
  options: { value: V; label: ReactNode }[]
  onChange: (value: V) => void
  label: string
}) {
  return (
    <div className="to-segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={cx('to-segmented__item', option.value === value && 'is-active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** On/off. The label is required: a switch nobody can name is a bug. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx('to-switch', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <span className="to-switch__thumb" />
    </button>
  )
}

/** A round checkbox, for marking things done. */
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={cx('to-check', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M4 8.5l2.5 2.5L12 5.5" />
      </svg>
    </button>
  )
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  label: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function Select({ label, options, onChange, className, ...rest }: SelectProps) {
  return (
    <label className={cx('to-field', className)}>
      <span className="to-field__label">{label}</span>
      <select className="to-select" onChange={(event) => onChange(event.target.value)} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }

export function TextArea({ label, className, ...rest }: TextAreaProps) {
  return (
    <label className={cx('to-field', className)}>
      <span className="to-field__label">{label}</span>
      <textarea className="to-field__input to-textarea" {...rest} />
    </label>
  )
}

/** A thin bar from 0 to `max`. Values outside are clamped. */
export function Progress({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      className="to-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <span className="to-progress__bar" style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

/** A number with a caption, for the top of a screen. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="to-stat">
      <span className="to-stat__label">{label}</span>
      <span className={cx('to-stat__value', tone && `to-${tone}`)}>{value}</span>
      {hint && <span className="to-stat__hint">{hint}</span>}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="to-statgrid">{children}</div>
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'positive' | 'negative' | 'warning' | 'accent' }) {
  return <span className={cx('to-badge', tone && `to-badge--${tone}`)}>{children}</span>
}

/**
 * One line to add something: type and press Enter. The shape of capture
 * everywhere in the app, so adding feels the same in every module.
 */
export function QuickAdd({
  placeholder,
  onAdd,
  children,
}: {
  placeholder: string
  onAdd: (text: string) => void | Promise<void>
  /** Extra fields shown next to the input (a date, a select). */
  children?: ReactNode
}) {
  const [text, setText] = useState('')
  const submit = async () => {
    const clean = text.trim()
    if (!clean) return
    await onAdd(clean)
    setText('')
  }
  return (
    <form
      className="to-quickadd"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <input
        className="to-quickadd__input"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setText(event.target.value)}
      />
      {children}
      <button type="submit" className="to-button to-button--primary" aria-label={placeholder}>
        +
      </button>
    </form>
  )
}

function cx(...values: (string | undefined | false)[]): string {
  return values.filter(Boolean).join(' ')
}

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  /** The saved date, ISO; null when empty. */
  value: string | null
  /** Called with a complete, plausible date, or null when cleared (unless `required`). */
  onSave: (date: string | null) => void
  /** Clearing puts the saved date back instead of saving null. */
  required?: boolean
}

/**
 * A date field bound to saved data. Typing a year goes through 0001, 0019,
 * 0198… on the way to 1988, so the field keeps its own draft while focused,
 * saves only complete dates within min/max (and from 1900 on), and ignores
 * saved values coming back mid-typing that would overwrite what is being typed.
 */
export function DateInput({ value, onSave, required, min, max, onFocus, onBlur, className, ...rest }: DateInputProps) {
  const [draft, setDraft] = useState(value ?? '')
  const [editing, setEditing] = useState(false)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (!editing) setDraft(value ?? '')
  }
  const plausible = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number(date.slice(0, 4)) >= 1900 &&
    (!min || date >= String(min)) &&
    (!max || date <= String(max))

  return (
    <input
      type="date"
      className={cx('to-field__input', className)}
      value={draft}
      min={min}
      max={max}
      {...rest}
      onFocus={(e) => {
        setEditing(true)
        onFocus?.(e)
      }}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        if (next && plausible(next) && next !== value) onSave(next)
      }}
      onBlur={(e) => {
        setEditing(false)
        if (!draft) {
          if (required) setDraft(value ?? '')
          else if (value) onSave(null)
        } else if (!plausible(draft)) setDraft(value ?? '')
        else if (draft !== value) onSave(draft)
        onBlur?.(e)
      }}
    />
  )
}
