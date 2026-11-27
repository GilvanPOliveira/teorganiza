import { describe, expect, it } from 'vitest'
import { CATALOG, catalogExercise } from './catalog'
import {
  bestOf,
  entryFromPlan,
  itemFromPlan,
  planFor,
  clock,
  entryFor,
  estimateOneRepMax,
  isRecord,
  moveRoutine,
  plannedRoutine,
  sessionVolume,
  warmupFor,
  type PlanSettings,
} from './logic'
import { sessionMigrations, type LoggedSet, type Routine, type Session } from './schema'

const set = (weight: number | null, reps: number | null, extra: Partial<LoggedSet> = {}): LoggedSet => ({
  type: 'normal', weight, reps, seconds: null, speed: null, effort: null, done: true, ...extra,
})

const session = (date: string, entries: Session['entries'], extra: Partial<Session> = {}): Session => ({
  date, name: 'Treino', routineId: null, startedAt: null, finishedAt: `${date}T10:00:00.000Z`, note: '', entries, ...extra,
})

const bench = { exerciseId: 'supino-reto-barra', name: 'Supino reto com barra', kind: 'weight' as const, perSide: false, superset: null, rest: 120, note: '' }

describe('numbers', () => {
  it('estimates the 1RM with Epley, and a single is itself', () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7)
    expect(estimateOneRepMax(100, 1)).toBe(100)
    expect(estimateOneRepMax(null, 5)).toBe(0)
  })

  it('counts volume of done work sets only, doubling per-side work', () => {
    const s = session('2026-11-01', [
      { ...bench, sets: [set(40, 8, { type: 'warmup' }), set(80, 5), set(80, 5, { done: false })] },
      { ...bench, exerciseId: 'afundo', name: 'Afundo', perSide: true, sets: [set(10, 10)] },
    ])
    expect(sessionVolume(s)).toBe(400 + 200)
  })

  it('formats a clock', () => {
    expect(clock(65)).toBe('1:05')
    expect(clock(3723)).toBe('1:02:03')
  })
})

describe('records', () => {
  const history = [session('2026-11-01', [{ ...bench, sets: [set(80, 5), set(85, 3)] }])]

  it('keeps the best estimated 1RM per exercise', () => {
    expect(bestOf(history, bench).oneRepMax).toBe(93.5)
  })

  it('flags a set that beats it, but never a first time or a warm-up', () => {
    const before = bestOf(history, bench)
    expect(isRecord(set(90, 3), 'weight', before)).toBe(true)
    expect(isRecord(set(80, 5), 'weight', before)).toBe(false)
    expect(isRecord(set(200, 1, { type: 'warmup' }), 'weight', before)).toBe(false)
    expect(isRecord(set(50, 5), 'weight', bestOf([], bench))).toBe(false)
  })

  it('uses reps for body weight and time for timed work', () => {
    expect(isRecord(set(null, 12), 'bodyweight', { oneRepMax: 0, reps: 10, seconds: 0 })).toBe(true)
    expect(isRecord(set(null, null, { seconds: 70 }), 'time', { oneRepMax: 0, reps: 0, seconds: 60 })).toBe(true)
  })
})

describe('planning', () => {
  const routines: { id: string; data: Routine }[] = [
    { id: 'a', data: { name: 'A', weekday: 1, order: 0, items: [] } },
    { id: 'b', data: { name: 'B', weekday: 3, order: 1, items: [] } },
    { id: 'c', data: { name: 'C', weekday: 5, order: 2, items: [] } },
  ]
  const week: PlanSettings = { mode: 'week', rotation: [], moved: {} }

  it('takes the routine of the weekday', () => {
    expect(plannedRoutine('2026-11-30', routines, week, [])?.id).toBe('a') // Monday
    expect(plannedRoutine('2026-12-01', routines, week, [])).toBeNull() // Tuesday
  })

  it('moves a day without touching the week', () => {
    const moved = moveRoutine(week, '2026-11-30', '2026-12-01', 'a')
    const plan = { ...week, moved }
    expect(plannedRoutine('2026-11-30', routines, plan, [])).toBeNull()
    expect(plannedRoutine('2026-12-01', routines, plan, [])?.id).toBe('a')
    expect(plannedRoutine('2026-12-07', routines, plan, [])?.id).toBe('a')
  })

  it('in rotation, comes after the last finished and wraps around', () => {
    const rotation: PlanSettings = { mode: 'rotation', rotation: ['a', 'b', 'c'], moved: {} }
    expect(plannedRoutine('2026-12-01', routines, rotation, [])?.id).toBe('a')
    const done = [
      { routineId: 'a', finishedAt: '2026-11-28T10:00:00Z' },
      { routineId: 'c', finishedAt: '2026-11-30T10:00:00Z' },
    ]
    expect(plannedRoutine('2026-12-01', routines, rotation, done)?.id).toBe('a')
    expect(plannedRoutine('2026-12-01', routines, rotation, done.slice(0, 1))?.id).toBe('b')
  })
})

describe('starting a session', () => {
  const exercise = catalogExercise('supino-reto-barra')!

  it('fills each set with the load and reps of last time', () => {
    const history = [session('2026-11-01', [{ ...bench, sets: [set(80, 8), set(80, 7), set(75, 8)] }])]
    const entry = entryFor(exercise, history)
    expect(entry.sets.map((s) => [s.weight, s.reps, s.done])).toEqual([
      [80, 8, false],
      [80, 7, false],
      [75, 8, false],
    ])
    expect(entry.rest).toBe(120)
  })

  it('follows the routine plan for sets and reps, and keeps last loads', () => {
    const history = [session('2026-11-01', [{ ...bench, sets: [set(80, 8)] }])]
    const item = { sets: [{ type: 'warmup' as const, reps: 10, repsMax: null, seconds: null }, { type: 'normal' as const, reps: 5, repsMax: null, seconds: null }, { type: 'normal' as const, reps: 5, repsMax: null, seconds: null }], rest: 180, superset: null, note: '' }
    const entry = entryFor(exercise, history, item)
    expect(entry.sets.map((s) => [s.type, s.weight, s.reps])).toEqual([
      ['warmup', null, 10],
      ['normal', 80, 5],
      ['normal', 80, 5],
    ])
    expect(entry.rest).toBe(180)
  })

  it('builds a warm-up ramp from the work load', () => {
    expect(warmupFor(100).map((s) => [s.weight, s.reps])).toEqual([[40, 8], [60, 5], [80, 3]])
    expect(warmupFor(20).map((s) => s.weight)).toEqual([10])
  })
})

describe('migration', () => {
  it('turns a v1 session into finished sets', () => {
    const old = { id: 'x', schemaVersion: 1, data: { date: '2026-10-10', name: 'Peito', exercises: [{ name: 'Supino', sets: 3, reps: 10, weight: 60 }, { name: 'Flexão', sets: 2, reps: 15, weight: 0 }] } }
    const next = sessionMigrations[0](old as never).data as Session
    expect(next.finishedAt).toBe('2026-10-10T12:00:00.000Z')
    expect(next.entries[0].sets).toHaveLength(3)
    expect(next.entries[0].sets[0]).toMatchObject({ weight: 60, reps: 10, done: true })
    expect(next.entries[1]).toMatchObject({ kind: 'bodyweight' })
    expect(sessionVolume(next)).toBe(1800)
  })
})

describe('planFor and entryFromPlan', () => {
  const bench = CATALOG.find((e) => e.id === 'supino-reto-barra')!
  const plank = CATALOG.find((e) => e.kind === 'time')!

  it('starts from defaults with no history', () => {
    expect(planFor(bench, [])).toEqual({ sets: 4, reps: 8, weight: null, seconds: null, rest: 120, days: [] })
    expect(planFor(plank, [])).toMatchObject({ sets: 3, reps: null, seconds: 30 })
  })

  it('starts from last time, with its heaviest load', () => {
    const done = (weight: number, reps: number) => ({ type: 'normal' as const, weight, reps, seconds: null, speed: null, effort: null, done: true })
    const session = {
      date: '2026-11-20', name: 'A', routineId: null, startedAt: null, finishedAt: '2026-11-20T12:00:00.000Z', note: '',
      entries: [{ exerciseId: bench.id, name: bench.name, kind: 'weight' as const, perSide: false, superset: null, rest: 120, note: '', sets: [done(60, 8), done(62.5, 6)] }],
    }
    expect(planFor(bench, [session], 90, [1, 4])).toEqual({ sets: 2, reps: 8, weight: 62.5, seconds: null, rest: 120, days: [1, 4] })
  })

  it('makes equal sets and keeps rest and superset when swapping', () => {
    const entry = entryFromPlan(bench, { sets: 3, reps: 5, weight: 80, seconds: null, rest: 180, days: [] }, [], 90, { rest: 60, superset: 'A' })
    expect(entry.sets).toHaveLength(3)
    expect(entry.sets.every((s) => s.weight === 80 && s.reps === 5 && !s.done)).toBe(true)
    expect(entry).toMatchObject({ rest: 180, superset: 'A', exerciseId: bench.id })
  })

  it('turns a plan into a routine item, and the item back into a workout with its load', () => {
    const item = itemFromPlan(bench.id, { sets: 4, reps: 6, weight: 70, seconds: null, rest: 150, days: [1] })
    expect(item).toMatchObject({ exerciseId: bench.id, rest: 150, weight: 70 })
    expect(item.sets).toHaveLength(4)
    const entry = entryFor(bench, [], item)
    expect(entry.sets.map((s) => [s.weight, s.reps])).toEqual([[70, 6], [70, 6], [70, 6], [70, 6]])
  })
})
