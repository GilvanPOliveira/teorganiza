import { useRecords, useT } from '@core/api'
import type { Note } from './schema'

/** Pinned notes, never the private ones. */
export function PinnedNotes() {
  const t = useT()
  const pinned = useRecords<Note>('notes', { where: { kind: 'note', pinned: true, private: false } })
  return (
    <div className="to-widget">
      <p className="to-widget__value">{pinned.length}</p>
      <p className="to-muted">{t('widget.pinned.caption', { count: pinned.length })}</p>
      <ul className="to-widget__lines">
        {pinned.slice(0, 4).map((note) => (
          <li key={note.id}>{note.data.title || t('notes.untitled')}</li>
        ))}
      </ul>
    </div>
  )
}
