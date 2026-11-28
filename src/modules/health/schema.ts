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

/**
 * An exam or appointment: when, what, where and what it found. The report
 * itself (a PDF, an image) is attached as a file to the record.
 */
export const examSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1),
  kind: z.enum(['lab', 'image', 'consult', 'other']),
  place: z.string(),
  result: z.string(),
  /** Follow-up date, when there is one. */
  next: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /**
   * The few numbers the rest of the app can act on (training reads blood
   * pressure and glucose). Optional, so older records still validate.
   */
  values: z
    .object({
      systolic: z.number().min(50).max(260).nullable(),
      diastolic: z.number().min(30).max(160).nullable(),
      /** Fasting, mg/dL. */
      glucose: z.number().min(20).max(800).nullable(),
      /** mg/dL. */
      ldl: z.number().min(10).max(500).nullable(),
    })
    .partial()
    .optional(),
})

export const EXAM_VALUES = ['systolic', 'diastolic', 'glucose', 'ldl'] as const

export type Exam = z.infer<typeof examSchema>

/**
 * One measurement: a blood pressure taken at home, a glucose from a lab
 * report. Readings are what the indicator cards chart and what training
 * reads; an exam is the document they may have come from.
 */
export const readingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** HH:MM, when it matters (pressure and glucose change over the day). */
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  /** A key of MARKERS (markers.ts). */
  marker: z.string().min(1),
  value: z.number(),
  /** Diastolic pressure. */
  value2: z.number().nullable(),
  /** The exam it was read from, when it came from one. */
  examId: z.string().nullable(),
})

export type Reading = z.infer<typeof readingSchema>
