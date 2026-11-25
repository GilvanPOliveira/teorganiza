import { z } from 'zod'

/**
 * Free text, found by search rather than by state. A diary entry is a
 * note with a date: one per day, under Diário.
 */
export const noteSchema = z.object({
  title: z.string(),
  body: z.string(),
  kind: z.enum(['note', 'journal']),
  /** Calendar date of a diary entry; null for an ordinary note. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  pinned: z.boolean(),
  /** Hidden from the home widget and, later, from anything that reads across modules. */
  private: z.boolean(),
})

export type Note = z.infer<typeof noteSchema>
