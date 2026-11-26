import { Users } from 'lucide-react'
import { z } from 'zod'
import { defineModule } from '@core/api'
import { ClientsScreen } from './screens'
import ptBR from './locales/pt-BR.json'

export const clientSchema = z.object({
  name: z.string().trim().min(1),
  company: z.string(),
  email: z.string(),
  phone: z.string(),
  note: z.string(),
})

export type Client = z.infer<typeof clientSchema>

export default defineModule({
  id: 'clients',
  name: 'Clientes',
  apiVersion: 1,
  version: '0.1.0',
  icon: Users,
  order: 220,
  within: 'finance/ledger',

  collections: [
    {
      name: 'clients',
      schema: clientSchema,
      schemaVersion: 1,
      describe: (record) => {
        const client = record.data as Client
        return client.company ? `${client.name} · ${client.company}` : client.name
      },
      indexes: ['name'],
    },
  ],

  routes: [{ path: '', element: ClientsScreen }],

  commands: [{ id: 'new-client', label: 'Novo cliente', path: '', keywords: ['cliente', 'contato'] }],

  locales: { 'pt-BR': ptBR },
})
