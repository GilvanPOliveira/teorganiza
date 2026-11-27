import { BACK, FRONT } from './body-paths'
import type { Muscle } from './catalog'

/** Which shapes of the body drawing stand for each muscle group of the library. */
const SHAPES: Record<Muscle, string[]> = {
  peito: ['chest'],
  costas: ['upperBack', 'rhomboids'],
  ombros: ['deltoids', 'rotatorCuff'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  antebraco: ['forearm'],
  abdomen: ['abs', 'obliques', 'serratus'],
  lombar: ['lowerBack'],
  trapezio: ['trapezius'],
  quadriceps: ['quadriceps', 'hipFlexors'],
  posterior: ['hamstring'],
  gluteos: ['gluteal'],
  panturrilha: ['calves', 'tibialis'],
  adutores: ['adductors'],
  cardio: [],
  corpo: [],
}

/** Body parts that are not muscles: drawn as the figure, never lit. */
const FIGURE = new Set(['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles'])

const ALL_MUSCLES = Object.values(SHAPES).flat()

export function shapesFor(muscles: Muscle[]): Set<string> {
  if (muscles.includes('corpo')) return new Set(ALL_MUSCLES)
  return new Set(muscles.flatMap((m) => SHAPES[m]))
}

function View({
  view,
  primary,
  secondary,
  label,
  onPick,
}: {
  view: typeof FRONT
  primary: Set<string>
  secondary: Set<string>
  label: string
  onPick?: (shape: string) => void
}) {
  return (
    <svg className="to-bodymap__view" viewBox={view.viewBox} role="img" aria-label={label}>
      {Object.entries(view.parts).map(([shape, paths]) => {
        const tone = FIGURE.has(shape) ? 'figure' : primary.has(shape) ? 'primary' : secondary.has(shape) ? 'secondary' : 'idle'
        return (
          <g
            key={shape}
            className={`to-bodymap__part is-${tone}${onPick && !FIGURE.has(shape) ? ' is-pickable' : ''}`}
            onClick={onPick && !FIGURE.has(shape) ? () => onPick(shape) : undefined}
          >
            {paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * The body, front and back, with the worked muscles lit: strong for the
 * main ones, soft for the ones that help. Small on cards, larger in the
 * library, where tapping a muscle filters by it.
 */
export function BodyMap({
  primary,
  secondary = [],
  size = 'small',
  onPickMuscle,
}: {
  primary: Muscle[]
  secondary?: Muscle[]
  size?: 'tiny' | 'small' | 'large'
  onPickMuscle?: (muscle: Muscle) => void
}) {
  const main = shapesFor(primary)
  const help = shapesFor(secondary)
  const pick = onPickMuscle
    ? (shape: string) => {
        const muscle = (Object.keys(SHAPES) as Muscle[]).find((m) => SHAPES[m].includes(shape))
        if (muscle) onPickMuscle(muscle)
      }
    : undefined
  return (
    <div className={`to-bodymap to-bodymap--${size}`}>
      <View view={FRONT} primary={main} secondary={help} label="Frente" onPick={pick} />
      <View view={BACK} primary={main} secondary={help} label="Costas" onPick={pick} />
    </div>
  )
}
