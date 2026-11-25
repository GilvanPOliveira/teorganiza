import { useState } from 'react'
import { Building2, Mail, Phone, Search, Trash2 } from 'lucide-react'
import { EmptyState, Field, QuickAdd, TagList, useCollection, useRecords, useT, type Envelope } from '@core/api'
import type { Client } from './module'

function ClientRow({ client }: { client: Envelope<Client> }) {
  const t = useT()
  const { update, remove } = useCollection<Client>('clients')
  const [open, setOpen] = useState(false)
  const { name, company, email, phone } = client.data

  return (
    <li className="to-list__item to-list__item--column">
      <button type="button" className="to-rowbutton" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="to-avatar" aria-hidden>
          {name.charAt(0).toLocaleUpperCase()}
        </span>
        <span className="to-list__main">
          <span className="to-list__title">{name}</span>
          <span className="to-list__meta">
            {company && (
              <span>
                <Building2 size={12} /> {company}
              </span>
            )}
            {email && (
              <span>
                <Mail size={12} /> {email}
              </span>
            )}
            {phone && (
              <span>
                <Phone size={12} /> {phone}
              </span>
            )}
            <TagList ids={client.tags} />
          </span>
        </span>
      </button>
      {open && (
        <div className="to-toolbar to-indent">
          <Field label={t('field.company')} defaultValue={company} onBlur={(e) => void update(client.id, { company: e.target.value.trim() })} />
          <Field label={t('field.email')} type="email" defaultValue={email} onBlur={(e) => void update(client.id, { email: e.target.value.trim() })} />
          <Field label={t('field.phone')} type="tel" defaultValue={phone} onBlur={(e) => void update(client.id, { phone: e.target.value.trim() })} />
          <button type="button" className="to-button to-button--danger" onClick={() => void remove(client.id)}>
            <Trash2 size={14} />
            {t('client.remove')}
          </button>
        </div>
      )}
    </li>
  )
}

export function ClientsScreen() {
  const t = useT()
  const clients = useRecords<Client>('clients', { sort: { field: 'name', dir: 'asc' } })
  const { create } = useCollection<Client>('clients')
  const [query, setQuery] = useState('')
  const words = query.trim().toLocaleLowerCase()
  const shown = clients.filter(
    (client) => !words || Object.values(client.data).join(' ').toLocaleLowerCase().includes(words),
  )

  return (
    <div className="to-stack">
      <QuickAdd
        placeholder={t('client.placeholder')}
        onAdd={(name) => void create({ name, company: '', email: '', phone: '', note: '' })}
      />
      {clients.length > 5 && (
        <label className="to-search to-search--wide">
          <Search size={15} aria-hidden />
          <input className="to-search__input" value={query} placeholder={t('client.search')} aria-label={t('client.search')} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}
      {shown.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <ul className="to-list">
          {shown.map((client) => (
            <ClientRow key={client.id} client={client} />
          ))}
        </ul>
      )}
    </div>
  )
}
