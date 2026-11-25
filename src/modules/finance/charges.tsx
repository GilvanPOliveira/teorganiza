import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Badge,
  Checkbox,
  EmptyState,
  QuickAdd,
  Stat,
  StatGrid,
  toLocalISODate,
  useCollection,
  useFormat,
  useRecords,
  useT,
} from '@core/api'
import type { Charge } from './schema'

/**
 * Money to receive. The client is a name for now: pointing to a record of
 * the `clients` module needs a cross-module reference, which is still an
 * open decision.
 */
export function ChargesScreen() {
  const t = useT()
  const format = useFormat()
  const today = toLocalISODate()
  const charges = useRecords<Charge>('charges', { sort: { field: 'due', dir: 'asc' } })
  const { create, update, remove } = useCollection<Charge>('charges')
  const [client, setClient] = useState('')
  const [amount, setAmount] = useState('')
  const [due, setDue] = useState(today)

  const open = charges.filter((charge) => !charge.data.paid)
  const paid = charges.filter((charge) => charge.data.paid).reverse().slice(0, 10)
  const sum = (list: typeof charges) => list.reduce((total, charge) => total + charge.data.amount, 0)
  const late = open.filter((charge) => charge.data.due < today)

  return (
    <div className="to-stack">
      <StatGrid>
        <Stat label={t('charges.toReceive')} value={format.money(sum(open))} hint={t('charges.openCount', { count: open.length })} />
        <Stat label={t('charges.late')} value={format.money(sum(late))} tone={late.length ? 'negative' : undefined} hint={t('charges.openCount', { count: late.length })} />
        <Stat label={t('charges.received')} value={format.money(sum(charges.filter((c) => c.data.paid)))} />
      </StatGrid>
      <QuickAdd
        placeholder={t('charges.placeholder')}
        onAdd={async (description) => {
          const cents = Math.round(Number(amount.replace(',', '.')) * 100)
          if (!Number.isFinite(cents) || cents <= 0) return
          await create({ description, client: client.trim(), amount: cents, due, paid: false })
          setAmount('')
        }}
      >
        <input className="to-field__input" value={client} placeholder={t('charges.client')} aria-label={t('charges.client')} onChange={(e) => setClient(e.target.value)} />
        <input className="to-field__input to-input--short" inputMode="decimal" value={amount} placeholder="0,00" aria-label={t('charges.amount')} onChange={(e) => setAmount(e.target.value)} />
        <input type="date" className="to-field__input" value={due} aria-label={t('charges.due')} onChange={(e) => setDue(e.target.value)} />
      </QuickAdd>
      {charges.length === 0 ? (
        <EmptyState title={t('charges.empty.title')} body={t('charges.empty.body')} />
      ) : (
        <ul className="to-list">
          {[...open, ...paid].map((charge) => (
            <li key={charge.id} className={`to-list__item${charge.data.paid ? ' is-done' : ''}`}>
              <Checkbox
                checked={charge.data.paid}
                label={t('charges.markPaid', { description: charge.data.description })}
                onChange={(value) => void update(charge.id, { paid: value })}
              />
              <div className="to-list__main">
                <span className="to-list__title">{charge.data.description}</span>
                <span className="to-list__meta">
                  {charge.data.client && <span>{charge.data.client}</span>}
                  <Badge tone={!charge.data.paid && charge.data.due < today ? 'negative' : undefined}>
                    {format.date(charge.data.due)}
                  </Badge>
                </span>
              </div>
              <strong className={charge.data.paid ? 'to-muted' : 'to-positive'}>{format.money(charge.data.amount)}</strong>
              <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('charges.remove')} onClick={() => void remove(charge.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
