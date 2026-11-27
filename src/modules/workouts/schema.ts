import { z } from 'zod'
import type { MigrationFn } from '@core/api'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const muscle = z.enum([
  'peito', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco', 'abdomen', 'lombar', 'trapezio',
  'quadriceps', 'posterior', 'gluteos', 'panturrilha', 'adutores', 'cardio', 'corpo',
])
const equipment = z.enum([
  'barra', 'halteres', 'maquina', 'cabo', 'peso-corporal', 'kettlebell', 'elastico', 'barra-ez', 'smith', 'nenhum',
])
const kind = z.enum(['weight', 'bodyweight', 'time', 'cardio'])

/** Normal work, warm-up (not counted in volume), drop set, rest-pause. */
export const setType = z.enum(['normal', 'warmup', 'drop', 'restpause'])
export type SetType = z.infer<typeof setType>

/* ------------------------------------------------------------------ *
 * Sessions: what was done
 * ------------------------------------------------------------------ */

export const loggedSetSchema = z.object({
  type: setType,
  /** Kilograms. Added load for body-weight work; null when there is none. */
  weight: z.number().min(0).nullable(),
  reps: z.number().int().min(0).nullable(),
  /** Timed work and cardio. */
  seconds: z.number().int().min(0).nullable(),
  /** Cardio, in km/h. */
  speed: z.number().min(0).nullable(),
  /** RIR or RPE, as the user chose to log effort. */
  effort: z.number().min(0).max(10).nullable(),
  done: z.boolean(),
})

export const entrySchema = z.object({
  /** A catalog id, 'c:<record id>' for a custom exercise, or null for a free name. */
  exerciseId: z.string().nullable(),
  name: z.string().trim().min(1),
  kind,
  perSide: z.boolean(),
  /** Entries sharing a letter are done back to back. */
  superset: z.string().nullable(),
  /** Rest after each set, in seconds. */
  rest: z.number().int().min(0),
  note: z.string(),
  sets: z.array(loggedSetSchema),
})

/** One training session. While `finishedAt` is null it is the one in progress. */
export const sessionSchema = z.object({
  date,
  name: z.string().trim().min(1),
  routineId: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  note: z.string(),
  entries: z.array(entrySchema),
})

export type LoggedSet = z.infer<typeof loggedSetSchema>
export type Entry = z.infer<typeof entrySchema>
export type Session = z.infer<typeof sessionSchema>

interface SessionV1 {
  date: string
  name: string
  exercises: { name: string; sets: number; reps: number; weight: number }[]
}

/** v1 kept sets × reps × weight per exercise; v2 keeps every set. Old sessions count as finished. */
export const sessionMigrations: MigrationFn[] = [
  (record) => {
    const v1 = record.data as SessionV1
    const data: Session = {
      date: v1.date,
      name: v1.name,
      routineId: null,
      startedAt: null,
      finishedAt: `${v1.date}T12:00:00.000Z`,
      note: '',
      entries: (v1.exercises ?? []).map((exercise) => ({
        exerciseId: null,
        name: exercise.name,
        kind: exercise.weight > 0 ? 'weight' : 'bodyweight',
        perSide: false,
        superset: null,
        rest: 90,
        note: '',
        sets: Array.from({ length: exercise.sets }, () => ({
          type: 'normal' as const,
          weight: exercise.weight > 0 ? exercise.weight : null,
          reps: exercise.reps,
          seconds: null,
          speed: null,
          effort: null,
          done: true,
        })),
      })),
    }
    return { ...record, data }
  },
]

/* ------------------------------------------------------------------ *
 * Routines: what is planned
 * ------------------------------------------------------------------ */

export const plannedSetSchema = z.object({
  type: setType,
  /** Target reps; with `repsMax`, a range for double progression. */
  reps: z.number().int().min(0).nullable(),
  repsMax: z.number().int().min(0).nullable(),
  seconds: z.number().int().min(0).nullable(),
})

export const routineItemSchema = z.object({
  exerciseId: z.string(),
  sets: z.array(plannedSetSchema),
  rest: z.number().int().min(0),
  superset: z.string().nullable(),
  note: z.string(),
  /** Planned load in kilograms; the workout starts from last time's when there is one. */
  weight: z.number().min(0).nullable().optional(),
})

export const routineSchema = z.object({
  name: z.string().trim().min(1),
  /** 0 = Sunday … 6 = Saturday; null when the routine is not tied to a weekday. */
  weekday: z.number().int().min(0).max(6).nullable(),
  order: z.number(),
  items: z.array(routineItemSchema),
})

export type PlannedSet = z.infer<typeof plannedSetSchema>
export type RoutineItem = z.infer<typeof routineItemSchema>
export type Routine = z.infer<typeof routineSchema>

/* ------------------------------------------------------------------ *
 * Custom exercises
 * ------------------------------------------------------------------ */

export const customExerciseSchema = z.object({
  name: z.string().trim().min(1),
  muscle,
  secondary: z.array(muscle),
  equipment,
  kind,
  perSide: z.boolean(),
  compound: z.boolean(),
  instructions: z.string(),
})

export type CustomExercise = z.infer<typeof customExerciseSchema>

export { date as dateSchema }
