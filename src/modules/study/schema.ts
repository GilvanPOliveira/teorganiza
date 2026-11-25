import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const courseSchema = z.object({
  name: z.string().trim().min(1),
  /** Hours per week the user wants to study it. */
  weeklyHours: z.number().min(0),
})

export const cardSchema = z.object({
  courseId: z.string().nullable(),
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
  /** Next review date. */
  due: date,
  /** Days until the next review after a good answer. */
  interval: z.number().int().min(0),
  /** SM-2 ease, 1.3 and up. */
  ease: z.number().min(1.3),
  reviews: z.number().int().min(0),
})

export type Course = z.infer<typeof courseSchema>
export type Card = z.infer<typeof cardSchema>
export type Grade = 1 | 2 | 3 | 4
