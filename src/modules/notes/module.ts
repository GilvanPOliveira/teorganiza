import { BookHeart, StickyNote } from 'lucide-react'
import { defineModule } from '@core/api'
import { noteSchema, type Note } from './schema'
import { JournalScreen, NoteScreen, NotesScreen } from './screens'
import { PinnedNotes } from './widgets'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'notes',
  name: 'Notas',
  apiVersion: 1,
  version: '0.1.0',
  icon: StickyNote,

  collections: [
    {
      name: 'notes',
      schema: noteSchema,
      schemaVersion: 1,
      describe: (record) => {
        const note = record.data as Note
        if (note.kind === 'journal') return `Diário · ${note.date}`
        return note.title || note.body.slice(0, 60) || 'Nota sem título'
      },
      indexes: ['kind', 'date', 'pinned'],
    },
  ],

  routes: [
    { path: '', element: NotesScreen, area: { id: 'notes', label: 'Notas', icon: StickyNote, order: 170 } },
    { path: 'edit/:noteId', element: NoteScreen },
    { path: 'journal', element: JournalScreen, area: { id: 'journal', label: 'Diário', icon: BookHeart, order: 150 } },
  ],

  commands: [
    { id: 'new-note', label: 'Nova nota', path: '', keywords: ['nota', 'anotação', 'ideia'] },
    { id: 'journal', label: 'Escrever no diário', path: 'journal', keywords: ['diário', 'dia'] },
  ],

  widgets: [{ id: 'pinned', label: 'Notas fixadas', size: 'sm', element: PinnedNotes }],

  locales: { 'pt-BR': ptBR },
})
