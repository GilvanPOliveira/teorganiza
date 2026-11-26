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

/**
 * A link kept to read or watch later: an article, a video, a thread. The
 * app never fetches it; the title is whatever the user typed, or the URL.
 */
export const linkSchema = z.object({
  url: z.string().trim().min(1),
  title: z.string(),
  note: z.string(),
  read: z.boolean(),
})

export type SavedLink = z.infer<typeof linkSchema>
