import { z } from 'zod'

export const eventSchema = z.object({
  title: z.string().trim().min(1),
  /** Calendar date, 'YYYY-MM-DD'. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** 'HH:MM', or null for all day. */
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  /** Shown under Lembretes. A reminder outside the app comes with notifications. */
  remind: z.boolean(),
  note: z.string(),
})

export type CalendarEvent = z.infer<typeof eventSchema>
