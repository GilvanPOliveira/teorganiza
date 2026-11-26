import { useState } from 'react'
import { Check, ExternalLink, RotateCcw, Trash2 } from 'lucide-react'
import {
  EmptyState,
  QuickAdd,
  Segmented,
  TagList,
  useCollection,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import type { SavedLink } from './schema'

/** Accepts "exemplo.com/x" as well as a full address; anything else stays as typed. */
export function normalizeUrl(text: string): string {
  const trimmed = text.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  if (/^[^\s/]+\.[^\s/]+/.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

/** "https://www.site.com/a/b" -> "site.com", for the line under the title. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Splits "título https://..." or "https://... título" into its two parts. */
export function parseLink(text: string): { url: string; title: string } {
  const words = text.trim().split(/\s+/)
  const at = words.findIndex((word) => /^(https?:\/\/|www\.)|^[^\s/]+\.[a-z]{2,}(\/|$)/i.test(word))
  if (at === -1) return { url: normalizeUrl(text), title: '' }
  const url = normalizeUrl(words[at])
  const title = [...words.slice(0, at), ...words.slice(at + 1)].join(' ')
  return { url, title }
}

function LinkRow({ link }: { link: Envelope<SavedLink> }) {
  const t = useT()
  const { update, remove } = useCollection<SavedLink>('links')
  const { url, title, read } = link.data
  return (
    <li className="to-list__item">
      <span className="to-list__main">
        <a className="to-list__title" href={url} target="_blank" rel="noopener noreferrer">
          {title || hostOf(url)} <ExternalLink size={12} aria-hidden />
        </a>
        <span className="to-list__meta">
          <span>{hostOf(url)}</span>
          <TagList ids={link.tags} />
        </span>
      </span>
      <button
        type="button"
        className="to-iconbutton to-iconbutton--small"
        aria-label={t(read ? 'link.unread' : 'link.read')}
        title={t(read ? 'link.unread' : 'link.read')}
        onClick={() => void update(link.id, { read: !read })}
      >
        {read ? <RotateCcw size={14} /> : <Check size={14} />}
      </button>
      <button
        type="button"
        className="to-iconbutton to-iconbutton--small"
        aria-label={t('link.remove')}
        title={t('link.remove')}
        onClick={() => void remove(link.id)}
      >
        <Trash2 size={14} />
      </button>
    </li>
  )
}

export function LinksScreen() {
  const t = useT()
  const links = useRecords<SavedLink>('links')
  const { create } = useCollection<SavedLink>('links')
  const [shelf, setShelf] = useState<'later' | 'done'>('later')
  const shown = links
    .filter((link) => link.data.read === (shelf === 'done'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="to-stack">
      <QuickAdd
        placeholder={t('link.placeholder')}
        onAdd={async (text) => {
          const { url, title } = parseLink(text)
          await create({ url, title, note: '', read: false })
          setShelf('later')
        }}
      />
      <Segmented<'later' | 'done'>
        label={t('links.label')}
        value={shelf}
        onChange={setShelf}
        options={[
          { value: 'later', label: t('links.later', { count: links.filter((l) => !l.data.read).length }) },
          { value: 'done', label: t('links.done') },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState title={t(`links.${shelf}.empty`)} body={t('links.body')} />
      ) : (
        <ul className="to-list">
          {shown.map((link) => (
            <LinkRow key={link.id} link={link} />
          ))}
        </ul>
      )}
    </div>
  )
}
