import { z } from 'zod'

/**
 * One thing eaten, with its numbers. Typed in for now; a food table
 * (TACO) can fill them in later, once its licence is settled.
 */
export const mealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1),
  kcal: z.number().min(0),
  /** Grams. */
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
})

export type Meal = z.infer<typeof mealSchema>
