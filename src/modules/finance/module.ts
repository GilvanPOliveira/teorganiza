import { defineModule } from '@core/api'
import { categorySchema, transactionSchema, type Category, type Transaction } from './schema'
import { TransactionList, TransactionListActions } from './screens'
import { MonthBalance } from './widgets'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

export default defineModule({
  id: 'finance',
  name: 'Finanças',
  apiVersion: 1,
  version: '0.1.0',

  collections: [
    {
      name: 'transactions',
      schema: transactionSchema,
      schemaVersion: 1,
      /** The module's only part in conflict resolution. */
      describe: (record) => {
        const { description, amount, date } = record.data as Transaction
        return `${description} · ${(amount / 100).toFixed(2)} · ${date}`
      },
      indexes: ['date', 'categoryId', 'accountId'],
      /** Grows without bound, so it partitions: one file per month. */
      partition: (record) => (record.data as Transaction).date.slice(0, 7),
    },
    {
      name: 'categories',
      schema: categorySchema,
      schemaVersion: 1,
      describe: (record) => (record.data as Category).name,
      indexes: ['name'],
    },
  ],

  routes: [
    {
      path: '',
      element: TransactionList,
      label: 'Lançamentos',
      actions: TransactionListActions,
    },
  ],

  widgets: [{ id: 'month-balance', label: 'Saldo do mês', size: 'sm', element: MonthBalance }],

  emits: ['transaction-created', 'due-soon'],

  locales: { 'pt-BR': ptBR, en },
})
