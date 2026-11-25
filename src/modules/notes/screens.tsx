import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Lock, Pin, Plus, Search, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  TagList,
  TagPicker,
  TextArea,
  toLocalISODate,
  useCollection,
  useFormat,
  useNavigate,
  useParams,
  useRecord,
  useRecords,
  useT,
  type Envelope,
} from '@core/api'
import type { Note } from './schema'

const EMPTY_NOTE: Note = { title: '', body: '', kind: 'note', date: null, pinned: false, private: false }

/** Saves while typing, a moment after the last key, so nothing waits for a button. */
function useAutosave(id: string | null, patch: Partial<Note> | null) {
  const { update } = useCollection<Note>('notes')
  const key = JSON.stringify(patch)
  useEffect(() => {
    if (!id || !patch) return
    const timer = setTimeout(() => void update(id, patch), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key])
}

export function NotesScreen() {
  const t = useT()
  const navigate = useNavigate()
  const format = useFormat()
  const { create } = useCollection<Note>('notes')
  const [query, setQuery] = useState('')
  const notes = useRecords<Note>('notes', { where: { kind: 'note' } })
  const words = query.trim().toLocaleLowerCase()
  const shown = notes
    .filter((note) => !words || `${note.data.title} ${note.data.body}`.toLocaleLowerCase().includes(words))
    .sort((a, b) => Number(b.data.pinned) - Number(a.data.pinned) || b.updatedAt.localeCompare(a.updatedAt))

  const newNote = async () => {
    const id = await create(EMPTY_NOTE)
    navigate(`edit/${id}`)
  }

  return (
    <div className="to-stack">
      <div className="to-toolbar to-toolbar--center">
        <label className="to-search to-search--wide">
          <Search size={15} aria-hidden />
          <input
            className="to-search__input"
            value={query}
            placeholder={t('notes.search')}
            aria-label={t('notes.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button variant="primary" onClick={() => void newNote()}>
          <Plus size={15} />
          {t('notes.new')}
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={t(query ? 'notes.none' : 'notes.empty.title')} body={query ? undefined : t('notes.empty.body')} />
      ) : (
        <div className="to-cards to-cards--notes">
          {shown.map((note) => (
            <button key={note.id} type="button" className="to-tile to-tile--button to-note" onClick={() => navigate(`edit/${note.id}`)}>
              <span className="to-tile__row">
                <strong className="to-note__title">{note.data.title || t('notes.untitled')}</strong>
                <span className="to-note__flags">
                  {note.data.pinned && <Pin size={13} />}
                  {note.data.private && <Lock size={13} />}
                </span>
              </span>
              <span className="to-note__body">{note.data.private ? t('notes.privateHidden') : note.data.body}</span>
              <span className="to-tile__row">
                <span>{format.relative(note.updatedAt)}</span>
                <TagList ids={note.tags} linked={false} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NoteEditor({ note }: { note: Envelope<Note> }) {
  const t = useT()
  const navigate = useNavigate()
  const { update, remove, setTags } = useCollection<Note>('notes')
  const [title, setTitle] = useState(note.data.title)
  const [body, setBody] = useState(note.data.body)
  const changed = title !== note.data.title || body !== note.data.body
  useAutosave(note.id, changed ? { title, body } : null)

  return (
    <div className="to-stack to-editor">
      <div className="to-toolbar to-toolbar--center">
        <Button variant="ghost" onClick={() => navigate('')}>
          <ArrowLeft size={15} />
          {t('notes.back')}
        </Button>
        <span className="to-grow" />
        <Button variant={note.data.pinned ? 'primary' : 'ghost'} onClick={() => void update(note.id, { pinned: !note.data.pinned })}>
          <Pin size={15} />
          {t(note.data.pinned ? 'notes.unpin' : 'notes.pin')}
        </Button>
        <Button variant={note.data.private ? 'primary' : 'ghost'} onClick={() => void update(note.id, { private: !note.data.private })}>
          <Lock size={15} />
          {t('notes.private')}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            void remove(note.id)
            navigate('')
          }}
        >
          <Trash2 size={15} />
        </Button>
      </div>
      <Field label={t('notes.title')} value={title} onChange={(event) => setTitle(event.target.value)} />
      <TextArea label={t('notes.body')} value={body} rows={14} onChange={(event) => setBody(event.target.value)} />
      <TagPicker label={t('notes.tags')} value={note.tags ?? []} onChange={(tags) => void setTags(note.id, tags)} />
      <p className="to-muted">{t('notes.autosave')}</p>
    </div>
  )
}

export function NoteScreen() {
  const t = useT()
  const { noteId = '' } = useParams<{ noteId: string }>()
  const note = useRecord<Note>('notes', noteId)
  // undefined while loading (and for an id that never existed).
  if (!note) return null
  if (note.deletedAt) return <EmptyState title={t('notes.missing')} />
  // Keyed by id: opening another note starts a fresh editor.
  return <NoteEditor key={note.id} note={note} />
}

/* ------------------------------------------------------------------ *
 * Diário
 * ------------------------------------------------------------------ */

function JournalEditor({ entry, date }: { entry: Envelope<Note> | undefined; date: string }) {
  const t = useT()
  const { create } = useCollection<Note>('notes')
  const [body, setBody] = useState(entry?.data.body ?? '')
  const creating = useRef(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const id = entry?.id ?? createdId
  useAutosave(id, id && body !== (entry?.data.body ?? '') ? { body } : null)

  const onChange = async (value: string) => {
    setBody(value)
    // The day's entry is created on the first keystroke, not on opening the page.
    if (!id && !creating.current && value.trim()) {
      creating.current = true
      setCreatedId(await create({ ...EMPTY_NOTE, kind: 'journal', date, body: value, private: true }))
    }
  }

  return (
    <TextArea
      label={t('journal.today')}
      placeholder={t('journal.placeholder')}
      value={body}
      rows={8}
      onChange={(event) => void onChange(event.target.value)}
    />
  )
}

export function JournalScreen() {
  const t = useT()
  const format = useFormat()
  const today = toLocalISODate()
  const entries = useRecords<Note>('notes', { where: { kind: 'journal' }, sort: { field: 'date', dir: 'desc' } })
  const todays = entries.find((entry) => entry.data.date === today)
  const past = entries.filter((entry) => entry.data.date !== today)
  const ready = entries !== undefined

  return (
    <div className="to-stack">
      {ready && <JournalEditor key={todays?.id ?? 'new'} entry={todays} date={today} />}
      <p className="to-muted">{t('journal.privacy')}</p>
      {past.length > 0 && (
        <>
          <h2 className="to-section-title">{t('journal.past')}</h2>
          <ul className="to-list">
            {past.map((entry) => (
              <li key={entry.id} className="to-list__item to-list__item--top">
                <Badge tone="accent">{format.date(entry.data.date!)}</Badge>
                <span className="to-list__title to-prewrap">{entry.data.body}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
