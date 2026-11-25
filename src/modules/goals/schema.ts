import { z } from 'zod'

/**
 * A target, a measure and a deadline. Progress is typed in for now; later
 * it can come from other modules through the `metrics` provider.
 */
export const goalSchema = z.object({
  title: z.string().trim().min(1),
  target: z.number().positive(),
  current: z.number().min(0),
  unit: z.string(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
})

export type Goal = z.infer<typeof goalSchema>
