import { z } from 'zod'

export const bookSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string(),
  pages: z.number().int().min(1),
  /** Pages read so far. */
  read: z.number().int().min(0),
  /** 'own': on the shelf, not read yet and not queued. */
  status: z.enum(['want', 'reading', 'done', 'own']),
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

/** The four places of anything on the shelf: queued, going, finished, owned. */
export const shelfStatus = z.enum(['want', 'doing', 'done', 'own'])
export type ShelfStatus = z.infer<typeof shelfStatus>

export const mediaSchema = z.object({
  title: z.string().trim().min(1),
  kind: z.enum(['movie', 'series']),
  status: shelfStatus,
  /** 1 to 5, once watched. */
  rating: z.number().int().min(1).max(5).nullable(),
  /** Where a series stopped. */
  season: z.number().int().min(1).nullable(),
  episode: z.number().int().min(0).nullable(),
  note: z.string(),
})

export type Media = z.infer<typeof mediaSchema>

export const musicSchema = z.object({
  title: z.string().trim().min(1),
  artist: z.string(),
  kind: z.enum(['album', 'artist', 'song', 'playlist']),
  status: shelfStatus,
  rating: z.number().int().min(1).max(5).nullable(),
  note: z.string(),
})

export type Music = z.infer<typeof musicSchema>
