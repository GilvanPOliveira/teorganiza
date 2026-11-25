import { Bot, FolderOpen, Newspaper } from 'lucide-react'
import { defineModule } from '@core/api'
import { FilesPreview, NewsPreview, NexPreview } from './screens'
import ptBR from './locales/pt-BR.json'

/**
 * Three areas that keep their place in the navigation but cannot work yet,
 * each for a reason written down in the project:
 *
 *   Notícias  — needs the network, and a module makes no requests
 *   Arquivos  — attachments are a declared non-goal of v1
 *   Nex (IA)  — needs a server or the user's own API key
 *
 * Each screen says so plainly instead of pretending.
 */
export default defineModule({
  id: 'previews',
  name: 'Em breve',
  apiVersion: 1,
  version: '0.1.0',

  collections: [],

  routes: [
    { path: 'news', element: NewsPreview, area: { id: 'news', label: 'Notícias', icon: Newspaper, order: 180 } },
    { path: 'files', element: FilesPreview, area: { id: 'files', label: 'Arquivos', icon: FolderOpen, order: 220 } },
    { path: 'nex', element: NexPreview, area: { id: 'nex', label: 'Nex', icon: Bot, order: 270 } },
  ],

  locales: { 'pt-BR': ptBR },
})
