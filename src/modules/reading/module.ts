import { Library, Link2 } from 'lucide-react'
import { defineModule } from '@core/api'
import { bookSchema, linkSchema, type Book, type SavedLink } from './schema'
import { LinksScreen } from './links'
import { ReadingScreen } from './screens'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'reading',
  name: 'Leitura',
  apiVersion: 1,
  version: '0.1.0',
  icon: Library,
  order: 140,

  collections: [
    {
      name: 'books',
      schema: bookSchema,
      schemaVersion: 1,
      describe: (record) => {
        const book = record.data as Book
        return book.author ? `${book.title} — ${book.author}` : book.title
      },
      indexes: ['status'],
    },
    {
      name: 'links',
      schema: linkSchema,
      schemaVersion: 1,
      describe: (record) => {
        const link = record.data as SavedLink
        return link.title ? `${link.title} — ${link.url}` : link.url
      },
      indexes: ['read'],
    },
  ],

  routes: [
    {
      path: '',
      element: ReadingScreen,
      // Books, and the films and series list from `lists`, share one shelf.
      area: { id: 'shelf', label: 'Estante', icon: Library, order: 140, tabLabel: 'Livros' },
    },
    {
      path: 'links',
      element: LinksScreen,
      area: { id: 'links', label: 'Links salvos', icon: Link2, order: 195, within: 'reading/shelf' },
    },
  ],

  commands: [
    { id: 'new-book', label: 'Adicionar livro', path: '', keywords: ['livro', 'leitura', 'estante'] },
    { id: 'save-link', label: 'Salvar link', path: 'links', keywords: ['link', 'artigo', 'vídeo', 'ler depois', 'notícia'] },
  ],

  locales: { 'pt-BR': ptBR },
})
