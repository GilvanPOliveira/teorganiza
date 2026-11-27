import { useState, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'

/**
 * A section that opens and closes from its title. Closed the first time
 * (or open, when asked); after that it stays as it was left, in this browser.
 */
export function Fold({ id, title, summary, children, defaultOpen = false }: { id: string; title: string; summary?: string; children: ReactNode; defaultOpen?: boolean }) {
  const key = `teorganiza.workouts.fold.${id}`
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? defaultOpen : stored === '1'
    } catch {
      return defaultOpen
    }
  })
  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      // Without storage it still opens and closes; it just starts closed next time.
    }
  }
  return (
    <section className={`to-fold${open ? ' is-open' : ''}`}>
      <button type="button" className="to-fold__head" aria-expanded={open} onClick={toggle}>
        <span className="to-fold__title">{title}</span>
        {summary && <span className="to-muted to-fold__summary">{summary}</span>}
        {open ? <Minus size={16} /> : <Plus size={16} />}
      </button>
      {open && <div className="to-fold__body">{children}</div>}
    </section>
  )
}
