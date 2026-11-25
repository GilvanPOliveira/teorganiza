import { Library } from 'lucide-react'
import { defineModule } from '@core/api'
import { bookSchema, type Book } from './schema'
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
  ],

  routes: [{ path: '', element: ReadingScreen }],

  commands: [{ id: 'new-book', label: 'Adicionar livro', path: '', keywords: ['livro', 'leitura', 'estante'] }],

  locales: { 'pt-BR': ptBR },
})
