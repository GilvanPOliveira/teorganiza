import { z } from 'zod'

export const habitSchema = z.object({
  name: z.string().trim().min(1),
  archived: z.boolean(),
})

/**
 * One mark per habit per day. Unmarking deletes the mark (a tombstone),
 * so two devices marking the same day merge into one mark, not two.
 */
export const checkSchema = z.object({
  habitId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type Habit = z.infer<typeof habitSchema>
export type Check = z.infer<typeof checkSchema>
