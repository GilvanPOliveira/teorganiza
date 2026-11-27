import type { PlannedSet, Routine, RoutineItem } from './schema'

/**
 * Ready-made plans, built from widely known training splits. Each one is
 * loaded as ordinary routines the user then edits freely.
 */
export interface Template {
  id: string
  name: string
  description: string
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
]
