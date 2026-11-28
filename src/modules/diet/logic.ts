import type { Goal, ProfileFacts, Restriction, Signal } from '@core/api'
import { MOMENTS, type Meal, type MealMoment } from './schema'

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export const ZERO: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export function sum(meals: readonly Meal[]): Totals {
  return meals.reduce((t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }), ZERO)
}

export interface Targets {
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

/**
 * The day's targets. Calories and protein come from Meus dados (or what
 * was typed by hand); fat takes a share of the calories (less when LDL is
 * high) and carbohydrate the rest, never under 130 g, the brain's minimum.
 */
export function macroTargets(kcal: number | null, protein: number | null, signals: Partial<Record<Signal['key'], Signal>> = {}): Targets {
  if (kcal === null || protein === null) return { kcal, protein, carbs: null, fat: null }
  const fatShare = signals.ldl && signals.ldl.value >= 130 ? 0.25 : 0.3
  const fat = Math.round((kcal * fatShare) / 9)
  const carbs = Math.max(130, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat }
}

/** The meal of the day a time of day most likely is. */
export function momentAt(time: string): MealMoment {
  const h = Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60
  if (h < 9.5) return 'breakfast'
  if (h < 11.5) return 'morningSnack'
  if (h < 14.5) return 'lunch'
  if (h < 18) return 'afternoonSnack'
  if (h < 21) return 'dinner'
  return 'supper'
}

/** A day's meals grouped by meal of the day, in the day's order; meals with none go last. */
export function byMoment<T extends { data: Meal }>(meals: readonly T[]): { moment: MealMoment | null; meals: T[] }[] {
  const order = [...MOMENTS, null] as const
  return order
    .map((moment) => ({ moment, meals: meals.filter((m) => (m.data.moment ?? null) === moment).sort((a, b) => (a.data.time ?? '').localeCompare(b.data.time ?? '')) }))
    .filter((group) => group.meals.length > 0)
}

export interface DaySummary extends Totals {
  date: string
  meals: number
}

/** The days before today with anything logged, newest first. */
export function pastDays(meals: readonly Meal[], today: string, limit = 14): DaySummary[] {
  const days = new Map<string, Meal[]>()
  for (const m of meals) if (m.date < today) days.set(m.date, [...(days.get(m.date) ?? []), m])
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([date, list]) => ({ date, meals: list.length, ...sum(list) }))
}

export interface Favourite {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  moment: MealMoment | null
  count: number
}

/**
 * What is eaten often, with the numbers it had last time: the person's own
 * food list, built from what they typed. Most frequent first, then most recent.
 */
export function favourites(meals: readonly Meal[], limit = 12): Favourite[] {
  const byName = new Map<string, { meal: Meal; count: number }>()
  const newest = [...meals].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')))
  for (const meal of newest) {
    const key = meal.name.trim().toLocaleLowerCase('pt-BR')
    const seen = byName.get(key)
    if (seen) seen.count++
    else byName.set(key, { meal, count: 1 })
  }
  return [...byName.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ meal, count }) => ({ name: meal.name, kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, moment: meal.moment ?? null, count }))
}

export type DietNote =
  | { kind: 'trained' }
  | { kind: 'training' }
  | { kind: 'sodium'; reason: 'flag' | 'pressure'; pressure?: string }
  | { kind: 'carbs'; reason: 'glucose' | 'hba1c'; value: number }
  | { kind: 'fat'; ldl: number }
  | { kind: 'pregnancy' }
  | { kind: 'water'; glasses: number; goal: number }
  | { kind: 'proteinLeft'; grams: number }

/**
 * What the rest of the person's data says about eating today: training
 * from Treino, pressure, glucose and cholesterol from Exames, conditions
 * from Meus dados, water from the day. Orientations, not prescriptions.
 */
export function dietNotes(input: {
  signals: Partial<Record<Signal['key'], Signal>>
  flags: readonly Restriction[]
  goal: Goal | null
  facts: Pick<ProfileFacts, 'waterGlasses'>
  totals: Totals
  targets: Targets
  hour: number
}): DietNote[] {
  const { signals, flags, facts, totals, targets, hour } = input
  const notes: DietNote[] = []
  if (signals.training?.value === 1) notes.push({ kind: 'trained' })
  else if (signals.training?.value === 2) notes.push({ kind: 'training' })

  const bp = signals.bloodPressure
  if (flags.includes('hypertension')) notes.push({ kind: 'sodium', reason: 'flag' })
  else if (bp && (bp.value >= 140 || (bp.value2 ?? 0) >= 90)) notes.push({ kind: 'sodium', reason: 'pressure', pressure: `${bp.value}/${bp.value2}` })

  if (signals.hba1c && signals.hba1c.value >= 5.7) notes.push({ kind: 'carbs', reason: 'hba1c', value: signals.hba1c.value })
  else if (signals.glucose && signals.glucose.value >= 100) notes.push({ kind: 'carbs', reason: 'glucose', value: signals.glucose.value })

  if (signals.ldl && signals.ldl.value >= 130) notes.push({ kind: 'fat', ldl: signals.ldl.value })
  if (flags.includes('pregnancy')) notes.push({ kind: 'pregnancy' })

  // Late in the day, what is still missing is worth saying.
  if (hour >= 15 && facts.waterGlasses && signals.water && signals.water.value < facts.waterGlasses / 2)
    notes.push({ kind: 'water', glasses: signals.water.value, goal: facts.waterGlasses })
  if (hour >= 17 && targets.protein && totals.kcal > 0 && totals.protein < targets.protein * 0.6)
    notes.push({ kind: 'proteinLeft', grams: Math.round(targets.protein - totals.protein) })
  return notes
}
