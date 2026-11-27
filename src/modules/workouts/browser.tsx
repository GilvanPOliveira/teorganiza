import { useEffect, useMemo, useRef, useState } from 'react'
import { Accessibility, Check, ChevronUp, Plus, Star, X } from 'lucide-react'
import { Button, Card, useCollection, useT } from '@core/api'
import { BodyMap } from './BodyMap'
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel, type Equipment, type ExerciseDef, type ExerciseKind, type Muscle } from './catalog'
import { customId, useExerciseIndex, useSessions, useTrainingSettings, withIds } from './data'
import { CustomTools, ExerciseDetail, FavoriteButton } from './detail'
import { fmt, Stepper } from './inputs'
import { lastEntry, planFor, type ExercisePlan } from './logic'
import { ExerciseMedia } from './media'
import { EMPTY_FILTER, ExerciseFilters, filterExercises, isFiltering, type ExerciseFilter } from './picker'
import type { CustomExercise } from './schema'

const KINDS: ExerciseKind[] = ['weight', 'bodyweight', 'time', 'cardio']

/** What the open card's button does: add to a workout or a routine, or swap. */
export interface BrowserAction {
  label: string
  /** Ask for the load too (a workout); a routine plans sets and reps only. */
  withLoad: boolean
  /** Stay open after adding, to add several in a row. */
  keepOpen: boolean
  onAdd: (exercise: ExerciseDef, plan: ExercisePlan) => void
}

/* ------------------------------------------------------------------ *
 * Sets, reps, load: what the exercise goes in with
 * ------------------------------------------------------------------ */

function PlanFields({ exercise, plan, withLoad, onChange }: { exercise: ExerciseDef; plan: ExercisePlan; withLoad: boolean; onChange: (plan: ExercisePlan) => void }) {
  const t = useT()
  const [settings] = useTrainingSettings()
  const set = (patch: Partial<ExercisePlan>) => onChange({ ...plan, ...patch })
  const lifts = exercise.kind === 'weight' || exercise.kind === 'bodyweight'
  return (
    <div className="to-plan__fields">
      {exercise.kind !== 'cardio' && (
        <div className="to-plan__field">
          <span>{t('setup.sets')}</span>
          <Stepper value={plan.sets} step={1} decimals={false} label={t('setup.sets')} onCommit={(v) => set({ sets: Math.max(1, v ?? 1) })} />
        </div>
      )}
      {lifts && (
        <div className="to-plan__field">
          <span>{t(exercise.perSide ? 'setup.repsSide' : 'setup.reps')}</span>
          <Stepper value={plan.reps} step={1} decimals={false} label={t('setup.reps')} onCommit={(v) => set({ reps: v })} />
        </div>
      )}
      {lifts && withLoad && (
        <div className="to-plan__field">
          <span>{t(exercise.kind === 'bodyweight' ? 'setup.extra' : 'setup.load')}</span>
          <Stepper value={plan.weight} step={settings.step} label={t('setup.load')} onCommit={(v) => set({ weight: v })} />
        </div>
      )}
      {exercise.kind === 'time' && (
        <div className="to-plan__field">
          <span>{t('setup.seconds')}</span>
          <Stepper value={plan.seconds} step={5} decimals={false} label={t('setup.seconds')} onCommit={(v) => set({ seconds: v })} />
        </div>
      )}
      {exercise.kind === 'cardio' && (
        <div className="to-plan__field">
          <span>{t('setup.minutes')}</span>
          <Stepper
            value={plan.seconds === null ? null : Math.round(plan.seconds / 60)}
            step={1}
            decimals={false}
            label={t('setup.minutes')}
            onCommit={(v) => set({ seconds: v === null ? null : v * 60 })}
          />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * One exercise, opened in place
 * ------------------------------------------------------------------ */

function OpenCard({ exercise, action, added, onCollapse, onAdded }: { exercise: ExerciseDef; action?: BrowserAction; added: boolean; onCollapse: () => void; onAdded: () => void }) {
  const t = useT()
  const sessions = withIds(useSessions()).filter((s) => s.finishedAt)
  const [plan, setPlan] = useState<ExercisePlan>(() => planFor(exercise, sessions))
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

  return (
    <article ref={ref} className="to-excard is-open">
      <header className="to-excard__openhead">
        <strong>{exercise.name}</strong>
        <FavoriteButton exercise={exercise} />
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('browser.collapse')} title={t('browser.collapse')} onClick={onCollapse}>
          <ChevronUp size={16} />
        </button>
      </header>
      <ExerciseDetail exercise={exercise}>
        {action && (
          <div className="to-plan">
            <PlanFields exercise={exercise} plan={plan} withLoad={action.withLoad} onChange={setPlan} />
            {lastText && <p className="to-muted to-plan__last">{t('setup.last', { sets: lastText })}</p>}
            <button
              type="button"
              className="to-pill to-plan__add"
              onClick={() => {
                action.onAdd(exercise, plan)
                onAdded()
              }}
            >
              {added ? <Check size={15} /> : <Plus size={15} />}
              {added ? t('browser.addAgain') : action.label}
            </button>
          </div>
        )}
      </ExerciseDetail>
      <CustomTools exercise={exercise} onRemoved={onCollapse} />
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * A new exercise of the user's own
 * ------------------------------------------------------------------ */

function CustomForm({ onDone, startMuscle }: { onDone: (created?: { id: string; name: string }) => void; startMuscle?: Muscle }) {
  const t = useT()
  const { create } = useCollection<CustomExercise>('exercises')
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<Muscle>(startMuscle ?? 'peito')
  const [equipment, setEquipment] = useState<Equipment>('halteres')
  const [kind, setKind] = useState<ExerciseKind>('weight')
  const [perSide, setPerSide] = useState(false)
  const [instructions, setInstructions] = useState('')
  return (
    <Card title={t('library.newTitle')}>
      <form
        className="to-stack to-stack--tight"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const id = await create({ name: name.trim(), muscle, secondary: [], equipment, kind, perSide, compound: false, instructions: instructions.trim() })
          onDone({ id, name: name.trim() })
        }}
      >
        <input className="to-field__input" autoFocus value={name} placeholder={t('library.newName')} aria-label={t('library.newName')} onChange={(e) => setName(e.target.value)} />
        <div className="to-toolbar">
          <select className="to-field__input" value={muscle} aria-label={t('library.muscle')} onChange={(e) => setMuscle(e.target.value as Muscle)}>
            {MUSCLES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <select className="to-field__input" value={equipment} aria-label={t('library.equipment')} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <select className="to-field__input" value={kind} aria-label={t('library.kind')} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </select>
          <label className="to-inline-field">
            <input type="checkbox" checked={perSide} onChange={(e) => setPerSide(e.target.checked)} />
            <span>{t('library.perSide')}</span>
          </label>
        </div>
        <textarea className="to-field__input" rows={2} value={instructions} placeholder={t('library.newInstructions')} aria-label={t('library.newInstructions')} onChange={(e) => setInstructions(e.target.value)} />
        <p className="to-muted">{t('library.mediaHint')}</p>
        <div className="to-toolbar">
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {t('library.create')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onDone()}>
            {t('action.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

/* ------------------------------------------------------------------ *
 * The list
 * ------------------------------------------------------------------ */

/**
 * The exercise list, on the page itself. Names only until a muscle or a
 * filter is chosen, then with pictures. Tapping one opens it in place:
 * the moving photo, how to do it, the muscles and, when adding to a
 * workout or a routine, the sets, reps and load it goes in with. A new
 * exercise is created here too and opens ready to add.
 */
export function ExerciseBrowser({
  title,
  action,
  onClose,
  startMuscle,
}: {
  /** Shown as a panel with a close button when there is a title. */
  title?: string
  action?: BrowserAction
  onClose?: () => void
  /** Opens filtered to a muscle, as when swapping an exercise for a similar one. */
  startMuscle?: Muscle
}) {
  const t = useT()
  const { all } = useExerciseIndex()
  const [settings] = useTrainingSettings()
  const [filter, setFilter] = useState<ExerciseFilter>(startMuscle ? { ...EMPTY_FILTER, muscle: startMuscle } : EMPTY_FILTER)
  const [byMuscle, setByMuscle] = useState(false)
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const ref = useRef<HTMLElement>(null)
  const shown = useMemo(() => filterExercises(all, filter, settings.favorites).slice(0, 160), [all, filter, settings.favorites])
  const pictures = isFiltering(filter)

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
              <X size={14} /> {t(added.length ? 'browser.done' : 'browser.close')}
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
      {!pictures && <p className="to-muted to-browser__hint">{t('browser.pickFilter')}</p>}

      <div className="to-exgrid">
        {creating ? (
          <div className="to-excard--form">
            <CustomForm
              startMuscle={filter.muscle === 'all' ? undefined : filter.muscle}
              onDone={(created) => {
                setCreating(false)
                if (!created) return
                setFilter({ ...EMPTY_FILTER, query: created.name })
                setOpenId(customId(created.id))
              }}
            />
          </div>
        ) : (
          <button type="button" className="to-excard to-excard--new" onClick={() => (setCreating(true), setOpenId(null))}>
            <span className="to-excard__thumb--new">
              <Plus size={18} />
            </span>
            <span className="to-excard__text">
              <strong>{t('library.new')}</strong>
              <span className="to-muted">{t('library.newHint')}</span>
            </span>
          </button>
        )}

        {shown.map((exercise) =>
          exercise.id === openId ? (
            <OpenCard
              key={exercise.id}
              exercise={exercise}
              action={action}
              added={added.includes(exercise.id)}
              onCollapse={() => setOpenId(null)}
              onAdded={() => {
                setAdded((list) => (list.includes(exercise.id) ? list : [...list, exercise.id]))
                if (action?.keepOpen) setOpenId(null)
              }}
            />
          ) : (
            <div key={exercise.id} className={`to-excard${pictures ? '' : ' to-excard--plain'}${added.includes(exercise.id) ? ' is-added' : ''}`}>
              <button type="button" className="to-excard__open" aria-expanded={false} onClick={() => (setOpenId(exercise.id), setCreating(false))}>
                {pictures && <ExerciseMedia exercise={exercise} size="thumb" />}
                <span className="to-excard__text">
                  <strong>
                    {settings.favorites.includes(exercise.id) && <Star size={11} className="to-excard__star" />} {exercise.name}
                  </strong>
                  <span className="to-muted">
                    {muscleLabel(exercise.muscle)} · {equipmentLabel(exercise.equipment)}
                    {exercise.custom ? ` · ${t('library.custom')}` : ''}
                  </span>
                </span>
              </button>
              {added.includes(exercise.id) && (
                <span className="to-excard__added" aria-label={t('browser.added')} title={t('browser.added')}>
                  <Check size={15} />
                </span>
              )}
            </div>
          ),
        )}
      </div>
      {shown.length === 0 && <p className="to-muted">{t('library.none')}</p>}
    </section>
  )
}
