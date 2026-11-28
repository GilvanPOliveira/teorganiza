import { useCallback, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Open or folded, kept while the app is open: leaving the tab and coming
 * back finds it as it was; opening the app again starts everything folded.
 */
const remembered = new Map<string, boolean>()

export function useRemembered(key: string): [boolean, (update: (open: boolean) => boolean) => void] {
  const [open, setOpen] = useState(() => remembered.get(key) ?? false)
  const set = useCallback(
    (update: (open: boolean) => boolean) =>
      setOpen((current) => {
        const next = update(current)
        remembered.set(key, next)
        return next
      }),
    [key],
  )
  return [open, set]
}

/** A card that starts folded, shows a one-line summary in its header, and remembers. */
export function FoldCard({ id, icon, title, summary, className, children }: { id: string; icon: ReactNode; title: string; summary?: ReactNode; className?: string; children: ReactNode }) {
  const [open, setOpen] = useRemembered(id)
  return (
    <section className={`to-card to-me__fold${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button type="button" className="to-card__header to-me__foldhead" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="to-card__titleicon">
          {icon}
          {title}
        </span>
        {/* The summary stands in for the content while folded; open, the content says it. */}
        <span className="to-me__foldsummary">{!open && summary}</span>
        <ChevronDown size={16} className="to-me__chevron" />
      </button>
      {open && <div className="to-card__body">{children}</div>}
    </section>
  )
}
