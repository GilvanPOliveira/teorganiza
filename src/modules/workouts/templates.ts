import type { Goal, Level, Place, Profile, Restriction } from '@core/api'
import type { ExerciseDef } from './catalog'
import { flagsFor, heavySets, NO_GUIDANCE, substituteFor, type Guidance } from './guidance'
import type { PlannedSet, Routine, RoutineItem } from './schema'

/**
 * Ready-made plans, built from widely known training splits. Each one is
 * loaded as ordinary routines the user then edits freely.
 */
export interface Template {
  id: string
  name: string
  description: string
  /** Training days a week the plan asks for. */
  days: number
  /** Who it suits, matched against Meus dados. */
  levels: Level[]
  place: Place
  goals: Goal[]
  /** Suggested weekdays, one per routine (0 = Sunday). */
  routines: Omit<Routine, 'order'>[]
}

const work = (count: number, reps: number, repsMax: number | null = null): PlannedSet[] =>
  Array.from({ length: count }, () => ({ type: 'normal' as const, reps, repsMax, seconds: null }))

const timed = (count: number, seconds: number): PlannedSet[] =>
  Array.from({ length: count }, () => ({ type: 'normal' as const, reps: null, repsMax: null, seconds }))

const item = (exerciseId: string, sets: PlannedSet[], rest = 90): RoutineItem => ({
  exerciseId,
  sets,
  rest,
  superset: null,
  note: '',
})

export const TEMPLATES: Template[] = [
  {
    id: 'ppl',
    days: 3,
    levels: ['intermediate', 'advanced'],
    place: 'gym',
    goals: ['gain', 'strength'],
    name: 'Push / Pull / Legs',
    description: 'Empurrar, puxar e pernas em três dias. Para quem treina 3 ou 6 vezes por semana.',
    routines: [
      {
        name: 'Push — peito, ombros e tríceps',
        weekday: 1,
        items: [
          item('supino-reto-barra', work(4, 6, 8), 150),
          item('supino-inclinado-halteres', work(3, 8, 12), 120),
          item('desenvolvimento-halteres', work(3, 8, 12), 120),
          item('elevacao-lateral', work(3, 12, 15), 60),
          item('triceps-corda', work(3, 10, 15), 60),
        ],
      },
      {
        name: 'Pull — costas e bíceps',
        weekday: 3,
        items: [
          item('levantamento-terra', work(3, 5), 180),
          item('puxada-frente', work(3, 8, 12), 120),
          item('remada-baixa', work(3, 8, 12), 120),
          item('face-pull', work(3, 12, 15), 60),
          item('rosca-direta', work(3, 8, 12), 60),
        ],
      },
      {
        name: 'Legs — pernas',
        weekday: 5,
        items: [
          item('agachamento-livre', work(4, 6, 8), 180),
          item('terra-romeno', work(3, 8, 10), 150),
          item('leg-press', work(3, 10, 15), 120),
          item('mesa-flexora', work(3, 10, 15), 60),
          item('panturrilha-pe', work(4, 10, 15), 60),
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    days: 4,
    levels: ['intermediate', 'advanced'],
    place: 'gym',
    goals: ['gain', 'strength', 'lose', 'health'],
    name: 'Superior / Inferior',
    description: 'Parte de cima e parte de baixo, alternadas em quatro dias por semana.',
    routines: [
      {
        name: 'Superior A',
        weekday: 1,
        items: [
          item('supino-reto-barra', work(4, 6, 8), 150),
          item('remada-curvada', work(4, 6, 8), 150),
          item('desenvolvimento-halteres', work(3, 8, 12), 90),
          item('puxada-frente', work(3, 8, 12), 90),
          item('rosca-alternada', work(2, 10, 12), 60),
          item('triceps-polia', work(2, 10, 12), 60),
        ],
      },
      {
        name: 'Inferior A',
        weekday: 2,
        items: [
          item('agachamento-livre', work(4, 6, 8), 180),
          item('terra-romeno', work(3, 8, 10), 150),
          item('afundo', work(3, 10), 90),
          item('panturrilha-pe', work(4, 12, 15), 60),
          item('prancha', timed(3, 45), 60),
        ],
      },
      {
        name: 'Superior B',
        weekday: 4,
        items: [
          item('supino-inclinado-halteres', work(4, 8, 10), 120),
          item('barra-fixa', work(4, 6, 10), 120),
          item('desenvolvimento-barra', work(3, 6, 8), 120),
          item('remada-unilateral', work(3, 8, 12), 90),
          item('elevacao-lateral', work(3, 12, 15), 60),
          item('triceps-corda', work(2, 10, 15), 60),
        ],
      },
      {
        name: 'Inferior B',
        weekday: 5,
        items: [
          item('levantamento-terra', work(3, 5), 180),
          item('leg-press', work(3, 10, 12), 120),
          item('cadeira-flexora', work(3, 10, 15), 60),
          item('elevacao-pelvica', work(3, 8, 12), 90),
          item('panturrilha-sentado', work(3, 12, 15), 60),
        ],
      },
    ],
  },
  {
    id: 'full-body',
    days: 3,
    levels: ['beginner', 'intermediate'],
    place: 'gym',
    goals: ['health', 'lose', 'gain'],
    name: 'Corpo inteiro',
    description: 'O corpo todo em cada treino, três vezes por semana. Bom para começar.',
    routines: [
      {
        name: 'Corpo inteiro A',
        weekday: 1,
        items: [
          item('agachamento-livre', work(3, 8, 10), 150),
          item('supino-reto-barra', work(3, 8, 10), 120),
          item('remada-curvada', work(3, 8, 10), 120),
          item('elevacao-lateral', work(2, 12, 15), 60),
          item('prancha', timed(3, 30), 60),
        ],
      },
      {
        name: 'Corpo inteiro B',
        weekday: 3,
        items: [
          item('terra-romeno', work(3, 8, 10), 150),
          item('desenvolvimento-halteres', work(3, 8, 10), 120),
          item('puxada-frente', work(3, 8, 10), 120),
          item('afundo', work(2, 10), 90),
          item('rosca-martelo', work(2, 10, 12), 60),
        ],
      },
      {
        name: 'Corpo inteiro C',
        weekday: 5,
        items: [
          item('leg-press', work(3, 10, 12), 120),
          item('supino-inclinado-halteres', work(3, 8, 12), 120),
          item('remada-baixa', work(3, 10, 12), 90),
          item('triceps-corda', work(2, 10, 15), 60),
          item('elevacao-pernas', work(3, 12), 60),
        ],
      },
    ],
  },
  {
    id: '5x5',
    days: 2,
    levels: ['beginner', 'intermediate'],
    place: 'gym',
    goals: ['strength', 'gain'],
    name: '5×5 de força',
    description: 'Dois treinos alternados, cinco séries de cinco nos levantamentos básicos. Suba a carga quando completar todas as séries.',
    routines: [
      {
        name: '5×5 — Treino A',
        weekday: 1,
        items: [
          item('agachamento-livre', work(5, 5), 180),
          item('supino-reto-barra', work(5, 5), 180),
          item('remada-curvada', work(5, 5), 180),
        ],
      },
      {
        name: '5×5 — Treino B',
        weekday: 3,
        items: [
          item('agachamento-livre', work(5, 5), 180),
          item('desenvolvimento-barra', work(5, 5), 180),
          item('levantamento-terra', work(1, 5), 180),
        ],
      },
    ],
  },
  {
    id: 'abc',
    days: 3,
    levels: ['intermediate'],
    place: 'gym',
    goals: ['gain', 'health'],
    name: 'ABC clássico',
    description: 'Três treinos por grupos: peito e tríceps, costas e bíceps, pernas e ombros. O mais comum nas academias.',
    routines: [
      {
        name: 'A — peito e tríceps',
        weekday: 1,
        items: [
          item('supino-reto-barra', work(4, 8, 10), 120),
          item('supino-inclinado-halteres', work(3, 8, 12), 90),
          item('crucifixo-maquina', work(3, 12, 15), 60),
          item('triceps-polia', work(3, 10, 12), 60),
          item('triceps-frances', work(3, 10, 12), 60),
        ],
      },
      {
        name: 'B — costas e bíceps',
        weekday: 3,
        items: [
          item('puxada-frente', work(4, 8, 10), 120),
          item('remada-curvada', work(3, 8, 10), 120),
          item('remada-unilateral', work(3, 10, 12), 90),
          item('rosca-direta', work(3, 8, 12), 60),
          item('rosca-martelo', work(3, 10, 12), 60),
        ],
      },
      {
        name: 'C — pernas e ombros',
        weekday: 5,
        items: [
          item('agachamento-livre', work(4, 8, 10), 150),
          item('leg-press', work(3, 10, 12), 120),
          item('cadeira-flexora', work(3, 10, 12), 60),
          item('desenvolvimento-halteres', work(3, 8, 12), 90),
          item('elevacao-lateral', work(3, 12, 15), 60),
        ],
      },
    ],
  },
  {
    id: 'casa',
    days: 3,
    levels: ['beginner', 'intermediate'],
    place: 'home',
    goals: ['lose', 'health'],
    name: 'Em casa, sem equipamento',
    description: 'Só o peso do corpo, três vezes por semana. Para treinar em casa, no hotel ou no parque.',
    routines: [
      {
        name: 'Casa — empurrar e core',
        weekday: 1,
        items: [item('flexao', work(4, 8, 15), 60), item('mergulho-banco', work(3, 10, 15), 60), item('prancha', timed(3, 40), 45), item('mountain-climber', timed(3, 30), 45)],
      },
      {
        name: 'Casa — pernas',
        weekday: 3,
        items: [
          item('agachamento-livre-corpo', work(4, 15, 20), 60),
          item('afundo', work(3, 10, 12), 60),
          item('ponte-gluteos', work(3, 15, 20), 45),
          item('panturrilha-unilateral', work(3, 15, 20), 45),
        ],
      },
      {
        name: 'Casa — corpo todo',
        weekday: 5,
        items: [
          item('burpee', work(4, 10), 60),
          item('flexao-inclinada', work(3, 12, 15), 60),
          item('agachamento-livre-corpo', work(3, 20), 60),
          item('dead-bug', work(3, 10, 12), 45),
          item('polichinelo', timed(3, 45), 30),
        ],
      },
    ],
  },
  {
    id: 'iniciante-2x',
    days: 2,
    levels: ['beginner'],
    place: 'gym',
    goals: ['health', 'lose'],
    name: 'Iniciante 2× por semana',
    description: 'Dois treinos curtos em máquinas, fáceis de aprender. Para quem está começando ou tem pouco tempo.',
    routines: [
      {
        name: 'Iniciante A',
        weekday: 2,
        items: [
          item('leg-press', work(3, 12), 90),
          item('supino-maquina', work(3, 12), 90),
          item('puxada-frente', work(3, 12), 90),
          item('cadeira-extensora', work(2, 12, 15), 60),
          item('prancha', timed(3, 20), 45),
        ],
      },
      {
        name: 'Iniciante B',
        weekday: 4,
        items: [
          item('agachamento-goblet', work(3, 12), 90),
          item('remada-maquina', work(3, 12), 90),
          item('desenvolvimento-maquina', work(3, 12), 90),
          item('mesa-flexora', work(2, 12, 15), 60),
          item('abdominal', work(3, 15), 45),
        ],
      },
    ],
  },
  {
    id: 'gluteos-pernas',
    days: 3,
    levels: ['beginner', 'intermediate'],
    place: 'gym',
    goals: ['gain', 'lose', 'health'],
    name: 'Ênfase em glúteos e pernas',
    description: 'Dois dias de membros inferiores e um de superiores, três vezes por semana.',
    routines: [
      {
        name: 'Glúteos e posterior',
        weekday: 1,
        items: [
          item('elevacao-pelvica', work(4, 8, 12), 120),
          item('stiff', work(3, 8, 10), 120),
          item('agachamento-bulgaro', work(3, 10, 12), 90),
          item('abducao-maquina', work(3, 15, 20), 60),
          item('gluteo-cabo', work(3, 12, 15), 60),
        ],
      },
      {
        name: 'Superiores',
        weekday: 3,
        items: [
          item('puxada-frente', work(3, 10, 12), 90),
          item('supino-reto-halteres', work(3, 10, 12), 90),
          item('remada-baixa', work(3, 10, 12), 90),
          item('elevacao-lateral', work(3, 12, 15), 60),
          item('prancha', timed(3, 30), 45),
        ],
      },
      {
        name: 'Quadríceps e glúteos',
        weekday: 5,
        items: [
          item('agachamento-livre', work(4, 8, 10), 150),
          item('leg-press', work(3, 10, 15), 120),
          item('passada', work(3, 12), 90),
          item('cadeira-extensora', work(3, 12, 15), 60),
          item('panturrilha-pe', work(3, 12, 15), 60),
        ],
      },
    ],
  },
  {
    id: 'abcd',
    days: 4,
    levels: ['intermediate', 'advanced'],
    place: 'gym',
    goals: ['gain'],
    name: 'ABCD em quatro dias',
    description: 'Um grupo grande por dia, quatro vezes por semana. Mais volume para quem já treina há algum tempo.',
    routines: [
      {
        name: 'A — peito',
        weekday: 1,
        items: [
          item('supino-reto-barra', work(4, 6, 8), 150),
          item('supino-inclinado-barra', work(3, 8, 10), 120),
          item('crossover', work(3, 12, 15), 60),
          item('mergulho-paralelas', work(3, 8, 12), 90),
        ],
      },
      {
        name: 'B — costas',
        weekday: 2,
        items: [
          item('barra-fixa', work(4, 6, 10), 120),
          item('remada-cavalinho', work(3, 8, 10), 120),
          item('puxada-triangulo', work(3, 10, 12), 90),
          item('pulldown-braco-reto', work(3, 12, 15), 60),
          item('encolhimento', work(3, 12, 15), 60),
        ],
      },
      {
        name: 'C — pernas',
        weekday: 4,
        items: [
          item('agachamento-livre', work(4, 6, 8), 180),
          item('hack', work(3, 8, 12), 120),
          item('terra-romeno', work(3, 8, 10), 150),
          item('cadeira-extensora', work(3, 12, 15), 60),
          item('panturrilha-sentado', work(4, 12, 15), 60),
        ],
      },
      {
        name: 'D — ombros e braços',
        weekday: 5,
        items: [
          item('desenvolvimento-barra', work(4, 6, 8), 150),
          item('elevacao-lateral-cabo', work(3, 12, 15), 60),
          item('crucifixo-inverso', work(3, 12, 15), 60),
          item('rosca-ez', work(3, 8, 12), 60),
          item('triceps-testa', work(3, 8, 12), 60),
        ],
      },
    ],
  },
]

export interface TemplateFit {
  score: number
  /** What matched, in the order a person would say it. */
  reasons: ('days' | 'level' | 'place' | 'goal')[]
  /** Exercises the person's restrictions touch, per restriction. */
  warnings: { restriction: Restriction; avoid: number; caution: number }[]
  /** Heavy sets (5 reps or fewer) when blood pressure is high. */
  heavy: number
}

type FitProfile = Pick<Profile, 'days' | 'level' | 'place' | 'goal'>

/**
 * How well a plan suits the person, from Meus dados. Where you train weighs
 * most (a gym plan is no use at home), then the days you have, then level
 * and goal. Restrictions take points off for every exercise they touch,
 * high pressure for heavy sets, and from 60 on a beginner-friendly plan
 * gets a point. Blank fields neither help nor hurt.
 */
export function templateFit(template: Template, profile: FitProfile, guidance: Guidance = NO_GUIDANCE): TemplateFit {
  let score = 0
  const reasons: TemplateFit['reasons'] = []
  if (profile.place) {
    if (profile.place === template.place) {
      score += 3
      reasons.push('place')
    } else score -= 4
  }
  if (profile.days) {
    const gap = template.days - profile.days
    if (gap === 0) {
      score += 3
      reasons.push('days')
    } else if (gap < 0) score += gap === -1 ? 1 : 0
    else score -= 2 * gap
  }
  if (profile.level) {
    if (template.levels.includes(profile.level)) {
      score += 2
      reasons.push('level')
    } else score -= 1
  }
  if (profile.goal && template.goals.includes(profile.goal)) {
    score += 2
    reasons.push('goal')
  }
  if (guidance.senior && template.levels.includes('beginner')) score += 1

  const counts = new Map<Restriction, { avoid: number; caution: number }>()
  const items = template.routines.flatMap((r) => r.items)
  for (const item of items) {
    for (const flag of flagsFor(item.exerciseId, guidance)) {
      const c = counts.get(flag.restriction) ?? { avoid: 0, caution: 0 }
      c[flag.level]++
      counts.set(flag.restriction, c)
    }
  }
  for (const c of counts.values()) score -= c.avoid * 1.5 + c.caution * 0.5
  const heavy = guidance.restrictions.has('hypertension') ? items.reduce((n, item) => n + heavySets(item.sets), 0) : 0
  if (heavy) score -= 3
  return {
    score,
    reasons,
    warnings: [...counts].map(([restriction, c]) => ({ restriction, ...c })),
    heavy,
  }
}

/** The plans, best fit first; ties keep their usual order. */
export function rankTemplates(templates: Template[], profile: FitProfile, guidance: Guidance = NO_GUIDANCE) {
  return templates
    .map((template, i) => ({
      template,
      fit: templateFit(template, profile, guidance),
      i,
    }))
    .sort((a, b) => b.fit.score - a.fit.score || a.i - b.i)
}

export interface Adapted {
  routines: Omit<Routine, 'order'>[]
  swaps: { from: string; to: string }[]
  /** Heavy sets turned into moderate ones, for high blood pressure. */
  lightened: number
}

/**
 * The plan as it will be loaded for this person: every exercise to avoid
 * swapped for a safer one for the same muscle (dropped when there is
 * none), and with high blood pressure, sets of 5 or fewer turned into 8–10.
 */
export function adaptTemplate(template: Template, guidance: Guidance, catalog: readonly ExerciseDef[], place: Place = template.place): Adapted {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const swaps: Adapted['swaps'] = []
  let lightened = 0
  const lighten = guidance.restrictions.has('hypertension')
  const routines = template.routines.map((routine) => {
    const used = new Set(routine.items.map((i) => i.exerciseId))
    const items: RoutineItem[] = []
    for (const item of routine.items) {
      let next = item
      const exercise = item.exerciseId ? byId.get(item.exerciseId) : undefined
      if (exercise && flagsFor(exercise.id, guidance).some((f) => f.level === 'avoid')) {
        const pool = catalog.filter((e) => !used.has(e.id))
        const sub = substituteFor(exercise, pool, guidance, place)
        if (!sub) {
          swaps.push({ from: exercise.id, to: '' })
          continue
        }
        swaps.push({ from: exercise.id, to: sub.id })
        used.add(sub.id)
        next = { ...item, exerciseId: sub.id }
      }
      if (lighten && heavySets(next.sets)) {
        lightened += heavySets(next.sets)
        next = {
          ...next,
          sets: next.sets.map((set) => (set.reps !== null && set.reps <= 5 ? { ...set, reps: 8, repsMax: 10 } : set)),
        }
      }
      items.push(next)
    }
    return { ...routine, items }
  })
  return { routines, swaps, lightened }
}
