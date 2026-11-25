import { z } from 'zod'

/** One check-in per day: small numbers, typed in seconds. */
export const daySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Hours slept last night. */
  sleep: z.number().min(0).max(24).nullable(),
  /** Glasses of water. */
  water: z.number().int().min(0),
  /** 1 (bad) to 5 (great). */
  mood: z.number().int().min(1).max(5).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  note: z.string(),
})

export const medicineSchema = z.object({
  name: z.string().trim().min(1),
  dose: z.string(),
  /** 'HH:MM' times of each dose. */
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
  active: z.boolean(),
})

/** One taken dose; unmarking deletes it. */
export const doseSchema = z.object({
  medicineId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
})

export type Day = z.infer<typeof daySchema>
export type Medicine = z.infer<typeof medicineSchema>
export type Dose = z.infer<typeof doseSchema>
