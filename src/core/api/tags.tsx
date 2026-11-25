import { useMemo, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { translate } from '@core/i18n/catalog'
import { useAppState } from '@core/runtime/app-context'
import { useCreateTag, useTags, type Tag } from './hooks'

function useCoreText() {
  const { locale } = useAppState()
  return (key: string, vars?: Record<string, unknown>) => translate(locale, 'core', key, vars)
}

/**
 * Shows tags as chips. Each chip links to the page that gathers everything
 * with that tag, across all modules. Unknown ids (a tag deleted on another
 * device) are simply not shown.
 */
export function TagList({ ids, linked = true }: { ids: readonly string[] | undefined; linked?: boolean }) {
  const tags = useTags()
  const shown = (ids ?? [])
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => tag !== undefined)
  if (shown.length === 0) return null
  return (
    <span className="to-tags">
      {shown.map((tag) =>
        linked ? (
          <Link key={tag.id} to={`/tags/${tag.id}`} className="to-tag" data-color={tag.color}>
            #{tag.name}
          </Link>
        ) : (
          <span key={tag.id} className="to-tag" data-color={tag.color}>
            #{tag.name}
          </span>
        ),
      )}
    </span>
  )
}

/**
 * The one way to tag anything, so tagging looks and behaves the same in
 * every module. Type to filter; Enter picks the first match or creates the
 * tag; Backspace on an empty box removes the last one.
 */
export function TagPicker({
  value,
  onChange,
  label,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  label?: string
}) {
  const t = useCoreText()
  const tags = useTags()
  const createTag = useCreateTag()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  const selected = value
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => tag !== undefined)

  const query = text.trim().replace(/^#/, '').toLocaleLowerCase()
  const suggestions = useMemo(
    () =>
      tags
        .filter((tag) => !value.includes(tag.id))
        .filter((tag) => tag.name.toLocaleLowerCase().includes(query))
        .slice(0, 6),
    [tags, value, query],
  )
  const exact = tags.some((tag) => tag.name.toLocaleLowerCase() === query)

  const add = async (id: string) => {
    if (!value.includes(id)) onChange([...value, id])
    setText('')
  }

  const onKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && query) {
      event.preventDefault()
      await add(suggestions[0] && !exact ? suggestions[0].id : await createTag(query))
    } else if (event.key === 'Backspace' && !text && value.length > 0) {
      onChange(value.slice(0, -1))
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="to-tagpicker">
      {label && <span className="to-field__label">{label}</span>}
      <div className="to-tagpicker__box">
        {selected.map((tag) => (
          <span key={tag.id} className="to-tag" data-color={tag.color}>
            #{tag.name}
            <button
              type="button"
              className="to-tag__remove"
              aria-label={t('tags.remove', { name: tag.name })}
              onClick={() => onChange(value.filter((id) => id !== tag.id))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="to-tagpicker__input"
          value={text}
          placeholder={selected.length === 0 ? t('tags.placeholder') : ''}
          aria-label={label ?? t('tags.placeholder')}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => void onKeyDown(event)}
        />
      </div>
      {open && (suggestions.length > 0 || (query && !exact)) && (
        <ul className="to-tagpicker__menu" role="listbox">
          {suggestions.map((tag) => (
            <li key={tag.id} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void add(tag.id)}>
                <span className="to-tag" data-color={tag.color}>#{tag.name}</span>
              </button>
            </li>
          ))}
          {query && !exact && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={async () => void add(await createTag(query))}
              >
                {t('tags.create', { name: query })}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
