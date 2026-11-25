import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

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
  )
}

function cx(...values: (string | undefined | false)[]): string {
  return values.filter(Boolean).join(' ')
}
