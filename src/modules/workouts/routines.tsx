import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Link2, Play, Plus, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
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
import type { ExerciseDef } from './catalog'
import { useExerciseIndex, useRoutines, useSessions, useTrainingSettings, WEEKDAYS, withIds } from './data'
import { clock, entryFor } from './logic'
import { ExercisePicker } from './picker'
import type { PlannedSet, Routine, RoutineItem, Session } from './schema'
import { TEMPLATES } from './templates'

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]

/* ------------------------------------------------------------------ *
 * The list, the plan mode and the ready-made plans
 * ------------------------------------------------------------------ */

export function RoutinesScreen() {
  const t = useT()
  const navigate = useNavigate()
  const routines = useRoutines()
  const index = useExerciseIndex()
  const [settings, setSettings] = useTrainingSettings()
  const { create, update, remove } = useCollection<Routine>('routines')

  const nextOrder = () => (routines.length ? Math.max(...routines.map((r) => r.data.order)) + 1 : 0)

  const applyTemplate = async (id: string) => {
    const template = TEMPLATES.find((tpl) => tpl.id === id)!
    const ids: string[] = []
    let order = nextOrder()
    for (const routine of template.routines) ids.push(await create({ ...routine, order: order++ }))
    if (settings.mode === 'rotation') await setSettings({ rotation: [...settings.rotation, ...ids] })
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

  return (
    <div className="to-stack">
      <Segmented<'week' | 'rotation'>
        label={t('plan.mode')}
        value={settings.mode}
        onChange={(mode) => void setSettings({ mode })}
        options={[
          { value: 'week', label: t('plan.week') },
          { value: 'rotation', label: t('plan.rotation') },
        ]}
      />
      <p className="to-muted">{t(settings.mode === 'week' ? 'plan.weekHint' : 'plan.rotationHint')}</p>

      <QuickAdd
        placeholder={t('routine.placeholder')}
        onAdd={async (name) => {
          const id = await create({ name, weekday: null, order: nextOrder(), items: [] })
          if (settings.mode === 'rotation') await setSettings({ rotation: [...settings.rotation, id] })
          navigate(`routines/${id}`)
        }}
      />

      {settings.mode === 'rotation' && rotationList.length > 0 && (
        <Card title={t('plan.order')}>
          <ol className="to-plainlist">
            {rotationList.map((r, i) => (
              <li key={r.id} className="to-tile__row">
                <span>
                  {String.fromCharCode(65 + i)} · {r.data.name}
                </span>
                <span className="to-toolbar to-toolbar--tight">
                  <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.up')} disabled={i === 0} onClick={() => moveInRotation(r.id, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.down')} disabled={i === rotationList.length - 1} onClick={() => moveInRotation(r.id, 1)}>
                    <ArrowDown size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {routines.length === 0 ? (
        <EmptyState title={t('routine.empty')} body={t('routine.emptyBody')} />
      ) : (
        <ul className="to-list">
          {routines.map((routine) => (
            <li key={routine.id} className="to-list__item">
              <button type="button" className="to-list__main to-rowbutton" onClick={() => navigate(`routines/${routine.id}`)}>
                <span className="to-list__title">{routine.data.name}</span>
                <span className="to-list__meta">
                  <span>{t('routine.exercises', { count: routine.data.items.length })}</span>
                  {settings.mode === 'week' && routine.data.weekday !== null && <Badge>{WEEKDAYS[routine.data.weekday]}</Badge>}
                  <span>{routine.data.items.slice(0, 3).map((item) => index.get(item.exerciseId)?.name).filter(Boolean).join(', ')}</span>
                </span>
              </button>
              <div className="to-list__actions">
                {settings.mode === 'week' ? (
                  <select
                    className="to-field__input"
                    value={routine.data.weekday ?? ''}
                    aria-label={t('routine.weekday')}
                    onChange={(e) => void update(routine.id, { weekday: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">{t('routine.noDay')}</option>
                    {WEEKDAYS.map((day, i) => (
                      <option key={day} value={i}>
                        {day}
                      </option>
                    ))}
                  </select>
                ) : (
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
                <ChevronRight size={15} className="to-muted" aria-hidden />
                <button
                  type="button"
                  className="to-iconbutton to-iconbutton--small"
                  aria-label={t('routine.remove')}
                  onClick={() => {
                    if (!confirm(t('routine.removeConfirm', { name: routine.data.name }))) return
                    void remove(routine.id)
                    if (inRotation(routine.id)) void setSettings({ rotation: settings.rotation.filter((id) => id !== routine.id) })
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card title={t('templates.title')}>
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
      </Card>

      <Card title={t('settings.title')}>
        <div className="to-toolbar">
          <label className="to-inline-field">
            <span className="to-muted">{t('settings.effort')}</span>
            <select className="to-field__input" value={settings.effort} onChange={(e) => void setSettings({ effort: e.target.value as 'none' | 'rir' | 'rpe' })}>
              <option value="none">{t('settings.effort.none')}</option>
              <option value="rir">RIR</option>
              <option value="rpe">RPE</option>
            </select>
          </label>
          <label className="to-inline-field">
            <span className="to-muted">{t('settings.rest')}</span>
            <select className="to-field__input" value={settings.rest} onChange={(e) => void setSettings({ rest: Number(e.target.value) })}>
              {REST_OPTIONS.filter((s) => s > 0).map((s) => (
                <option key={s} value={s}>
                  {clock(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="to-inline-field">
            <span className="to-muted">{t('settings.step')}</span>
            <select className="to-field__input" value={settings.step} onChange={(e) => void setSettings({ step: Number(e.target.value) })}>
              {[0.5, 1, 1.25, 2, 2.5, 5].map((s) => (
                <option key={s} value={s}>
                  {String(s).replace('.', ',')} kg
                </option>
              ))}
            </select>
          </label>
          <label className="to-inline-field">
            <input type="checkbox" checked={settings.sound} onChange={(e) => void setSettings({ sound: e.target.checked })} />
            <span>{t('settings.sound')}</span>
          </label>
        </div>
        <p className="to-muted">{t('settings.hint')}</p>
      </Card>
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

function ItemEditor({
  item,
  def,
  index,
  count,
  linked,
  onUpdate,
  onMove,
  onRemove,
  onSuperset,
}: {
  item: RoutineItem
  def?: ExerciseDef
  index: number
  count: number
  linked: boolean
  onUpdate: (change: (item: RoutineItem) => RoutineItem) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  onSuperset: () => void
}) {
  const t = useT()
  const shape = shapeOf(item.sets)
  const timed = def?.kind === 'time' || def?.kind === 'cardio'
  const set = (patch: Partial<SetsShape>) => onUpdate((it) => ({ ...it, sets: setsOf({ ...shapeOf(it.sets), ...patch }) }))

  return (
    <article className="to-entry">
      <header className="to-entry__header">
        <div className="to-entry__title">
          <strong>{def?.name ?? item.exerciseId}</strong>
          {item.superset && <Badge tone="accent">{t('entry.superset', { letter: item.superset })}</Badge>}
        </div>
        <div className="to-toolbar to-toolbar--tight">
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.up')} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp size={14} />
          </button>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.down')} disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown size={14} />
          </button>
          {index < count - 1 && (
            <button type="button" className={`to-iconbutton to-iconbutton--small${linked ? ' active' : ''}`} aria-label={t('entry.supersetToggle')} title={t('entry.supersetToggle')} onClick={onSuperset}>
              <Link2 size={14} />
            </button>
          )}
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.remove')} onClick={onRemove}>
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      <div className="to-toolbar">
        <label className="to-inline-field">
          <span className="to-muted">{t('routine.sets')}</span>
          <input className="to-field__input to-input--tiny" inputMode="numeric" defaultValue={shape.count} aria-label={t('routine.sets')} onBlur={(e) => set({ count: Math.max(1, num(e.target.value) ?? 1) })} />
        </label>
        {timed ? (
          <label className="to-inline-field">
            <span className="to-muted">{t(def?.kind === 'cardio' ? 'routine.minutes' : 'routine.seconds')}</span>
            <input
              className="to-field__input to-input--tiny"
              inputMode="numeric"
              defaultValue={shape.seconds === null ? '' : def?.kind === 'cardio' ? Math.round(shape.seconds / 60) : shape.seconds}
              aria-label={t('routine.seconds')}
              onBlur={(e) => {
                const value = num(e.target.value)
                set({ seconds: value === null ? null : def?.kind === 'cardio' ? value * 60 : value, reps: null, repsMax: null })
              }}
            />
          </label>
        ) : (
          <>
            <label className="to-inline-field">
              <span className="to-muted">{t('routine.reps')}</span>
              <input className="to-field__input to-input--tiny" inputMode="numeric" defaultValue={shape.reps ?? ''} aria-label={t('routine.reps')} onBlur={(e) => set({ reps: num(e.target.value) })} />
            </label>
            <label className="to-inline-field">
              <span className="to-muted">{t('routine.repsMax')}</span>
              <input className="to-field__input to-input--tiny" inputMode="numeric" defaultValue={shape.repsMax ?? ''} aria-label={t('routine.repsMax')} onBlur={(e) => set({ repsMax: num(e.target.value) })} />
            </label>
          </>
        )}
        {def?.kind === 'weight' && (
          <label className="to-inline-field">
            <span className="to-muted">{t('routine.warmups')}</span>
            <input className="to-field__input to-input--tiny" inputMode="numeric" defaultValue={shape.warmups} aria-label={t('routine.warmups')} onBlur={(e) => set({ warmups: num(e.target.value) ?? 0 })} />
          </label>
        )}
        <label className="to-inline-field">
          <span className="to-muted">{t('entry.rest')}</span>
          <select className="to-field__input" value={item.rest} aria-label={t('entry.rest')} onChange={(e) => {
            const rest = Number(e.target.value)
            onUpdate((it) => ({ ...it, rest }))
          }}>
            {REST_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t('entry.noRest') : clock(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input className="to-field__input" defaultValue={item.note} placeholder={t('routine.note')} aria-label={t('routine.note')} onBlur={(e) => {
          const note = e.target.value
          if (note !== item.note) onUpdate((it) => ({ ...it, note }))
        }} />
    </article>
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
  const [settings] = useTrainingSettings()
  const { update } = useCollection<Routine>('routines')
  const sessionsWriter = useCollection<Session>('sessions')
  const [picking, setPicking] = useState(false)

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

  const toggleSuperset = (at: number) =>
    mutate((list) => {
      const a = list[at]
      const b = list[at + 1]
      if (!a || !b) return list
      if (a.superset && a.superset === b.superset) return list.map((it, i) => (i === at || i === at + 1 ? { ...it, superset: null } : it))
      const used = new Set(list.map((it) => it.superset).filter(Boolean))
      const letter = a.superset ?? b.superset ?? 'ABCDEFGH'.split('').find((l) => !used.has(l)) ?? 'Z'
      return list.map((it, i) => (i === at || i === at + 1 ? { ...it, superset: letter } : it))
    })

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

  return (
    <div className="to-stack">
      <div className="to-toolbar">
        <Button variant="ghost" onClick={() => navigate('routines')}>
          <ArrowLeft size={15} />
          {t('routine.back')}
        </Button>
        <Button variant="primary" onClick={() => void startNow()} disabled={items.length === 0}>
          <Play size={15} />
          {t('routine.startNow')}
        </Button>
      </div>
      <div className="to-toolbar">
        <input
          className="to-field__input to-workout__name"
          defaultValue={routine.data.name}
          aria-label={t('routine.name')}
          onBlur={(e) => e.target.value.trim() && e.target.value !== routine.data.name && void update(routine.id, { name: e.target.value.trim() })}
        />
        <select
          className="to-field__input"
          value={routine.data.weekday ?? ''}
          aria-label={t('routine.weekday')}
          onChange={(e) => void update(routine.id, { weekday: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <option value="">{t('routine.noDay')}</option>
          {WEEKDAYS.map((day, i) => (
            <option key={day} value={i}>
              {day}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('routine.noItems')} body={t('routine.noItemsBody')} />
      ) : (
        items.map((item, i) => (
          <ItemEditor
            key={`${i}-${item.exerciseId}`}
            item={item}
            def={index.get(item.exerciseId)}
            index={i}
            count={items.length}
            linked={Boolean(item.superset && items[i + 1]?.superset === item.superset)}
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
            onSuperset={() => toggleSuperset(i)}
          />
        ))
      )}

      <div className="to-toolbar">
        <Button onClick={() => setPicking(true)}>
          <Plus size={15} />
          {t('workout.addExercise')}
        </Button>
      </div>

      {picking && (
        <ExercisePicker
          title={t('workout.addExercise')}
          onClose={() => setPicking(false)}
          onPick={(exercise) => {
            const timed = exercise.kind === 'time' || exercise.kind === 'cardio'
            const sets = setsOf({ warmups: 0, count: timed ? 1 : 3, reps: timed ? null : 10, repsMax: timed ? null : 12, seconds: exercise.kind === 'time' ? 30 : exercise.kind === 'cardio' ? 1200 : null })
            mutate((list) => [...list, { exerciseId: exercise.id, sets, rest: exercise.compound ? 120 : settings.rest, superset: null, note: '' }])
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}
