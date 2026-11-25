import { z } from 'zod'

export const bookSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string(),
  pages: z.number().int().min(1),
  /** Pages read so far. */
  read: z.number().int().min(0),
  status: z.enum(['want', 'reading', 'done']),
})

export type Book = z.infer<typeof bookSchema>
export type BookStatus = Book['status']
