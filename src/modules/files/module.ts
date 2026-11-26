import { Paperclip } from 'lucide-react'
import { defineModule } from '@core/api'
import { FilesScreen } from './screens'
import ptBR from './locales/pt-BR.json'

/**
 * Every file the user kept, in one place. The files themselves are a core
 * collection, so any module can attach them; this module only shows them
 * all, as a tab of Notas.
 */
export default defineModule({
  id: 'files',
  name: 'Arquivos',
  apiVersion: 1,
  version: '0.1.0',
  icon: Paperclip,
  order: 220,

  collections: [],

  routes: [{ path: '', element: FilesScreen }],

  commands: [{ id: 'add-file', label: 'Guardar arquivo', path: '', keywords: ['arquivo', 'anexo', 'pdf', 'foto', 'documento'] }],

  locales: { 'pt-BR': ptBR },
})
