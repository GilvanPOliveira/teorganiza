import { z } from 'zod'

/**
 * A target, a measure and a deadline. Progress is typed in, or followed
 * from something another module offers (a project) through the core's
 * `progress` providers; then `target` and `current` are not used.
 */
export const goalSchema = z.object({
  title: z.string().trim().min(1),
  target: z.number().positive(),
  current: z.number().min(0),
  unit: z.string(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** The progress source it follows, as the core keys it: '<module>:<id>'. */
  source: z.string().nullable().default(null),
})

export type Goal = z.infer<typeof goalSchema>
