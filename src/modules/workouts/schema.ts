import { z } from 'zod'

export const exerciseSchema = z.object({
  name: z.string().trim().min(1),
  sets: z.number().int().min(1),
  reps: z.number().int().min(1),
  /** Kilograms; 0 for body weight. */
  weight: z.number().min(0),
})

/** One training session: what was done that day. */
export const sessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1),
  exercises: z.array(exerciseSchema),
})

export type Exercise = z.infer<typeof exerciseSchema>
export type Session = z.infer<typeof sessionSchema>

/** Epley's estimate of the one-rep max. */
export function oneRepMax(exercise: Exercise): number {
  if (exercise.weight === 0) return 0
  return Math.round(exercise.weight * (1 + exercise.reps / 30) * 10) / 10
}

/** Sets × reps × weight: the session's load in kg. */
export function volume(session: Session): number {
  return session.exercises.reduce((total, e) => total + e.sets * e.reps * e.weight, 0)
}
