import { z } from 'zod'

/**
 * Meus dados: who the person is, once, for every module. Training orders
 * its ready plans by it, meals take a calorie and protein target from it,
 * the day takes a water goal and exams a list of check-ups.
 *
 * Every field is optional: what is not filled in simply is not used.
 * Everything here is arithmetic on well-known formulas, never advice.
 */

export const SEXES = ['f', 'm'] as const
export const GOALS = ['lose', 'health', 'gain', 'strength'] as const
export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export const PLACES = ['gym', 'home'] as const
export const ACTIVITIES = ['sedentary', 'light', 'moderate', 'high'] as const
/** Conditions that change which exercises are suggested. */
export const RESTRICTIONS = ['knee', 'back', 'shoulder', 'wrist', 'hypertension', 'pregnancy', 'noImpact'] as const

export type Sex = (typeof SEXES)[number]
export type Goal = (typeof GOALS)[number]
export type Level = (typeof LEVELS)[number]
export type Place = (typeof PLACES)[number]
export type Activity = (typeof ACTIVITIES)[number]
export type Restriction = (typeof RESTRICTIONS)[number]

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const profileSchema = z.object({
  sex: z.enum(SEXES).nullable(),
  birth: isoDate.nullable(),
  /** Centimetres. */
  height: z.number().min(50).max(260).nullable(),
  goal: z.enum(GOALS).nullable(),
  level: z.enum(LEVELS).nullable(),
  /** Days a week available to train. */
  days: z.number().int().min(1).max(7).nullable(),
  place: z.enum(PLACES).nullable(),
  /** Day-to-day movement outside training, for the daily energy estimate. */
  activity: z.enum(ACTIVITIES).nullable(),
  /** Injuries, allergies, conditions: free text, for the person to see where it matters. */
  restrictions: z.string(),
  /** The restrictions that act on training; optional so older records still validate. */
  flags: z.array(z.enum(RESTRICTIONS)).optional(),
})

export const weightSchema = z.object({
  date: isoDate,
  /** Kilograms. */
  kg: z.number().min(20).max(400),
})

export type Profile = z.infer<typeof profileSchema>
export type WeightEntry = z.infer<typeof weightSchema>

export const EMPTY_PROFILE: Profile = {
  sex: null,
  birth: null,
  height: null,
  goal: null,
  level: null,
  days: null,
  place: null,
  activity: null,
  restrictions: '',
  flags: [],
}

/* ------------------------------------------------------------------ *
 * Figures
 * ------------------------------------------------------------------ */

/** Whole years between a birth date and a day, both ISO. */
export function ageOn(birth: string | null, today: string): number | null {
  if (!birth) return null
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age >= 0 && age < 130 ? age : null
}

/** The most recent weighing, by date. */
export function latestWeight(weights: readonly WeightEntry[]): WeightEntry | null {
  let latest: WeightEntry | null = null
  for (const entry of weights) if (!latest || entry.date > latest.date) latest = entry
  return latest
}

export function bmi(kg: number | null, cm: number | null): number | null {
  if (!kg || !cm) return null
  const m = cm / 100
  return Math.round((kg / (m * m)) * 10) / 10
}

export type BmiBand = 'under' | 'normal' | 'over' | 'obese'
/** WHO bands for adults. */
export function bmiBand(value: number | null): BmiBand | null {
  if (value === null) return null
  if (value < 18.5) return 'under'
  if (value < 25) return 'normal'
  if (value < 30) return 'over'
  return 'obese'
}

/** Resting energy, Mifflin–St Jeor, kcal/day. */
export function restingEnergy(p: { sex: Sex | null; age: number | null; kg: number | null; cm: number | null }): number | null {
  if (!p.sex || p.age === null || !p.kg || !p.cm) return null
  return Math.round(10 * p.kg + 6.25 * p.cm - 5 * p.age + (p.sex === 'm' ? 5 : -161))
}

const ACTIVITY_FACTOR: Record<Activity, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 }

/** Daily energy: resting energy times activity, with training days counted in. */
export function dailyEnergy(resting: number | null, activity: Activity | null, trainingDays: number | null): number | null {
  if (resting === null) return null
  let factor = ACTIVITY_FACTOR[activity ?? 'sedentary']
  // Training on most days of the week lifts an otherwise quiet routine a step.
  if (trainingDays && trainingDays >= 3 && factor < ACTIVITY_FACTOR.moderate) factor = trainingDays >= 5 ? ACTIVITY_FACTOR.moderate : ACTIVITY_FACTOR.light
  return Math.round(factor * resting)
}

/** A moderate deficit to lose, a small surplus to gain, maintenance otherwise. */
export function calorieTarget(daily: number | null, goal: Goal | null): number | null {
  if (daily === null) return null
  const shift = goal === 'lose' ? -500 : goal === 'gain' ? 300 : goal === 'strength' ? 200 : 0
  return Math.round((daily + shift) / 50) * 50
}

/** Grams a day: 1.2 g/kg for health, 1.6 to keep muscle while losing, 1.8 to build. */
export function proteinTarget(kg: number | null, goal: Goal | null): number | null {
  if (!kg) return null
  const perKg = goal === 'gain' || goal === 'strength' ? 1.8 : goal === 'lose' ? 1.6 : 1.2
  return Math.round((kg * perKg) / 5) * 5
}

/** About 35 ml per kilo, in ml. */
export function waterTarget(kg: number | null): number | null {
  if (!kg) return null
  return Math.round((kg * 35) / 50) * 50
}

/** A glass, as the day's water counter counts it. */
export const GLASS_ML = 250

/* ------------------------------------------------------------------ *
 * Body measures
 * ------------------------------------------------------------------ */

/**
 * What a personal trainer or a nutritionist takes at a first assessment,
 * besides weight and height: tape measures (perimetry) and body
 * composition, as a bioimpedance scale or a skinfold assessment gives it.
 */
export const BODY_MEASURES = [
  { key: 'neck', group: 'tape', label: 'Pescoço', unit: 'cm', min: 20, max: 70, decimals: 1 },
  { key: 'shoulders', group: 'tape', label: 'Ombros', unit: 'cm', min: 60, max: 200, decimals: 1 },
  { key: 'chest', group: 'tape', label: 'Tórax', unit: 'cm', min: 50, max: 200, decimals: 1 },
  { key: 'waist', group: 'tape', label: 'Cintura', unit: 'cm', min: 40, max: 220, decimals: 1, how: 'Na parte mais estreita do tronco, entre a última costela e o umbigo.' },
  { key: 'abdomen', group: 'tape', label: 'Abdômen', unit: 'cm', min: 40, max: 220, decimals: 1, how: 'Na altura do umbigo.' },
  { key: 'hip', group: 'tape', label: 'Quadril', unit: 'cm', min: 50, max: 220, decimals: 1, how: 'Na parte mais larga do glúteo.' },
  { key: 'arm', group: 'tape', label: 'Braço relaxado', unit: 'cm', min: 15, max: 70, decimals: 1 },
  { key: 'armFlexed', group: 'tape', label: 'Braço contraído', unit: 'cm', min: 15, max: 75, decimals: 1 },
  { key: 'forearm', group: 'tape', label: 'Antebraço', unit: 'cm', min: 15, max: 55, decimals: 1 },
  { key: 'thigh', group: 'tape', label: 'Coxa', unit: 'cm', min: 30, max: 110, decimals: 1 },
  { key: 'calf', group: 'tape', label: 'Panturrilha', unit: 'cm', min: 20, max: 70, decimals: 1 },
  { key: 'bodyFat', group: 'composition', label: 'Gordura corporal', unit: '%', min: 2, max: 70, decimals: 1 },
  { key: 'muscle', group: 'composition', label: 'Massa muscular', unit: 'kg', min: 10, max: 120, decimals: 1 },
  { key: 'visceral', group: 'composition', label: 'Gordura visceral', unit: 'nível', min: 1, max: 60, decimals: 0 },
  { key: 'water', group: 'composition', label: 'Água corporal', unit: '%', min: 20, max: 80, decimals: 1 },
] as const

export type BodyMeasureKey = (typeof BODY_MEASURES)[number]['key']

export const measurementSchema = z.object({
  date: isoDate,
  key: z.enum(BODY_MEASURES.map((m) => m.key) as [BodyMeasureKey, ...BodyMeasureKey[]]),
  value: z.number(),
})

export type Measurement = z.infer<typeof measurementSchema>

/** The latest value of each measure, by date. */
export function latestMeasures(measures: readonly Measurement[]): Partial<Record<BodyMeasureKey, Measurement>> {
  const out: Partial<Record<BodyMeasureKey, Measurement>> = {}
  for (const m of measures) if (!out[m.key] || m.date > out[m.key]!.date) out[m.key] = m
  return out
}

export type Risk = 'normal' | 'attention' | 'high'

/** Waist to hip: from 0.90 for men and 0.85 for women the risk rises (WHO). */
export function waistHipRisk(ratio: number | null, sex: Sex | null): Risk | null {
  if (ratio === null || !sex) return null
  const limit = sex === 'm' ? 0.9 : 0.85
  return ratio >= limit + 0.05 ? 'high' : ratio >= limit ? 'attention' : 'normal'
}

/** Waist to height: under 0.5 is the usual healthy mark, for anyone. */
export function waistHeightRisk(ratio: number | null): Risk | null {
  if (ratio === null) return null
  return ratio >= 0.6 ? 'high' : ratio >= 0.5 ? 'attention' : 'normal'
}

/** Waist alone: 94/80 cm attention, 102/88 cm high (men/women, IDF and WHO). */
export function waistRisk(cm: number | null, sex: Sex | null): Risk | null {
  if (cm === null || !sex) return null
  const [attention, high] = sex === 'm' ? [94, 102] : [80, 88]
  return cm >= high ? 'high' : cm >= attention ? 'attention' : 'normal'
}

export interface ProfileFacts {
  age: number | null
  weight: WeightEntry | null
  bmi: number | null
  bmiBand: BmiBand | null
  resting: number | null
  /** How resting energy was worked out: from lean mass when body fat is known. */
  restingFrom: 'formula' | 'leanMass' | null
  daily: number | null
  kcal: number | null
  protein: number | null
  waterMl: number | null
  waterGlasses: number | null
  waist: number | null
  waistRisk: Risk | null
  waistHip: number | null
  waistHipRisk: Risk | null
  waistHeight: number | null
  waistHeightRisk: Risk | null
  /** Kilograms of fat and of everything else, when body fat is known. */
  fatMass: number | null
  leanMass: number | null
}

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places

/** Everything the app can work out from the person's data, for a given day. */
export function profileFacts(profile: Profile, weights: readonly WeightEntry[], today: string, measures: readonly Measurement[] = []): ProfileFacts {
  const age = ageOn(profile.birth, today)
  const weight = latestWeight(weights)
  const kg = weight?.kg ?? null
  const value = bmi(kg, profile.height)
  const latest = latestMeasures(measures.filter((m) => m.date <= today))
  const bodyFat = latest.bodyFat?.value ?? null
  const leanMass = kg && bodyFat !== null ? round(kg * (1 - bodyFat / 100), 1) : null
  // With body fat known, Katch–McArdle (lean mass) is closer than a formula by weight.
  const resting = leanMass !== null ? Math.round(370 + 21.6 * leanMass) : restingEnergy({ sex: profile.sex, age, kg, cm: profile.height })
  const daily = dailyEnergy(resting, profile.activity, profile.days)
  const waterMl = waterTarget(kg)
  const waist = latest.waist?.value ?? null
  const hip = latest.hip?.value ?? null
  const waistHip = waist && hip ? round(waist / hip) : null
  const waistHeight = waist && profile.height ? round(waist / profile.height) : null
  return {
    age,
    weight,
    bmi: value,
    bmiBand: bmiBand(value),
    resting,
    restingFrom: resting === null ? null : leanMass !== null ? 'leanMass' : 'formula',
    daily,
    kcal: calorieTarget(daily, profile.goal),
    protein: proteinTarget(kg, profile.goal),
    waterMl,
    waterGlasses: waterMl === null ? null : Math.ceil(waterMl / GLASS_ML),
    waist,
    waistRisk: waistRisk(waist, profile.sex),
    waistHip,
    waistHipRisk: waistHipRisk(waistHip, profile.sex),
    waistHeight,
    waistHeightRisk: waistHeightRisk(waistHeight),
    fatMass: kg && bodyFat !== null ? round(kg - leanMass!, 1) : null,
    leanMass,
  }
}
