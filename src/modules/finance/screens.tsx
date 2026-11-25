import { useState } from 'react'
import {
  Button,
  EmptyState,
  Field,
  Table,
  Toolbar,
  toLocalISODate,
  useCollection,
  useEmit,
  useFormat,
  useRecords,
  useT,
} from '@core/api'
import type { Transaction } from './schema'

/**
 * Minimal on purpose. This screen exists to prove the contract end to end:
 * declare a collection, write through the core, read reactively, emit an
 * event, format money and dates — all without touching anything but @core/api.
 */
export function TransactionList() {
  const t = useT()
  const fmt = useFormat()
  const emit = useEmit()
  const { create, remove } = useCollection<Transaction>('transactions')

  const transactions = useRecords<Transaction>('transactions', {
    sort: { field: 'date', dir: 'desc' },
  })

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  async function add() {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!description.trim() || !Number.isFinite(cents) || cents === 0) return

    const id = await create({
      date: toLocalISODate(),
      amount: Math.abs(cents),
      type: cents < 0 ? 'expense' : 'income',
      description: description.trim(),
      categoryId: null,
      accountId: null,
      paid: true,
    })

    emit('transaction-created', { id, amount: Math.abs(cents) })
    setDescription('')
    setAmount('')
  }

  return (
    <div className="to-stack">
      <Toolbar>
        <Field
          label={t('field.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Field
          label={t('field.amount')}
          inputMode="decimal"
          placeholder="-42,90"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Button variant="primary" onClick={() => void add()}>
          {t('action.add')}
        </Button>
      </Toolbar>

      {transactions.length === 0 ? (
        <EmptyState title={t('empty.title')} body={t('empty.body')} />
      ) : (
        <Table headers={[t('column.date'), t('column.description'), t('column.amount'), '']}>
          {transactions.map((record) => (
            <tr key={record.id}>
              <td>{fmt.date(record.data.date)}</td>
              <td>{record.data.description}</td>
              <td className={record.data.type === 'expense' ? 'to-negative' : 'to-positive'}>
                {record.data.type === 'expense' ? '-' : '+'}
                {fmt.money(record.data.amount)}
              </td>
              <td>
                <Button variant="ghost" onClick={() => void remove(record.id)}>
                  {t('action.remove')}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

export function TransactionListActions() {
  const t = useT()
  return <Button variant="primary">{t('action.new')}</Button>
}
