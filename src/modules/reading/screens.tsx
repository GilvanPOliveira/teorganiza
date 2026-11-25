import { useState } from 'react'
import { BookOpen, Check, Play, Trash2 } from 'lucide-react'
import {
  EmptyState,
  Progress,
  QuickAdd,
  Segmented,
  Stat,
  StatGrid,
  useCollection,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import type { Book, BookStatus } from './schema'

function BookTile({ book }: { book: Envelope<Book> }) {
  const t = useT()
  const { update, remove } = useCollection<Book>('books')
  const { title, author, pages, read, status } = book.data
  const addPages = (count: number) => {
    const next = Math.min(pages, Math.max(0, read + count))
    return update(book.id, { read: next, status: next >= pages ? 'done' : 'reading' })
  }

  return (
    <article className="to-tile">
      <span className="to-tile__row">
        <h3 className="to-tile__title">{title}</h3>
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('book.remove')} onClick={() => void remove(book.id)}>
          <Trash2 size={14} />
        </button>
      </span>
      {author && <span className="to-muted">{author}</span>}
      <Progress value={read} max={pages} label={title} />
      <span className="to-tile__row">
        <span>{t('book.pages', { read, pages })}</span>
        <span>{Math.round((read / pages) * 100)}%</span>
      </span>
      <span className="to-toolbar">
        {status === 'want' && (
          <button type="button" className="to-button" onClick={() => void update(book.id, { status: 'reading' })}>
            <Play size={14} />
            {t('book.start')}
          </button>
        )}
        {status === 'reading' && (
          <>
            <button type="button" className="to-button" onClick={() => void addPages(10)}>
              +10
            </button>
            <button type="button" className="to-button" onClick={() => void addPages(25)}>
              +25
            </button>
            <button type="button" className="to-button" onClick={() => void update(book.id, { read: pages, status: 'done' })}>
              <Check size={14} />
              {t('book.finish')}
            </button>
          </>
        )}
      </span>
    </article>
  )
}

export function ReadingScreen() {
  const t = useT()
  const books = useRecords<Book>('books')
  const { create } = useCollection<Book>('books')
  const [status, setStatus] = useState<BookStatus>('reading')
  const [pages, setPages] = useState('')
  const [author, setAuthor] = useState('')
  const shown = books.filter((book) => book.data.status === status)

  return (
    <div className="to-stack">
      <StatGrid>
        <Stat label={t('stats.reading')} value={books.filter((b) => b.data.status === 'reading').length} />
        <Stat label={t('stats.done')} value={books.filter((b) => b.data.status === 'done').length} />
        <Stat label={t('stats.pages')} value={books.reduce((sum, b) => sum + b.data.read, 0).toLocaleString()} />
      </StatGrid>
      <QuickAdd
        placeholder={t('book.placeholder')}
        onAdd={async (title) => {
          const total = Math.max(1, Math.round(Number(pages) || 200))
          await create({ title, author: author.trim(), pages: total, read: 0, status })
          setPages('')
          setAuthor('')
        }}
      >
        <input className="to-field__input" value={author} placeholder={t('book.author')} aria-label={t('book.author')} onChange={(e) => setAuthor(e.target.value)} />
        <input className="to-field__input to-input--short" inputMode="numeric" value={pages} placeholder={t('book.totalPages')} aria-label={t('book.totalPages')} onChange={(e) => setPages(e.target.value)} />
      </QuickAdd>
      <Segmented<BookStatus>
        label={t('shelf.label')}
        value={status}
        onChange={setStatus}
        options={[
          { value: 'reading', label: <><BookOpen size={14} />{t('shelf.reading')}</> },
          { value: 'want', label: t('shelf.want') },
          { value: 'done', label: t('shelf.done') },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState title={t(`shelf.${status}.empty`)} body={t('shelf.body')} />
      ) : (
        <div className="to-cards">
          {shown.map((book) => (
            <BookTile key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  )
}
