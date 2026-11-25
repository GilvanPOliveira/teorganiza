import { z } from 'zod'

/**
 * Amounts are integer cents. Never a float — a float turns R$ 0.10 three
 * times into R$ 0.30000000000000004 and a ledger that does not add up.
 */
export const transactionSchema = z.object({
  /** ISO date, 'YYYY-MM-DD'. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int(),
  type: z.enum(['income', 'expense']),
  description: z.string().min(1),
  categoryId: z.string().nullable(),
  accountId: z.string().nullable(),
  paid: z.boolean(),
})

export type Transaction = z.infer<typeof transactionSchema>

export const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  color: z.string(),
  parentId: z.string().nullable(),
})

export type Category = z.infer<typeof categorySchema>
