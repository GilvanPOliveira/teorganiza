import { Clapperboard, Library, Link2, Music2 } from 'lucide-react'
import { defineModule } from '@core/api'
import { bookSchema, linkSchema, mediaSchema, musicSchema, type Book, type Media, type Music, type SavedLink } from './schema'
import { MediaScreen, MusicScreen } from './shelf'
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
      name: 'media',
      schema: mediaSchema,
      schemaVersion: 1,
      describe: (record) => {
        const media = record.data as Media
        return `${media.title} (${media.kind === 'movie' ? 'filme' : 'série'})`
      },
      indexes: ['status'],
    },
    {
      name: 'music',
      schema: musicSchema,
      schemaVersion: 1,
      describe: (record) => {
        const music = record.data as Music
        return music.artist ? `${music.title} — ${music.artist}` : music.title
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
      path: 'media',
      element: MediaScreen,
      area: { id: 'media', label: 'Filmes e séries', icon: Clapperboard, order: 150, within: 'reading/shelf' },
    },
    {
      path: 'music',
      element: MusicScreen,
      area: { id: 'music', label: 'Música', icon: Music2, order: 160, within: 'reading/shelf' },
    },
    {
      path: 'links',
      element: LinksScreen,
      area: { id: 'links', label: 'Links salvos', icon: Link2, order: 195, within: 'reading/shelf' },
    },
  ],

  commands: [
    { id: 'new-book', label: 'Adicionar livro', path: '', keywords: ['livro', 'leitura', 'estante'] },
    { id: 'new-media', label: 'Adicionar filme ou série', path: 'media', keywords: ['filme', 'série', 'assistir'] },
    { id: 'new-music', label: 'Adicionar música ou álbum', path: 'music', keywords: ['música', 'álbum', 'artista', 'ouvir'] },
    { id: 'save-link', label: 'Salvar link', path: 'links', keywords: ['link', 'artigo', 'vídeo', 'ler depois', 'notícia'] },
  ],

  locales: { 'pt-BR': ptBR },
})
