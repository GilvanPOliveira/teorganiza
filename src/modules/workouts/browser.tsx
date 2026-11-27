import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Accessibility, Check, ChevronUp, Star, X } from 'lucide-react'
import { useT } from '@core/api'
import { BodyMap } from './BodyMap'
import { equipmentLabel, muscleLabel, type ExerciseDef, type Muscle } from './catalog'
import { useExerciseIndex, useSessions, useTrainingSettings, withIds } from './data'
import { CustomTools, ExerciseDetail, FavoriteButton } from './detail'
import { fmt, Stepper } from './inputs'
import { clock, lastEntry, planFor, type ExercisePlan } from './logic'
import { ExerciseMedia } from './media'
import { EMPTY_FILTER, ExerciseFilters, filterExercises, type ExerciseFilter } from './picker'

export const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]
/** Monday first, as a training week is planned. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const SHORT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** What the open card's button does: register in the plan, add to a workout or a routine, or swap. */
export interface BrowserAction {
  label: string
  /** Ask for the weekdays it is done on (registering in the plan). */
  withDays: boolean
  /** Stay on the list after the button, to do several in a row. */
  keepOpen: boolean
  onAdd: (exercise: ExerciseDef, plan: ExercisePlan) => void
  /** The weekdays an exercise is already on, so the card starts from them. */
  daysOf?: (exerciseId: string) => number[]
}

/* ------------------------------------------------------------------ *
 * Weight, sets, reps, rest, days
 * ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="to-plan__field">
      <span>{label}</span>
      {children}
    </div>
  )
}

function PlanFields({ exercise, plan, withDays, onChange }: { exercise: ExerciseDef; plan: ExercisePlan; withDays: boolean; onChange: (plan: ExercisePlan) => void }) {
  const t = useT()
  const [settings] = useTrainingSettings()
  const set = (patch: Partial<ExercisePlan>) => onChange({ ...plan, ...patch })
  const lifts = exercise.kind === 'weight' || exercise.kind === 'bodyweight'
  return (
    <>
      <div className="to-plan__fields">
        {lifts && (
          <Field label={t(exercise.kind === 'bodyweight' ? 'setup.extra' : 'setup.load')}>
            <Stepper value={plan.weight} step={settings.step} label={t('setup.load')} onCommit={(v) => set({ weight: v })} />
          </Field>
        )}
        {exercise.kind !== 'cardio' && (
          <Field label={t('setup.sets')}>
            <Stepper value={plan.sets} step={1} decimals={false} label={t('setup.sets')} onCommit={(v) => set({ sets: Math.max(1, v ?? 1) })} />
          </Field>
        )}
        {lifts && (
          <Field label={t(exercise.perSide ? 'setup.repsSide' : 'setup.reps')}>
            <Stepper value={plan.reps} step={1} decimals={false} label={t('setup.reps')} onCommit={(v) => set({ reps: v })} />
          </Field>
        )}
        {exercise.kind === 'time' && (
          <Field label={t('setup.seconds')}>
            <Stepper value={plan.seconds} step={5} decimals={false} label={t('setup.seconds')} onCommit={(v) => set({ seconds: v })} />
          </Field>
        )}
        {exercise.kind === 'cardio' && (
          <Field label={t('setup.minutes')}>
            <Stepper
              value={plan.seconds === null ? null : Math.round(plan.seconds / 60)}
              step={1}
              decimals={false}
              label={t('setup.minutes')}
              onCommit={(v) => set({ seconds: v === null ? null : v * 60 })}
            />
          </Field>
        )}
        {exercise.kind !== 'cardio' && (
          <Field label={t('setup.rest')}>
            <select className="to-field__input to-plan__select" value={plan.rest} aria-label={t('setup.rest')} onChange={(e) => set({ rest: Number(e.target.value) })}>
              {REST_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? t('entry.noRest') : clock(s)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {withDays && (
        <Field label={t('setup.days')}>
          <div className="to-plan__days" role="group" aria-label={t('setup.days')}>
            {WEEK_ORDER.map((day) => {
              const on = plan.days.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  className={`to-chip${on ? ' is-active' : ''}`}
                  aria-pressed={on}
                  onClick={() => set({ days: on ? plan.days.filter((d) => d !== day) : [...plan.days, day] })}
                >
                  {SHORT_DAYS[day]}
                </button>
              )
            })}
          </div>
        </Field>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * One exercise, enlarged in place
 * ------------------------------------------------------------------ */

function OpenCard({ exercise, action, onCollapse, onDone }: { exercise: ExerciseDef; action?: BrowserAction; onCollapse: () => void; onDone: () => void }) {
  const t = useT()
  const [settings] = useTrainingSettings()
  const sessions = withIds(useSessions()).filter((s) => s.finishedAt)
  const before = action?.daysOf?.(exercise.id) ?? []
  const [plan, setPlan] = useState<ExercisePlan>(() => planFor(exercise, sessions, settings.rest, before))
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  const last = lastEntry(sessions, { exerciseId: exercise.id, name: exercise.name })
  const work = last?.sets.filter((s) => s.type !== 'warmup') ?? []
  const lastText = work.length
    ? exercise.kind === 'time' || exercise.kind === 'cardio'
      ? `${work.length} × ${work[0].seconds ?? '—'} s`
      : `${work.length} × ${work[0].reps ?? '—'}${work[0].weight ? ` · ${fmt(work[0].weight)} kg` : ''}`
    : null
  // Registering with no day left takes the exercise off the plan.
  const removing = Boolean(action?.withDays && plan.days.length === 0 && before.length > 0)
  const blocked = Boolean(action?.withDays && plan.days.length === 0 && before.length === 0)

  return (
    <article ref={ref} className="to-excard is-open">
      <header className="to-excard__openhead">
        <strong>{exercise.name}</strong>
        <FavoriteButton exercise={exercise} />
        <button type="button" className="to-plainicon" aria-label={t('browser.collapse')} title={t('browser.collapse')} onClick={onCollapse}>
          <ChevronUp size={18} />
        </button>
      </header>
      <ExerciseDetail exercise={exercise}>
        {action && (
          <div className="to-plan">
            <PlanFields exercise={exercise} plan={plan} withDays={action.withDays} onChange={setPlan} />
            {lastText && <p className="to-muted to-plan__last">{t('setup.last', { sets: lastText })}</p>}
            {blocked && <p className="to-muted to-plan__last">{t('setup.pickDays')}</p>}
            <button
              type="button"
              className={`to-pill to-plan__add${removing ? ' to-pill--danger' : ''}`}
              disabled={blocked}
              onClick={() => {
                action.onAdd(exercise, plan)
                onDone()
              }}
            >
              {removing ? <X size={15} /> : <Check size={15} />}
              {removing ? t('setup.removeFromPlan') : before.length > 0 && action.withDays ? t('setup.update') : action.label}
            </button>
          </div>
        )}
      </ExerciseDetail>
      <CustomTools exercise={exercise} onRemoved={onCollapse} />
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * The list
 * ------------------------------------------------------------------ */

/**
 * The exercise list on the page itself, with a picture on each one.
 * Tapping an exercise enlarges it in place: the moving photo, how to do it,
 * the muscles and the fields to register it (weight, sets, reps, rest and,
 * in the plan, the days it is done on).
 */
export function ExerciseBrowser({
  title,
  action,
  onClose,
  startMuscle,
  toolbar,
}: {
  /** Shown as a panel with a close button when there is a title. */
  title?: string
  action?: BrowserAction
  onClose?: () => void
  /** Opens filtered to a muscle, as when swapping an exercise for a similar one. */
  startMuscle?: Muscle
  /** Extra buttons next to the count, such as the plan summary. */
  toolbar?: ReactNode
}) {
  const t = useT()
  const { all } = useExerciseIndex()
  const [settings] = useTrainingSettings()
  const [filter, setFilter] = useState<ExerciseFilter>(startMuscle ? { ...EMPTY_FILTER, muscle: startMuscle } : EMPTY_FILTER)
  const [byMuscle, setByMuscle] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const ref = useRef<HTMLElement>(null)
  const shown = useMemo(() => filterExercises(all, filter, settings.favorites).slice(0, 160), [all, filter, settings.favorites])

  useEffect(() => {
    if (title) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [title])

  return (
    <section ref={ref} className={`to-browser${title ? ' to-browser--inline' : ''}`} aria-label={title ?? t('library.title')}>
      {title && (
        <header className="to-browser__head">
          <strong>{title}</strong>
          {onClose && (
            <button type="button" className="to-linkbutton" onClick={onClose}>
              <X size={14} /> {t(done.length ? 'browser.done' : 'browser.close')}
            </button>
          )}
        </header>
      )}

      <div className="to-toolbar">
        <span className="to-muted">{t('library.count', { count: all.length })}</span>
        <span className="to-toolbar to-toolbar--tight to-push">
          <button type="button" className={`to-chip${byMuscle ? ' is-active' : ''}`} onClick={() => setByMuscle((v) => !v)}>
            <Accessibility size={13} /> {t('library.byMuscle')}
          </button>
          {toolbar}
        </span>
      </div>

      {byMuscle && (
        <section className="to-panel to-bodypick">
          <BodyMap
            primary={filter.muscle === 'all' ? [] : [filter.muscle]}
            size="large"
            onPickMuscle={(muscle) => setFilter({ ...filter, muscle: filter.muscle === muscle ? 'all' : muscle })}
          />
          <p className="to-muted">{filter.muscle === 'all' ? t('library.tapMuscle') : t('library.showing', { muscle: muscleLabel(filter.muscle) })}</p>
        </section>
      )}

      <ExerciseFilters filter={filter} onChange={setFilter} />

      <div className="to-exgrid">
        {shown.map((exercise) => {
          if (exercise.id === openId) {
            return (
              <OpenCard
                key={exercise.id}
                exercise={exercise}
                action={action}
                onCollapse={() => setOpenId(null)}
                onDone={() => {
                  setDone((list) => (list.includes(exercise.id) ? list : [...list, exercise.id]))
                  if (action?.keepOpen) setOpenId(null)
                }}
              />
            )
          }
          const days = action?.daysOf?.(exercise.id) ?? []
          const marked = action?.daysOf ? days.length > 0 : done.includes(exercise.id)
          return (
            <div key={exercise.id} className={`to-excard${marked ? ' is-added' : ''}`}>
              <button type="button" className="to-excard__open" aria-expanded={false} onClick={() => setOpenId(exercise.id)}>
                <ExerciseMedia exercise={exercise} size="thumb" />
                <span className="to-excard__text">
                  <strong>
                    {settings.favorites.includes(exercise.id) && <Star size={11} className="to-excard__star" />} {exercise.name}
                  </strong>
                  <span className="to-muted">
                    {muscleLabel(exercise.muscle)} · {equipmentLabel(exercise.equipment)}
                    {exercise.custom ? ` · ${t('library.custom')}` : ''}
                  </span>
                  {days.length > 0 && (
                    <span className="to-excard__days">
                      {WEEK_ORDER.filter((d) => days.includes(d))
                        .map((d) => SHORT_DAYS[d])
                        .join(' · ')}
                    </span>
                  )}
                </span>
              </button>
              {marked && (
                <span className="to-excard__added" aria-label={t('browser.added')} title={t('browser.added')}>
                  <Check size={15} />
                </span>
              )}
            </div>
          )
        })}
      </div>
      {shown.length === 0 && <p className="to-muted">{t('library.none')}</p>}
    </section>
  )
}
