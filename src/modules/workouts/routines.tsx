import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronRight, Dumbbell, Minus, Moon, Plus, Repeat2, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  QuickAdd,
  Segmented,
  toLocalISODate,
  useCollection,
  useNavigate,
  useParams,
  useT,
  type Envelope,
} from '@core/api'
import { BodyMap } from './BodyMap'
import { ExerciseBrowser, ExercisePlanSheet, REST_OPTIONS, WEEK_ORDER } from './browser'
import { equipmentLabel, muscleLabel, type ExerciseDef } from './catalog'
import { useExerciseIndex, useRoutines, useSessions, useTrainingSettings, WEEKDAYS, withIds } from './data'
import { ExerciseSheet } from './detail'
import { SheetButton } from './library'
import { clock, entryFor, itemFromPlan, planOfItem } from './logic'
import { ExerciseMedia } from './media'
import { useMoveRoutine, usePlanRegister } from './register'
import type { PlannedSet, Routine, RoutineItem, Session } from './schema'
import { ExerciseStrip } from './strip'
import { TEMPLATES } from './templates'
import { useRoutineMuscles } from './today'

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

/** A section that opens and closes from its title; all start closed. */
function Fold({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={`to-fold${open ? ' is-open' : ''}`}>
      <button type="button" className="to-fold__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="to-fold__title">{title}</span>
        {summary && <span className="to-muted to-fold__summary">{summary}</span>}
        {open ? <Minus size={16} /> : <Plus size={16} />}
      </button>
      {open && <div className="to-fold__body">{children}</div>}
    </section>
  )
}

/** The exercise a thumbnail was tapped on, with the routine item it came from. */
interface Editing {
  exercise: ExerciseDef
  item?: RoutineItem
  /** The weekdays it is on, known here already so the popup starts with them. */
  days: number[]
}

/* ------------------------------------------------------------------ *
 * The plan: how you train, your week, your routines
 * ------------------------------------------------------------------ */

export function RoutinesScreen() {
  const t = useT()
  const navigate = useNavigate()
  const routines = useRoutines()
  const index = useExerciseIndex()
  const musclesOf = useRoutineMuscles()
  const [settings, setSettings] = useTrainingSettings()
  const { create } = useCollection<Routine>('routines')
  const { count: registered } = usePlanRegister()
  const moveRoutine = useMoveRoutine()
  const [editing, setEditing] = useState<Editing | null>(null)

  const nextOrder = () => (routines.length ? Math.max(...routines.map((r) => r.data.order)) + 1 : 0)

  const applyTemplate = async (id: string) => {
    const template = TEMPLATES.find((tpl) => tpl.id === id)!
    const ids: string[] = []
    let order = nextOrder()
    for (const routine of template.routines) ids.push(await create({ ...routine, order: order++ }))
    if (settings.mode === 'rotation') await setSettings({ rotation: [...settings.rotation, ...ids] })
  }

  /** Opens the exercise's card in a popup, starting from what this routine plans for it. */
  const openExercise = (routine: Routine) => (exerciseId: string) => {
    const exercise = index.get(exerciseId)
    if (!exercise) return
    const days = routines.filter((r) => r.data.weekday !== null && r.data.items.some((item) => item.exerciseId === exerciseId)).map((r) => r.data.weekday as number)
    setEditing({ exercise, item: routine.items.find((item) => item.exerciseId === exerciseId), days })
  }

  const inRotation = (id: string) => settings.rotation.includes(id)
  const rotationList = settings.rotation.map((id) => routines.find((r) => r.id === id)).filter(Boolean) as Envelope<Routine>[]
  const moveInRotation = (id: string, delta: -1 | 1) => {
    const list = [...settings.rotation]
    const at = list.indexOf(id)
    list.splice(at, 1)
    list.splice(at + delta, 0, id)
    void setSettings({ rotation: list })
  }
  const loose = routines.filter((r) => r.data.weekday === null)
  const trainingDays = routines.filter((r) => r.data.weekday !== null).length

  return (
    <div className="to-stack">
      <section className="to-panel to-panel--row to-howpanel">
        <span className="to-today__icon to-today__icon--small">
          <Repeat2 size={14} />
        </span>
        <strong>{t('plan.how')}</strong>
        <Segmented<'week' | 'rotation'>
          label={t('plan.mode')}
          value={settings.mode}
          onChange={(mode) => void setSettings({ mode })}
          options={[
            { value: 'week', label: t('plan.week') },
            { value: 'rotation', label: t('plan.rotation') },
          ]}
        />
        <span className="to-push">
          <SheetButton count={registered} />
        </span>
      </section>
      <p className="to-muted">{t(settings.mode === 'week' ? 'plan.weekHint' : 'plan.rotationHint')}</p>

      {settings.mode === 'week' ? (
        <Fold title={t('plan.thisWeek')} summary={t('plan.daysSummary', { count: trainingDays })}>
          {WEEK_ORDER.map((day) => {
            const routine = routines.find((r) => r.data.weekday === day)
            return (
              <div key={day} className={`to-dayrow to-dayrow--line${routine ? '' : ' is-rest'}`}>
                <span className="to-dayrow__day">{WEEKDAYS[day].slice(0, 3)}</span>
                <span className={`to-today__icon to-today__icon--small${routine ? '' : ' to-today__icon--rest'}`}>
                  {routine ? <Dumbbell size={14} /> : <Moon size={14} />}
                </span>
                <button type="button" className="to-dayrow__main" onClick={() => routine && navigate(`routines/${routine.id}`)} disabled={!routine}>
                  <strong>{routine?.data.name ?? t('plan.rest')}</strong>
                  <span className="to-muted">{routine ? t('routine.exercises', { count: routine.data.items.length }) : t('plan.restHint')}</span>
                </button>
                {routine && (
                  <div className="to-dayrow__thumbs">
                    <ExerciseStrip ids={routine.data.items.map((item) => item.exerciseId)} small onOpen={openExercise(routine.data)} />
                  </div>
                )}
                {routine && <BodyMap primary={musclesOf(routine.data)} size="tiny" />}
                {routine ? (
                  <select
                    className="to-field__input to-dayrow__select"
                    value={String(day)}
                    aria-label={t('plan.moveDay', { name: routine.data.name })}
                    onChange={(e) => void moveRoutine(routine.id, e.target.value === 'rest' ? null : Number(e.target.value))}
                  >
                    {WEEK_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {WEEKDAYS[d]}
                      </option>
                    ))}
                    <option value="rest">{t('plan.rest')}</option>
                  </select>
                ) : (
                  loose.length > 0 && (
                    <select
                      className="to-field__input to-dayrow__select"
                      value=""
                      aria-label={t('plan.assign', { day: WEEKDAYS[day] })}
                      onChange={(e) => e.target.value && void moveRoutine(e.target.value, day)}
                    >
                      <option value="">{t('plan.rest')}</option>
                      {loose.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.data.name}
                        </option>
                      ))}
                    </select>
                  )
                )}
              </div>
            )
          })}
        </Fold>
      ) : (
        <Fold title={t('plan.order')} summary={t('plan.rotationSummary', { count: rotationList.length })}>
          {rotationList.length === 0 && <p className="to-muted">{t('plan.rotationEmpty')}</p>}
          {rotationList.map((r, i) => (
            <div key={r.id} className="to-dayrow to-dayrow--line">
              <span className="to-dayrow__day">{String.fromCharCode(65 + i)}</span>
              <button type="button" className="to-dayrow__main" onClick={() => navigate(`routines/${r.id}`)}>
                <strong>{r.data.name}</strong>
                <span className="to-muted">{t('routine.exercises', { count: r.data.items.length })}</span>
              </button>
              <div className="to-dayrow__thumbs">
                <ExerciseStrip ids={r.data.items.map((item) => item.exerciseId)} small onOpen={openExercise(r.data)} />
              </div>
              <BodyMap primary={musclesOf(r.data)} size="tiny" />
              <span className="to-toolbar to-toolbar--tight">
                <button type="button" className="to-plainicon" aria-label={t('entry.up')} disabled={i === 0} onClick={() => moveInRotation(r.id, -1)}>
                  <ArrowUp size={16} />
                </button>
                <button type="button" className="to-plainicon" aria-label={t('entry.down')} disabled={i === rotationList.length - 1} onClick={() => moveInRotation(r.id, 1)}>
                  <ArrowDown size={16} />
                </button>
              </span>
            </div>
          ))}
        </Fold>
      )}

      <Fold title={t('plan.routines')} summary={t('plan.routinesSummary', { count: routines.length })}>
        <QuickAdd
          placeholder={t('routine.placeholder')}
          onAdd={async (name) => {
            const id = await create({ name, weekday: null, order: nextOrder(), items: [] })
            if (settings.mode === 'rotation') await setSettings({ rotation: [...settings.rotation, id] })
            navigate(`routines/${id}`)
          }}
        />
        {routines.length === 0 ? (
          <EmptyState title={t('routine.empty')} body={t('routine.emptyBody')} />
        ) : (
          routines.map((routine) => (
            <div key={routine.id} className="to-dayrow to-dayrow--line">
              <span className="to-today__icon to-today__icon--small">
                <Dumbbell size={14} />
              </span>
              <button type="button" className="to-dayrow__main" onClick={() => navigate(`routines/${routine.id}`)}>
                <strong>{routine.data.name}</strong>
                <span className="to-muted">
                  {[t('routine.exercises', { count: routine.data.items.length }), routine.data.weekday !== null ? WEEKDAYS[routine.data.weekday] : t('routine.noDay')].join(' · ')}
                </span>
              </button>
              <div className="to-dayrow__thumbs">
                <ExerciseStrip ids={routine.data.items.map((item) => item.exerciseId)} small onOpen={openExercise(routine.data)} />
              </div>
              {settings.mode === 'rotation' && (
                <label className="to-inline-field">
                  <input
                    type="checkbox"
                    checked={inRotation(routine.id)}
                    onChange={(e) =>
                      void setSettings({
                        rotation: e.target.checked ? [...settings.rotation, routine.id] : settings.rotation.filter((id) => id !== routine.id),
                      })
                    }
                  />
                  <span className="to-muted">{t('plan.inRotation')}</span>
                </label>
              )}
              <ChevronRight size={16} className="to-muted" aria-hidden />
            </div>
          ))
        )}
      </Fold>

      <Fold title={t('templates.title')}>
        <p className="to-muted">{t('templates.body')}</p>
        <div className="to-cards">
          {TEMPLATES.map((template) => (
            <article key={template.id} className="to-tile">
              <h3 className="to-tile__title">{template.name}</h3>
              <span className="to-muted">{template.description}</span>
              <span className="to-list__meta">
                {template.routines.map((r) => (
                  <span key={r.name}>{r.name}</span>
                ))}
              </span>
              <Button onClick={() => void applyTemplate(template.id)}>
                <Plus size={14} />
                {t('templates.use')}
              </Button>
            </article>
          ))}
        </div>
      </Fold>

      {editing && (
        <ExercisePlanSheet exercise={editing.exercise} initial={{ ...(editing.item ? planOfItem(editing.item) : {}), days: editing.days }} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * One routine
 * ------------------------------------------------------------------ */

interface SetsShape {
  warmups: number
  count: number
  reps: number | null
  repsMax: number | null
  seconds: number | null
}

function shapeOf(sets: PlannedSet[]): SetsShape {
  const work = sets.filter((s) => s.type !== 'warmup')
  return {
    warmups: sets.length - work.length,
    count: work.length,
    reps: work[0]?.reps ?? null,
    repsMax: work[0]?.repsMax ?? null,
    seconds: work[0]?.seconds ?? null,
  }
}

function setsOf(shape: SetsShape): PlannedSet[] {
  return [
    ...Array.from({ length: shape.warmups }, () => ({ type: 'warmup' as const, reps: 10, repsMax: null, seconds: null })),
    ...Array.from({ length: shape.count }, () => ({ type: 'normal' as const, reps: shape.reps, repsMax: shape.repsMax, seconds: shape.seconds })),
  ]
}

function num(text: string): number | null {
  const n = Number(text.replace(',', '.'))
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n)
}

function ItemField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="to-itemfield">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ItemEditor({
  item,
  def,
  index,
  count,
  onUpdate,
  onMove,
  onRemove,
  onOpen,
}: {
  item: RoutineItem
  def?: ExerciseDef
  index: number
  count: number
  onUpdate: (change: (item: RoutineItem) => RoutineItem) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  onOpen: () => void
}) {
  const t = useT()
  const shape = shapeOf(item.sets)
  const timed = def?.kind === 'time' || def?.kind === 'cardio'
  const set = (patch: Partial<SetsShape>) => onUpdate((it) => ({ ...it, sets: setsOf({ ...shapeOf(it.sets), ...patch }) }))

  return (
    <article className="to-entry to-item">
      <div className="to-item__who">
        {def && (
          <button type="button" className="to-entry__pic" aria-label={t('entry.howTo', { name: def.name })} onClick={onOpen}>
            <ExerciseMedia exercise={def} size="thumb" />
          </button>
        )}
        {def && <BodyMap primary={[def.muscle]} secondary={def.secondary} size="tiny" />}
        <div className="to-entry__title">
          <strong>{def?.name ?? item.exerciseId}</strong>
          {def && (
            <span className="to-muted">
              {muscleLabel(def.muscle)} · {equipmentLabel(def.equipment)}
            </span>
          )}
          {item.superset && <Badge tone="accent">{t('entry.superset', { letter: item.superset })}</Badge>}
        </div>
        <span className="to-item__tools">
          <button type="button" className="to-plainicon" aria-label={t('entry.up')} title={t('entry.up')} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp size={16} />
          </button>
          <button type="button" className="to-plainicon" aria-label={t('entry.down')} title={t('entry.down')} disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown size={16} />
          </button>
          <button type="button" className="to-plainicon" aria-label={t('entry.remove')} title={t('entry.remove')} onClick={onRemove}>
            <Trash2 size={16} />
          </button>
        </span>
      </div>

      <div className="to-item__fields">
        <ItemField label={t('routine.sets')}>
          <input className="to-field__input" inputMode="numeric" defaultValue={shape.count} aria-label={t('routine.sets')} onBlur={(e) => set({ count: Math.max(1, num(e.target.value) ?? 1) })} />
        </ItemField>
        {timed ? (
          <ItemField label={t(def?.kind === 'cardio' ? 'routine.minutes' : 'routine.seconds')}>
            <input
              className="to-field__input"
              inputMode="numeric"
              defaultValue={shape.seconds === null ? '' : def?.kind === 'cardio' ? Math.round(shape.seconds / 60) : shape.seconds}
              aria-label={t('routine.seconds')}
              onBlur={(e) => {
                const value = num(e.target.value)
                set({ seconds: value === null ? null : def?.kind === 'cardio' ? value * 60 : value, reps: null, repsMax: null })
              }}
            />
          </ItemField>
        ) : (
          <>
            <ItemField label={t('routine.reps')}>
              <input className="to-field__input" inputMode="numeric" defaultValue={shape.reps ?? ''} aria-label={t('routine.reps')} onBlur={(e) => set({ reps: num(e.target.value) })} />
            </ItemField>
            <ItemField label={t('routine.repsMax')}>
              <input className="to-field__input" inputMode="numeric" defaultValue={shape.repsMax ?? ''} aria-label={t('routine.repsMax')} onBlur={(e) => set({ repsMax: num(e.target.value) })} />
            </ItemField>
          </>
        )}
        {(def?.kind === 'weight' || def?.kind === 'bodyweight') && (
          <ItemField label={t('routine.weight')}>
            <input
              className="to-field__input"
              inputMode="decimal"
              defaultValue={item.weight ? String(item.weight).replace('.', ',') : ''}
              aria-label={t('routine.weight')}
              onBlur={(e) => {
                const raw = e.target.value.trim().replace(',', '.')
                const n = Number(raw)
                const weight = raw === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100) / 100
                if (weight !== (item.weight ?? null)) onUpdate((it) => ({ ...it, weight }))
              }}
            />
          </ItemField>
        )}
        {def?.kind === 'weight' && (
          <ItemField label={t('routine.warmups')}>
            <input className="to-field__input" inputMode="numeric" defaultValue={shape.warmups} aria-label={t('routine.warmups')} onBlur={(e) => set({ warmups: num(e.target.value) ?? 0 })} />
          </ItemField>
        )}
        <ItemField label={t('entry.rest')}>
          <select
            className="to-field__input"
            value={item.rest}
            aria-label={t('entry.rest')}
            onChange={(e) => {
              const rest = Number(e.target.value)
              onUpdate((it) => ({ ...it, rest }))
            }}
          >
            {REST_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t('entry.noRest') : clock(s)}
              </option>
            ))}
          </select>
        </ItemField>
        <ItemField label={t('routine.noteShort')}>
          <input
            className="to-field__input"
            defaultValue={item.note}
            placeholder={t('routine.note')}
            aria-label={t('routine.note')}
            onBlur={(e) => {
              const note = e.target.value
              if (note !== item.note) onUpdate((it) => ({ ...it, note }))
            }}
          />
        </ItemField>
      </div>
    </article>
  )
}

/** The routine's title: its name and its weekday, changed from the title itself. */
function RoutineTitle({ routine }: { routine: Envelope<Routine> }) {
  const t = useT()
  const { update } = useCollection<Routine>('routines')
  const moveRoutine = useMoveRoutine()
  const { name, weekday } = routine.data
  // A routine named after its day reads "Treino de [Domingo ▾]"; any other keeps its own name.
  const dayNamed = weekday !== null && name === t('sheet.dayRoutine', { day: WEEKDAYS[weekday] })

  const daySelect = (
    <span className="to-titleselect">
      <select value={weekday ?? 'none'} aria-label={t('routine.weekday')} onChange={(e) => void moveRoutine(routine.id, e.target.value === 'none' ? null : Number(e.target.value))}>
        {WEEK_ORDER.map((d) => (
          <option key={d} value={d}>
            {WEEKDAYS[d]}
          </option>
        ))}
        <option value="none">{t('routine.noDay')}</option>
      </select>
      <ChevronDown size={18} aria-hidden />
    </span>
  )

  return (
    <h1 className="to-routinetitle">
      {dayNamed ? (
        <>
          <span>{t('routine.of')}</span>
          {daySelect}
        </>
      ) : (
        <>
          <input
            key={name}
            className="to-titleinput"
            defaultValue={name}
            aria-label={t('routine.name')}
            size={Math.max(8, name.length)}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== name && void update(routine.id, { name: e.target.value.trim() })}
          />
          <span className="to-muted">·</span>
          {daySelect}
        </>
      )}
    </h1>
  )
}

export function RoutineScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const routines = useRoutines()
  const routine = routines.find((r) => r.id === id)
  const index = useExerciseIndex()
  const sessions = useSessions()
  const [settings, setSettings] = useTrainingSettings()
  const { update, remove } = useCollection<Routine>('routines')
  const sessionsWriter = useCollection<Session>('sessions')
  const [picking, setPicking] = useState(false)
  const [viewing, setViewing] = useState<ExerciseDef | null>(null)

  // Edits apply to the newest items, so two quick changes both stay.
  const stored = routine?.data.items
  const latest = useRef(stored ?? [])
  const pending = useRef(0)
  useEffect(() => {
    if (pending.current === 0 && stored) latest.current = stored
  }, [stored])

  if (!routine) return <EmptyState title={t('routine.missing')} />
  const items = routine.data.items
  const mutate = (change: (current: RoutineItem[]) => RoutineItem[]) => {
    const next = change(latest.current)
    latest.current = next
    pending.current++
    void update(routine.id, { items: next }).finally(() => {
      pending.current--
    })
  }

  const startNow = async () => {
    const finished = withIds(sessions).filter((s) => s.finishedAt)
    await sessionsWriter.create({
      date: toLocalISODate(),
      name: routine.data.name,
      routineId: routine.id,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      note: '',
      entries: items.map((item) => {
        const def = index.get(item.exerciseId)
        return def ? entryFor(def, finished, item, settings.rest) : entryFor({ id: item.exerciseId, name: item.exerciseId, muscle: 'corpo', secondary: [], equipment: 'nenhum', kind: 'weight', perSide: false, compound: false, instructions: '' }, finished, item)
      }),
    })
    navigate('')
  }

  const removeRoutine = () => {
    if (!confirm(t('routine.removeConfirm', { name: routine.data.name }))) return
    void remove(routine.id)
    if (settings.rotation.includes(routine.id)) void setSettings({ rotation: settings.rotation.filter((r) => r !== routine.id) })
    navigate('routines')
  }

  return (
    <div className="to-stack">
      <header className="to-routinehead">
        <button type="button" className="to-linkbutton" onClick={() => navigate('routines')}>
          <ArrowLeft size={15} /> {t('routine.back')}
        </button>
        <RoutineTitle routine={routine} />
        <Button variant="primary" onClick={() => void startNow()} disabled={items.length === 0}>
          {t('routine.startNow')}
        </Button>
      </header>

      {items.length === 0 ? (
        <EmptyState title={t('routine.noItems')} body={t('routine.noItemsBody')} />
      ) : (
        items.map((item, i) => {
          const def = index.get(item.exerciseId)
          return (
            <ItemEditor
              key={`${i}-${item.exerciseId}`}
              item={item}
              def={def}
              index={i}
              count={items.length}
              onOpen={() => def && setViewing(def)}
              onUpdate={(change) => mutate((list) => list.map((it, j) => (j === i ? change(it) : it)))}
              onMove={(delta) =>
                mutate((list) => {
                  const next = [...list]
                  const [moved] = next.splice(i, 1)
                  next.splice(i + delta, 0, moved)
                  return next
                })
              }
              onRemove={() => mutate((list) => list.filter((_, j) => j !== i))}
            />
          )
        })
      )}

      {picking ? (
        <ExerciseBrowser
          title={t('workout.addExercise')}
          onClose={() => setPicking(false)}
          action={{
            label: t('routine.addToRoutine'),
            withDays: false,
            keepOpen: true,
            onAdd: (exercise, plan) => mutate((list) => [...list, itemFromPlan(exercise.id, plan)]),
          }}
        />
      ) : (
        <div className="to-toolbar">
          <Button onClick={() => setPicking(true)}>
            <Plus size={15} />
            {t('workout.addExercise')}
          </Button>
          <button type="button" className="to-linkbutton to-linkbutton--danger to-push" onClick={removeRoutine}>
            <Trash2 size={14} /> {t('routine.remove')}
          </button>
        </div>
      )}

      {viewing && <ExerciseSheet exercise={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
