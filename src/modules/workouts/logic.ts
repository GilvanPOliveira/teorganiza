import type { ExerciseDef } from './catalog'
import type { Entry, LoggedSet, PlannedSet, PlanSnapshot, Routine, RoutineItem, Session } from './schema'

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

/** Epley's estimate of the one-rep max, from one set. */
export function estimateOneRepMax(weight: number | null, reps: number | null): number {
  if (!weight || !reps) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/** Rounds a load to what can be put on a bar: steps of 2.5 kg by default. */
export function roundLoad(kg: number, step = 2.5): number {
  return Math.max(0, Math.round(kg / step) * step)
}

const worksFor = (set: LoggedSet) => set.done && set.type !== 'warmup'

/** Load moved in a session, in kg: reps × weight of every done work set. Warm-ups are left out. */
export function sessionVolume(session: Pick<Session, 'entries'>): number {
  let total = 0
  for (const entry of session.entries) {
    for (const set of entry.sets) {
      if (worksFor(set) && set.weight && set.reps) total += set.weight * set.reps * (entry.perSide ? 2 : 1)
    }
  }
  return Math.round(total)
}

export function doneSets(session: Pick<Session, 'entries'>): number {
  return session.entries.reduce((sum, entry) => sum + entry.sets.filter(worksFor).length, 0)
}

/* ------------------------------------------------------------------ *
 * Records
 * ------------------------------------------------------------------ */

/** The best of one exercise so far: estimated 1RM, and for work without load, reps or time. */
export interface Best {
  oneRepMax: number
  reps: number
  seconds: number
}

const NONE: Best = { oneRepMax: 0, reps: 0, seconds: 0 }

/** Same exercise: by id when both have one, otherwise by name, ignoring case. */
export function sameExercise(a: Pick<Entry, 'exerciseId' | 'name'>, b: Pick<Entry, 'exerciseId' | 'name'>): boolean {
  if (a.exerciseId && b.exerciseId) return a.exerciseId === b.exerciseId
  return a.name.trim().toLocaleLowerCase() === b.name.trim().toLocaleLowerCase()
}

export function bestOf(sessions: Session[], exercise: Pick<Entry, 'exerciseId' | 'name'>, excludeId?: string): Best {
  const best = { ...NONE }
  for (const session of sessions) {
    if (excludeId && (session as Session & { id?: string }).id === excludeId) continue
    for (const entry of session.entries) {
      if (!sameExercise(entry, exercise)) continue
      for (const set of entry.sets) {
        if (!worksFor(set)) continue
        best.oneRepMax = Math.max(best.oneRepMax, estimateOneRepMax(set.weight, set.reps))
        best.reps = Math.max(best.reps, set.reps ?? 0)
        best.seconds = Math.max(best.seconds, set.seconds ?? 0)
      }
    }
  }
  return best
}

/** Whether a set just done beats the best before it. The first time an exercise is done is not a record. */
export function isRecord(set: LoggedSet, kind: Entry['kind'], before: Best): boolean {
  if (!worksFor(set)) return false
  if (kind === 'weight' || (kind === 'bodyweight' && set.weight)) {
    const value = estimateOneRepMax(set.weight, set.reps)
    return before.oneRepMax > 0 && value > before.oneRepMax
  }
  if (kind === 'bodyweight') return before.reps > 0 && (set.reps ?? 0) > before.reps
  return before.seconds > 0 && (set.seconds ?? 0) > before.seconds
}

/* ------------------------------------------------------------------ *
 * Planning: which routine today
 * ------------------------------------------------------------------ */

export interface PlanSettings {
  mode: 'week' | 'rotation'
  /** Routine ids in rotation order. */
  rotation: string[]
  /** Per date: a routine moved there, or 'rest' for a day whose routine was moved away. */
  moved: Record<string, string>
  /** Weekdays set to rest (0 = Sunday): their routine stays on the day, but is not planned. */
  off?: number[]
}

function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/**
 * The routine planned for a day. Week mode: the routine tied to that
 * weekday. Rotation mode: the one after the last routine finished.
 * A move made for that date wins over both.
 */
export function plannedRoutine<R extends { id: string; data: Routine }>(
  date: string,
  routines: R[],
  plan: PlanSettings,
  finished: { routineId: string | null; finishedAt: string | null }[],
): R | null {
  const moved = plan.moved[date]
  if (moved === 'rest') return null
  if (moved) return routines.find((r) => r.id === moved) ?? null

  if (plan.mode === 'rotation') {
    const order = plan.rotation.filter((id) => routines.some((r) => r.id === id))
    if (order.length === 0) return null
    const last = [...finished]
      .filter((s) => s.finishedAt && s.routineId && order.includes(s.routineId))
      .sort((a, b) => (a.finishedAt! < b.finishedAt! ? 1 : -1))[0]
    const next = last ? order[(order.indexOf(last.routineId!) + 1) % order.length] : order[0]
    return routines.find((r) => r.id === next) ?? null
  }

  const day = weekdayOf(date)
  if (plan.off?.includes(day)) return null
  return routines.find((r) => r.data.weekday === day) ?? null
}

/** Moves a day's routine to another date, keeping the weekly plan as it is. */
export function moveRoutine(plan: PlanSettings, from: string, to: string, routineId: string): PlanSettings['moved'] {
  return { ...plan.moved, [from]: 'rest', [to]: routineId }
}

/* ------------------------------------------------------------------ *
 * Starting a session
 * ------------------------------------------------------------------ */

/** The last finished entry of an exercise, newest session first. */
export function lastEntry(sessions: Session[], exercise: Pick<Entry, 'exerciseId' | 'name'>): Entry | undefined {
  const ordered = [...sessions]
    .filter((s) => s.finishedAt)
    .sort((a, b) => (a.date === b.date ? (a.finishedAt! < b.finishedAt! ? 1 : -1) : a.date < b.date ? 1 : -1))
  for (const session of ordered) {
    const found = session.entries.find((entry) => sameExercise(entry, exercise))
    if (found) return found
  }
  return undefined
}

function emptySet(type: LoggedSet['type'] = 'normal'): LoggedSet {
  return { type, weight: null, reps: null, seconds: null, speed: null, effort: null, done: false }
}

/**
 * An entry ready to log: the routine's planned sets, with the load and
 * reps from the last time this exercise was done, set by set.
 */
export function entryFor(
  exercise: ExerciseDef,
  sessions: Session[],
  item?: Pick<RoutineItem, 'sets' | 'rest' | 'superset' | 'note' | 'weight'>,
  defaultRest = 90,
): Entry {
  const id = { exerciseId: exercise.id, name: exercise.name }
  const last = lastEntry(sessions, id)
  const lastWork = last?.sets.filter((s) => s.type !== 'warmup') ?? []
  const planned: PlannedSet[] = item?.sets.length
    ? item.sets
    : lastWork.length
      ? lastWork.map((s) => ({ type: s.type, reps: s.reps, repsMax: null, seconds: s.seconds }))
      : [{ type: 'normal', reps: exercise.kind === 'time' || exercise.kind === 'cardio' ? null : 10, repsMax: null, seconds: exercise.kind === 'time' ? 30 : exercise.kind === 'cardio' ? 1200 : null }]

  let workIndex = 0
  const sets = planned.map((plan) => {
    const previous = plan.type === 'warmup' ? undefined : lastWork[Math.min(workIndex++, Math.max(lastWork.length - 1, 0))]
    return {
      ...emptySet(plan.type),
      weight: previous?.weight ?? (plan.type === 'warmup' ? null : (item?.weight ?? null)),
      reps: plan.reps ?? previous?.reps ?? null,
      seconds: plan.seconds ?? previous?.seconds ?? null,
      speed: previous?.speed ?? null,
    }
  })

  return {
    exerciseId: exercise.id,
    name: exercise.name,
    kind: exercise.kind,
    perSide: exercise.perSide,
    superset: item?.superset ?? null,
    rest: item?.rest ?? last?.rest ?? defaultRest,
    note: item?.note ?? '',
    sets,
  }
}

/**
 * Warm-up sets before the first work set, from its load: 40% × 8,
 * 60% × 5 and 80% × 3, rounded to the bar. Light loads get fewer.
 */
export function warmupFor(workWeight: number, step = 2.5): LoggedSet[] {
  const ramp: [number, number][] = workWeight >= 60 ? [[0.4, 8], [0.6, 5], [0.8, 3]] : workWeight >= 30 ? [[0.5, 8], [0.75, 4]] : [[0.5, 8]]
  return ramp
    .map(([share, reps]) => ({ ...emptySet('warmup'), weight: roundLoad(workWeight * share, step), reps }))
    .filter((set) => (set.weight ?? 0) > 0)
}

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

/** "1:05", "12:00", "1:02:03" */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** How an exercise goes into a workout or the training plan. */
export interface ExercisePlan {
  sets: number
  reps: number | null
  /** Kilograms; added load for body-weight work. */
  weight: number | null
  seconds: number | null
  /** Rest after each set, in seconds. */
  rest: number
  /** Weekdays it is done on (0 = Sunday), when registering it in the plan. */
  days: number[]
}

/**
 * Where to start: what was done last time, or a sensible default (3 × 10,
 * 4 × 8 for a compound lift, 30 s held, 20 min of cardio).
 */
export function planFor(exercise: ExerciseDef, sessions: Session[], defaultRest = 90, days: number[] = []): ExercisePlan {
  const last = lastEntry(sessions, { exerciseId: exercise.id, name: exercise.name })
  const work = last?.sets.filter((s) => s.type !== 'warmup') ?? []
  const timed = exercise.kind === 'time' || exercise.kind === 'cardio'
  return {
    sets: work.length || (exercise.kind === 'cardio' ? 1 : exercise.compound ? 4 : 3),
    reps: timed ? null : (work[0]?.reps ?? (exercise.compound ? 8 : 10)),
    weight: timed ? null : (work.reduce<number | null>((top, s) => (s.weight !== null && (top === null || s.weight > top) ? s.weight : top), null)),
    seconds: timed ? (work[0]?.seconds ?? (exercise.kind === 'time' ? 30 : 1200)) : null,
    rest: last?.rest ?? (exercise.compound ? 120 : defaultRest),
    days,
  }
}

/** A plan as a routine's item: that many equal work sets, with its load and rest. */
export function itemFromPlan(exerciseId: string, plan: ExercisePlan, keep?: Pick<RoutineItem, 'superset' | 'note' | 'sets'>): RoutineItem {
  return {
    exerciseId,
    sets: [
      ...(keep?.sets.filter((s) => s.type === 'warmup') ?? []),
      ...Array.from({ length: Math.max(1, plan.sets) }, () => ({ type: 'normal' as const, reps: plan.reps, repsMax: null, seconds: plan.seconds })),
    ],
    rest: plan.rest,
    superset: keep?.superset ?? null,
    note: keep?.note ?? '',
    weight: plan.weight,
  }
}

/** What a routine item plans, as the fields of the exercise card start from. */
export function planOfItem(item: RoutineItem): Partial<ExercisePlan> {
  const work = item.sets.filter((s) => s.type !== 'warmup')
  return { sets: work.length || 1, reps: work[0]?.reps ?? null, seconds: work[0]?.seconds ?? null, weight: item.weight ?? null, rest: item.rest }
}

/**
 * A workout entry made from a plan: that many equal sets. `base` keeps the
 * rest and superset of the entry it replaces, when swapping.
 */
export function entryFromPlan(
  exercise: ExerciseDef,
  plan: ExercisePlan,
  sessions: Session[],
  defaultRest: number,
  base?: Pick<Entry, 'rest' | 'superset'>,
): Entry {
  const entry = entryFor(exercise, sessions, undefined, defaultRest)
  const speed = entry.sets.find((s) => s.speed !== null)?.speed ?? null
  const set: LoggedSet = { ...emptySet('normal'), weight: plan.weight, reps: plan.reps, seconds: plan.seconds, speed }
  return {
    ...entry,
    rest: plan.rest ?? base?.rest ?? entry.rest,
    superset: base?.superset ?? null,
    sets: Array.from({ length: Math.max(1, plan.sets) }, () => ({ ...set })),
  }
}

/* ------------------------------------------------------------------ *
 * Sheet versions
 * ------------------------------------------------------------------ */

/** Monday 0 … Sunday 6, and routines without a day after them. */
const weekOrder = (weekday: number | null) => (weekday === null ? 7 : (weekday + 6) % 7)

/** The sheet as it is now: the routines with exercises, by weekday then name. */
export function snapshotRoutines(routines: Routine[], off: number[]): PlanSnapshot['routines'] {
  return routines
    .filter((r) => r.items.length > 0)
    .map((r) => ({ name: r.name, weekday: r.weekday, off: r.weekday !== null && off.includes(r.weekday), items: r.items }))
    .sort((a, b) => weekOrder(a.weekday) - weekOrder(b.weekday) || a.name.localeCompare(b.name, 'pt-BR'))
}

/** One version per day, the last one kept that day; newest first. */
export function snapshotsByDay<R extends { data: Pick<PlanSnapshot, "date" | "savedAt"> }>(rows: R[]): R[] {
  const byDate = new Map<string, R>()
  for (const row of rows) {
    const kept = byDate.get(row.data.date)
    if (!kept || row.data.savedAt > kept.data.savedAt) byDate.set(row.data.date, row)
  }
  return [...byDate.values()].sort((a, b) => (a.data.date < b.data.date ? 1 : -1))
}
