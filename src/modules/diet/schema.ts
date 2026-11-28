import { z } from 'zod'

/** The meals of a day, in order. */
export const MOMENTS = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner', 'supper'] as const
export type MealMoment = (typeof MOMENTS)[number]

/**
 * One thing eaten, with its numbers. Typed in, or taken again from what
 * was typed before; a food table (TACO) can fill them in later, once its
 * licence is settled.
 */
export const mealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1),
  kcal: z.number().min(0),
  /** Grams. */
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  /** Which meal of the day; meals written before it existed have none. */
  moment: z.enum(MOMENTS).nullable().optional(),
  /** 'HH:MM', when known. */
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
})

export type Meal = z.infer<typeof mealSchema>
