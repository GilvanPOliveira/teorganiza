import { toLocalISODate, useFormat, useRecords, useT } from '@core/api'
import type { Transaction } from './schema'

/** Read-only plus a link, by contract. No forms on the dashboard. */
export function MonthBalance() {
  const t = useT()
  const fmt = useFormat()
  const month = toLocalISODate().slice(0, 7)

  const transactions = useRecords<Transaction>('transactions', {
    where: { date: { gte: `${month}-01`, lte: `${month}-31` } },
  })

  const cents = transactions.reduce(
    (total, record) =>
      total + (record.data.type === 'expense' ? -record.data.amount : record.data.amount),
    0,
  )

  return (
    <div className="to-widget">
      <p className={cents < 0 ? 'to-widget__value to-negative' : 'to-widget__value to-positive'}>
        {fmt.money(cents)}
      </p>
      <p className="to-muted">{t('widget.balance.caption', { count: transactions.length })}</p>
    </div>
  )
}
