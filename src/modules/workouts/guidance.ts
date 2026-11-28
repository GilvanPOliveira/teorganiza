import type { Place, ProfileFacts, Restriction, Signal, SignalKey } from '@core/api'
import type { ExerciseDef } from './catalog'

/**
 * What Meus dados, Exames, the day and Refeições say about training, as
 * fixed rules, never guesses. Each restriction lists the exercises to
 * avoid (swapped out when a plan is loaded) and the ones to do with care
 * (kept, marked). The lists name catalog ids, so a rule is easy to read
 * and to argue with.
 */

interface Rule {
  avoid: string[]
  caution: string[]
}

export const RULES: Record<Restriction, Rule> = {
  knee: {
    avoid: ['agachamento-bulgaro', 'afundo', 'passada', 'sissy', 'step-up', 'agachamento-frontal', 'burpee', 'pular-corda', 'polichinelo', 'corrida-rua', 'corrida-esteira', 'thruster'],
    caution: ['agachamento-livre', 'agachamento-smith', 'agachamento-goblet', 'agachamento-livre-corpo', 'agachamento-sumo', 'hack', 'leg-press', 'cadeira-extensora', 'nordico', 'escada'],
  },
  back: {
    avoid: ['levantamento-terra', 'good-morning', 'remada-curvada', 'stiff', 'clean', 'snatch-halter', 'remada-cavalinho', 'kettlebell-swing', 'russian-twist'],
    caution: [
      'agachamento-livre',
      'agachamento-frontal',
      'terra-romeno',
      'stiff-halteres',
      'desenvolvimento-barra',
      'thruster',
      'hiperextensao',
      'leg-press',
      'hack',
      'roda-abdominal',
      'elevacao-pernas-barra',
    ],
  },
  shoulder: {
    avoid: ['desenvolvimento-barra', 'mergulho-paralelas', 'remada-alta', 'snatch-halter', 'pullover-halter', 'arnold', 'supino-declinado-barra'],
    caution: [
      'desenvolvimento-halteres',
      'desenvolvimento-maquina',
      'supino-reto-barra',
      'supino-inclinado-barra',
      'supino-inclinado-halteres',
      'elevacao-lateral',
      'elevacao-lateral-cabo',
      'elevacao-frontal',
      'barra-fixa',
      'barra-fixa-supinada',
      'mergulho-banco',
      'crucifixo-halteres',
      'triceps-frances',
      'turkish-getup',
      'clean',
      'pendurar-barra',
    ],
  },
  wrist: {
    avoid: ['rosca-punho', 'rosca-punho-inversa', 'flexao', 'mergulho-banco', 'clean'],
    caution: [
      'supino-reto-barra',
      'rosca-direta',
      'rosca-inversa',
      'flexao-inclinada',
      'burpee',
      'prancha',
      'mountain-climber',
      'agachamento-frontal',
      'triceps-testa',
      'farmer-walk',
      'pendurar-barra',
      'roda-abdominal',
    ],
  },
  hypertension: {
    // Breath-holding under heavy load and long static holds push pressure up the most.
    avoid: ['levantamento-terra', 'clean', 'snatch-halter', 'leg-press'],
    caution: ['agachamento-livre', 'agachamento-frontal', 'supino-reto-barra', 'desenvolvimento-barra', 'prancha', 'prancha-lateral', 'hack', 'elevacao-pernas-barra'],
  },
  pregnancy: {
    avoid: [
      'abdominal',
      'abdominal-cabo',
      'abdominal-maquina',
      'russian-twist',
      'roda-abdominal',
      'bicicleta',
      'elevacao-pernas',
      'elevacao-pernas-barra',
      'burpee',
      'pular-corda',
      'corrida-rua',
      'levantamento-terra',
      'clean',
      'snatch-halter',
      'thruster',
      'mountain-climber',
      'supino-declinado-barra',
    ],
    caution: ['supino-reto-barra', 'supino-reto-halteres', 'supino-inclinado-barra', 'agachamento-livre', 'prancha', 'dead-bug', 'stiff', 'terra-romeno'],
  },
  noImpact: {
    avoid: ['burpee', 'pular-corda', 'polichinelo', 'corrida-rua', 'corrida-esteira', 'mountain-climber', 'thruster'],
    caution: ['step-up', 'escada', 'kettlebell-swing'],
  },
}

/** Where a restriction came from, so the screen can say why. */
export type Source = 'profile' | 'bmi' | 'pressure'

export interface Guidance {
  restrictions: Map<Restriction, Source>
  /** 60 or older: simpler, machine-based plans first. */
  senior: boolean
  /** Blood sugar at or above 100 fasting. */
  highGlucose: boolean
  /** Readings behind the derived restrictions, to show. */
  pressure: Signal | null
}

/**
 * Pulls together the profile (marked restrictions, BMI, age) and the
 * readings other modules offer (blood pressure, glucose).
 */
export function buildGuidance(flags: readonly Restriction[], facts: Pick<ProfileFacts, 'age' | 'bmi'>, signals: Partial<Record<SignalKey, Signal>>): Guidance {
  const restrictions = new Map<Restriction, Source>()
  for (const flag of flags) restrictions.set(flag, 'profile')
  if (facts.bmi !== null && facts.bmi >= 30 && !restrictions.has('noImpact')) restrictions.set('noImpact', 'bmi')
  const pressure = signals.bloodPressure ?? null
  if (pressure && (pressure.value >= 140 || (pressure.value2 ?? 0) >= 90) && !restrictions.has('hypertension')) restrictions.set('hypertension', 'pressure')
  return {
    restrictions,
    senior: facts.age !== null && facts.age >= 60,
    highGlucose: (signals.glucose?.value ?? 0) >= 100,
    pressure,
  }
}

export const NO_GUIDANCE: Guidance = {
  restrictions: new Map(),
  senior: false,
  highGlucose: false,
  pressure: null,
}

export interface ExerciseFlag {
  restriction: Restriction
  level: 'avoid' | 'caution'
}

/** Why an exercise needs care for this person; avoid comes first. */
export function flagsFor(exerciseId: string | null, guidance: Guidance): ExerciseFlag[] {
  if (!exerciseId) return []
  const out: ExerciseFlag[] = []
  for (const restriction of guidance.restrictions.keys()) {
    const rule = RULES[restriction]
    if (rule.avoid.includes(exerciseId)) out.push({ restriction, level: 'avoid' })
    else if (rule.caution.includes(exerciseId)) out.push({ restriction, level: 'caution' })
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'avoid' ? -1 : 1))
}

const HOME_GEAR = new Set(['peso-corporal', 'nenhum', 'halteres', 'elastico', 'kettlebell'])
/** No gear, but not something to do at home either. */
const NOT_AT_HOME = new Set(['natacao'])
/**
 * Hand-picked replacements, tried first: conditioning moves have no
 * same-muscle twin, and the scoring alone picks technical lifts for them.
 */
const PREFERRED: Record<string, string[]> = {
  burpee: ['bicicleta-ergometrica', 'agachamento-livre-corpo'],
  polichinelo: ['caminhada-esteira', 'agachamento-livre-corpo'],
  'pular-corda': ['bicicleta-ergometrica', 'caminhada-esteira'],
  'corrida-rua': ['caminhada-esteira', 'bicicleta-ergometrica', 'eliptico'],
  'corrida-esteira': ['caminhada-esteira', 'eliptico', 'bicicleta-ergometrica'],
  thruster: ['agachamento-goblet', 'leg-press'],
  'mountain-climber': ['prancha', 'dead-bug'],
}
/** Never picked as a replacement: too technical to learn on the spot. */
const NOT_A_SUBSTITUTE = new Set(['turkish-getup', 'clean', 'snatch-halter'])
/** "Remada curvada" and "Remada na máquina" are the same movement; a "Puxada" is not. */
const movement = (e: ExerciseDef) => e.name.split(' ')[0].toLowerCase()

/**
 * A safer exercise for the same muscle: none of the person's restrictions
 * says to avoid it, and one with no warning at all beats one to do with
 * care (for a bad knee every quadriceps exercise needs some care). Then the
 * same kind of set (load, reps, time); at home only home gear, in the gym
 * a machine or cable first (guided, easier on joints).
 */
export function substituteFor(exercise: ExerciseDef, catalog: readonly ExerciseDef[], guidance: Guidance, place: Place): ExerciseDef | null {
  const allowed = (other: ExerciseDef) =>
    !flagsFor(other.id, guidance).some((f) => f.level === 'avoid') && (place === 'gym' || (HOME_GEAR.has(other.equipment) && !NOT_AT_HOME.has(other.id)))
  for (const id of PREFERRED[exercise.id] ?? []) {
    const pick = catalog.find((e) => e.id === id)
    if (pick && allowed(pick)) return pick
  }
  const candidates = catalog.filter(
    (other) =>
      other.id !== exercise.id &&
      !other.custom &&
      !NOT_A_SUBSTITUTE.has(other.id) &&
      (other.muscle === exercise.muscle || (exercise.muscle === 'corpo' && other.muscle === 'cardio') || (exercise.muscle === 'cardio' && other.muscle === 'cardio')) &&
      allowed(other),
  )
  const score = (other: ExerciseDef) =>
    (flagsFor(other.id, guidance).length === 0 ? 6 : 0) +
    (movement(other) === movement(exercise) ? 3 : 0) +
    (other.kind === exercise.kind ? 4 : 0) +
    (other.compound === exercise.compound ? 2 : 0) +
    (place === 'gym' && (other.equipment === 'maquina' || other.equipment === 'cabo') ? 2 : 0) +
    (other.equipment === exercise.equipment ? 1 : 0) +
    (other.perSide === exercise.perSide ? 1 : 0)
  return candidates.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'pt-BR'))[0] ?? null
}

/** Sets heavy enough (5 reps or fewer) to hold the breath on. */
export function heavySets(sets: readonly { reps: number | null }[]): number {
  return sets.filter((s) => s.reps !== null && s.reps <= 5).length
}
