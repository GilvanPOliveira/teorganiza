import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Info,
  LayoutList,
  Link2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Repeat,
  RectangleHorizontal,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { Badge, Button, EmptyState, useCollection, useT, type Envelope } from '@core/api'
import { BodyMap } from './BodyMap'
import { equipmentLabel, muscleLabel, type ExerciseDef, type Muscle } from './catalog'
import { useExerciseIndex, useSessions, useTrainingSettings, weightStep, withIds } from './data'
import { bestOf, clock, doneSets, entryFromPlan, estimateOneRepMax, isRecord, lastEntry, sessionVolume, warmupFor, type Best, type ExercisePlan } from './logic'
import { ExerciseBrowser } from './browser'
import { ExerciseSheet } from './detail'
import { fmt, NumberInput, Stepper } from './inputs'
import { ExerciseMedia } from './media'
import type { Entry, LoggedSet, Session, SetType } from './schema'

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]
const TYPE_ORDER: SetType[] = ['normal', 'warmup', 'drop', 'restpause']


/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Screen on, sound, rest
 * ------------------------------------------------------------------ */

function beep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    ;[0, 0.25].forEach((at) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.15
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.15)
    })
    setTimeout(() => void ctx.close(), 800)
  } catch {
    // No sound available: the timer still shows.
  }
  navigator.vibrate?.([200, 100, 200])
}

/** Keeps the screen on while a workout is open, where the browser allows it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let live = true
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => (live ? (lock = l) : void l.release()))
        .catch(() => undefined)
    void request()
    const again = () => document.visibilityState === 'visible' && void request()
    document.addEventListener('visibilitychange', again)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', again)
      void lock?.release()
    }
  }, [active])
}

interface RestState {
  /** When it ends, in ms; 0 when paused or idle. */
  end: number
  /** Seconds left while paused. */
  paused: number
  total: number
  label: string
}

const IDLE: RestState = { end: 0, paused: 0, total: 0, label: '' }

/** The rest countdown. Kept per session, so it survives leaving the screen. */
function useRest(sessionId: string, sound: boolean) {
  const key = `teorganiza.rest.${sessionId}`
  const [state, setState] = useState<RestState>(() => {
    try {
      return { ...IDLE, ...(JSON.parse(sessionStorage.getItem(key) ?? 'null') as RestState | null) }
    } catch {
      return IDLE
    }
  })
  const [now, setNow] = useState(() => Date.now())
  const write = (next: RestState) => {
    setState(next)
    try {
      if (next.end || next.paused) sessionStorage.setItem(key, JSON.stringify(next))
      else sessionStorage.removeItem(key)
    } catch {
      // Without storage the timer lives only on this screen.
    }
  }
  useEffect(() => {
    if (!state.end) return
    const timer = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= state.end) {
        if (sound) beep()
        write(IDLE)
      }
    }, 250)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.end, sound])

  const remaining = state.paused || (state.end ? Math.max(0, (state.end - now) / 1000) : 0)
  return {
    remaining,
    total: state.total,
    label: state.label,
    paused: Boolean(state.paused),
    active: Boolean(state.end || state.paused),
    start: (seconds: number, label: string) => seconds > 0 && write({ end: Date.now() + seconds * 1000, paused: 0, total: seconds, label }),
    add: (seconds: number) =>
      state.paused
        ? write({ ...state, paused: Math.max(1, state.paused + seconds), total: Math.max(state.total, state.paused + seconds) })
        : state.end && write({ ...state, end: Math.max(Date.now() + 1000, state.end + seconds * 1000), total: Math.max(state.total, remaining + seconds) }),
    toggle: () => (state.paused ? write({ ...state, end: Date.now() + state.paused * 1000, paused: 0 }) : write({ ...state, end: 0, paused: remaining })),
    stop: () => write(IDLE),
  }
}

/** The floating rest bar, over the bottom of the screen. */
function RestBar({ rest }: { rest: ReturnType<typeof useRest> }) {
  const t = useT()
  if (!rest.active) return null
  const share = rest.total ? Math.min(1, rest.remaining / rest.total) : 0
  return (
    <div className="to-restbar" role="timer" aria-live="polite">
      <div className="to-restbar__progress" style={{ width: `${share * 100}%` }} />
      <div className="to-restbar__time">
        <strong>{clock(rest.remaining)}</strong>
        <span>{rest.label || t('rest.label')}</span>
      </div>
      <div className="to-restbar__actions">
        <button type="button" className="to-restbar__btn" onClick={() => rest.add(-15)}>
          −15s
        </button>
        <button type="button" className="to-restbar__btn" onClick={() => rest.add(15)}>
          +15s
        </button>
        <button type="button" className="to-restbar__btn" aria-label={rest.paused ? t('rest.resume') : t('rest.pause')} onClick={rest.toggle}>
          {rest.paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button type="button" className="to-restbar__skip" onClick={rest.stop}>
          {t('rest.skip')}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * One set
 * ------------------------------------------------------------------ */

function typeTag(set: LoggedSet, workNumber: number): string {
  if (set.type === 'warmup') return 'A'
  if (set.type === 'drop') return 'D'
  if (set.type === 'restpause') return 'RP'
  return String(workNumber)
}

function SetRow({
  entry,
  set,
  index,
  workNumber,
  effort,
  step,
  record,
  onChange,
  onRemove,
}: {
  entry: Entry
  set: LoggedSet
  index: number
  workNumber: number
  effort: 'none' | 'rir' | 'rpe'
  step: number
  record: boolean
  onChange: (patch: Partial<LoggedSet>) => void
  onRemove: () => void
}) {
  const t = useT()
  const nextType = () => TYPE_ORDER[(TYPE_ORDER.indexOf(set.type) + 1) % TYPE_ORDER.length]
  return (
    <div className={`to-set${set.done ? ' is-done' : ''}${set.type === 'warmup' ? ' is-warmup' : ''}`}>
      <div className="to-set__row">
        <button
          type="button"
          className="to-set__tag"
          title={t(`set.type.${set.type}`)}
          aria-label={t('set.changeType', { type: t(`set.type.${set.type}`) })}
          onClick={() => onChange({ type: nextType() })}
        >
          {typeTag(set, workNumber)}
        </button>

        {(entry.kind === 'weight' || entry.kind === 'bodyweight') && (
          <>
            <Stepper value={set.weight} step={step} label={t(entry.kind === 'bodyweight' ? 'set.extra' : 'set.weight')} onCommit={(weight) => onChange({ weight })} />
            <Stepper value={set.reps} step={1} decimals={false} label={t('set.reps')} onCommit={(reps) => onChange({ reps })} />
          </>
        )}
        {entry.kind === 'time' && (
          <Stepper value={set.seconds} step={5} decimals={false} label={t('set.seconds')} onCommit={(seconds) => onChange({ seconds })} />
        )}
        {entry.kind === 'cardio' && (
          <>
            <Stepper
              value={set.seconds === null ? null : Math.round((set.seconds / 60) * 10) / 10}
              step={1}
              label={t('set.minutes')}
              onCommit={(minutes) => onChange({ seconds: minutes === null ? null : Math.round(minutes * 60) })}
            />
            <Stepper value={set.speed} step={0.5} label={t('set.speed')} onCommit={(speed) => onChange({ speed })} />
          </>
        )}
        {effort !== 'none' && (
          <div className="to-set__effort">
            <NumberInput value={set.effort} label={t(`set.effort.${effort}`)} onCommit={(value) => onChange({ effort: value })} />
          </div>
        )}

        <button
          type="button"
          className={`to-set__done${set.done ? ' is-on' : ''}`}
          aria-pressed={set.done}
          aria-label={t(set.done ? 'set.undo' : 'set.done', { n: index + 1 })}
          onClick={() => onChange({ done: !set.done })}
        >
          {set.done && <Check size={16} />}
        </button>
        <button type="button" className="to-set__remove" aria-label={t('set.remove')} onClick={onRemove}>
          <X size={13} />
        </button>
      </div>
      {record && (
        <p className="to-set__note to-set__note--record">
          <Trophy size={13} /> {t('set.recordLine', { kg: estimateOneRepMax(set.weight, set.reps) })}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * One exercise
 * ------------------------------------------------------------------ */

interface EntryActions {
  onUpdate: (change: (entry: Entry) => Entry) => void
  onSetDone: (setIndex: number) => void
  onMove: (delta: -1 | 1) => void
  onSwap: () => void
  onRemove: () => void
  onSuperset: () => void
}

function EntryMenu({ index, count, linked, actions }: { index: number; count: number; linked: boolean; actions: EntryActions }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  return (
    <div className="to-menu">
      <button type="button" className="to-iconbutton" aria-label={t('entry.menu')} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="to-menu__list" role="menu">
          <button type="button" role="menuitem" onClick={run(actions.onSwap)}>
            <Repeat size={14} /> {t('entry.swap')}
          </button>
          {index < count - 1 && (
            <button type="button" role="menuitem" onClick={run(actions.onSuperset)}>
              <Link2 size={14} /> {t(linked ? 'entry.unlink' : 'entry.supersetToggle')}
            </button>
          )}
          {index > 0 && (
            <button type="button" role="menuitem" onClick={run(() => actions.onMove(-1))}>
              <ArrowUp size={14} /> {t('entry.up')}
            </button>
          )}
          {index < count - 1 && (
            <button type="button" role="menuitem" onClick={run(() => actions.onMove(1))}>
              <ArrowDown size={14} /> {t('entry.down')}
            </button>
          )}
          <button type="button" role="menuitem" className="is-danger" onClick={run(actions.onRemove)}>
            <Trash2 size={14} /> {t('entry.remove')}
          </button>
        </div>
      )}
    </div>
  )
}

function planLine(entry: Entry): string {
  const work = entry.sets.filter((s) => s.type !== 'warmup')
  if (work.length === 0) return ''
  const first = work[0]
  const target = entry.kind === 'time' ? `${first.seconds ?? '—'}s` : entry.kind === 'cardio' ? `${Math.round((first.seconds ?? 0) / 60)} min` : String(first.reps ?? '—')
  return `${work.length} × ${target}`
}

function lastLine(entry?: Entry): string {
  if (!entry) return ''
  return entry.sets
    .filter((s) => s.type !== 'warmup' && s.done)
    .map((s) =>
      entry.kind === 'time'
        ? `${s.seconds ?? 0}s`
        : entry.kind === 'cardio'
          ? `${Math.round((s.seconds ?? 0) / 60)} min`
          : s.weight
            ? `${fmt(s.weight)}×${s.reps ?? 0}${s.effort !== null ? ` (${fmt(s.effort)})` : ''}`
            : `${s.reps ?? 0}`,
    )
    .join(', ')
}

function EntryCard({
  entry,
  def,
  index,
  count,
  before,
  last,
  effort,
  step,
  linked,
  showMedia,
  actions,
}: {
  entry: Entry
  def?: ExerciseDef
  index: number
  count: number
  before: Best
  last?: Entry
  effort: 'none' | 'rir' | 'rpe'
  step: number
  linked: boolean
  showMedia: boolean
  actions: EntryActions
}) {
  const t = useT()
  const [info, setInfo] = useState(false)
  const { onUpdate, onSetDone } = actions
  const setSet = (i: number, patch: Partial<LoggedSet>) => {
    onUpdate((e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
    if (patch.done === true) onSetDone(i)
  }
  const addSet = () =>
    onUpdate((e) => {
      const lastSet = e.sets.filter((s) => s.type !== 'warmup').at(-1) ?? e.sets.at(-1)
      const fresh: LoggedSet = lastSet
        ? { ...lastSet, type: lastSet.type === 'warmup' ? 'normal' : lastSet.type, done: false, effort: null }
        : { type: 'normal', weight: null, reps: null, seconds: null, speed: null, effort: null, done: false }
      return { ...e, sets: [...e.sets, fresh] }
    })
  const canWarm = entry.kind === 'weight' && entry.sets.some((s) => s.type !== 'warmup' && s.weight) && !entry.sets.some((s) => s.type === 'warmup')
  const previous = lastLine(last)
  let work = 0

  return (
    <article className={`to-exercise${showMedia && def ? ' to-exercise--card' : ''}`}>
      {showMedia && def && (
        <div className="to-exercise__media">
          <ExerciseMedia exercise={def} size="large" />
        </div>
      )}

      <div className="to-exercise__info">
        <header className="to-exercise__head">
          {!showMedia && def && (
            <button type="button" className="to-entry__pic" aria-label={t('entry.howTo', { name: def.name })} onClick={() => setInfo(true)}>
              <ExerciseMedia exercise={def} size="thumb" />
            </button>
          )}
          <h2 className="to-exercise__name">{entry.name}</h2>
          {def && (
            <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.howTo', { name: def.name })} title={t('entry.howToShort')} onClick={() => setInfo(true)}>
              <Info size={15} />
            </button>
          )}
          <EntryMenu index={index} count={count} linked={linked} actions={actions} />
        </header>
        <div className="to-exercise__tags">
          {def && <span className="to-tag">{muscleLabel(def.muscle)}</span>}
          {def && <span className="to-tag">{equipmentLabel(def.equipment)}</span>}
          {before.oneRepMax > 0 && <span className="to-tag">{t('entry.best', { kg: before.oneRepMax })}</span>}
          {entry.superset && <Badge tone="accent">{t('entry.superset', { letter: entry.superset })}</Badge>}
        </div>
        {planLine(entry) && <p className="to-exercise__line">{t('entry.plan', { plan: planLine(entry) })}</p>}
        {previous && <p className="to-exercise__line">{t('entry.last', { sets: previous })}</p>}
      </div>

      <div className="to-sets">
        <div className="to-sets__head" aria-hidden>
          <span />
          {(entry.kind === 'weight' || entry.kind === 'bodyweight') && (
            <>
              <span>{t(entry.kind === 'bodyweight' ? 'head.extra' : 'head.weight')}</span>
              <span>{t('head.reps')}</span>
            </>
          )}
          {entry.kind === 'time' && <span>{t('head.seconds')}</span>}
          {entry.kind === 'cardio' && (
            <>
              <span>{t('head.minutes')}</span>
              <span>{t('head.speed')}</span>
            </>
          )}
          {effort !== 'none' && <span>{effort.toUpperCase()}</span>}
        </div>
        {entry.sets.map((set, i) => {
          if (set.type === 'normal') work++
          return (
            <SetRow
              key={i}
              entry={entry}
              set={set}
              index={i}
              workNumber={work}
              effort={effort}
              step={step}
              record={isRecord(set, entry.kind, before)}
              onChange={(patch) => setSet(i, patch)}
              onRemove={() => onUpdate((e) => ({ ...e, sets: e.sets.filter((_, j) => j !== i) }))}
            />
          )
        })}
        <div className="to-sets__foot">
          <button type="button" className="to-linkbutton" onClick={addSet}>
            <Plus size={14} /> {t('set.add')}
          </button>
          {canWarm && (
            <button
              type="button"
              className="to-linkbutton"
              onClick={() =>
                onUpdate((e) => {
                  const first = e.sets.find((x) => x.type !== 'warmup' && x.weight)
                  return first && !e.sets.some((x) => x.type === 'warmup') ? { ...e, sets: [...warmupFor(first.weight!, step), ...e.sets] } : e
                })
              }
            >
              <Flame size={14} /> {t('entry.warmup')}
            </button>
          )}
          <label className="to-inline-field to-sets__rest">
            <span className="to-muted">{t('entry.rest')}</span>
            <select
              className="to-field__input"
              value={entry.rest}
              aria-label={t('entry.rest')}
              onChange={(ev) => {
                const rest = Number(ev.target.value)
                onUpdate((e) => ({ ...e, rest }))
              }}
            >
              {REST_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? t('entry.noRest') : clock(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {info && def && <ExerciseSheet exercise={def} onClose={() => setInfo(false)} />}
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * The workout
 * ------------------------------------------------------------------ */

const entryDone = (entry: Entry) => entry.sets.length > 0 && entry.sets.filter((s) => s.type !== 'warmup').every((s) => s.done)

/**
 * Logs a workout. One exercise at a time, with its picture, last time and
 * a −/+ stepper per value; or every exercise in a list. Live, it times the
 * rest between sets, keeps the screen on and marks records as they happen;
 * editing a past workout uses the same screen.
 */
export function WorkoutLog({ record, live, onFinished }: { record: Envelope<Session>; live: boolean; onFinished?: () => void }) {
  const t = useT()
  const { update, remove } = useCollection<Session>('sessions')
  const index = useExerciseIndex()
  const all = useSessions()
  const [settings, setSettings] = useTrainingSettings()
  const rest = useRest(record.id, settings.sound)
  const [browsing, setBrowsing] = useState<{ mode: 'add' } | { mode: 'swap'; at: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [current, setCurrent] = useState(0)
  const [menu, setMenu] = useState(false)
  const view = settings.view
  useWakeLock(live)

  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [live])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const session = record.data
  const others = useMemo(() => withIds(all).filter((s) => s.id !== record.id && s.finishedAt), [all, record.id])
  const entries = session.entries
  const at = Math.min(current, Math.max(entries.length - 1, 0))

  // Changes apply to the newest entries, not to the ones this render saw:
  // a load typed and then the reps, one right after the other, must both
  // stay. While a write is on its way, the stored copy is not adopted yet.
  const latest = useRef(entries)
  const pending = useRef(0)
  useEffect(() => {
    if (pending.current === 0) latest.current = entries
  }, [entries])
  const mutate = (change: (list: Entry[]) => Entry[]) => {
    const next = change(latest.current)
    latest.current = next
    pending.current++
    void update(record.id, { entries: next }).finally(() => {
      pending.current--
    })
  }

  const onSetDone = (entryIndex: number, setIndex: number) => {
    const list = latest.current
    const entry = list[entryIndex]
    const set = entry.sets[setIndex]
    const before = bestOf(others, entry)
    if (isRecord({ ...set, done: true }, entry.kind, before)) {
      const value = entry.kind === 'weight' ? t('toast.oneRm', { kg: estimateOneRepMax(set.weight, set.reps) }) : ''
      setToast(t('toast.record', { name: entry.name, detail: value }))
    }
    if (!live) return
    // In a superset, rest comes after the last exercise of the group.
    const group = entry.superset
    const nextInGroup = group && list[entryIndex + 1]?.superset === group
    if (nextInGroup && view === 'cards') setCurrent(entryIndex + 1)
    if (nextInGroup) return
    const nextSet = entry.sets.findIndex((s, i) => i > setIndex && !s.done)
    const nextEntry = list.findIndex((e, i) => i > entryIndex && !entryDone(e))
    const label =
      nextSet >= 0
        ? t('rest.nextSet', { n: nextSet + 1, name: entry.name })
        : nextEntry >= 0
          ? t('rest.nextExercise', { name: list[nextEntry].name })
          : t('rest.last')
    rest.start(entry.rest, label)
    // With the exercise finished, the card moves on to the next one to do.
    if (nextSet < 0 && nextEntry >= 0 && view === 'cards') window.setTimeout(() => setCurrent(nextEntry), 600)
  }

  const add = (exercise: ExerciseDef, plan: ExercisePlan) => mutate((list) => [...list, entryFromPlan(exercise, plan, others, settings.rest)])
  const swap = (target: number, exercise: ExerciseDef, plan: ExercisePlan) => {
    mutate((list) => list.map((e, i) => (i === target ? entryFromPlan(exercise, plan, others, settings.rest, e) : e)))
    setBrowsing(null)
  }
  const move = (target: number, delta: -1 | 1) => {
    mutate((list) => {
      const next = [...list]
      const [item] = next.splice(target, 1)
      next.splice(target + delta, 0, item)
      return next
    })
    setCurrent(target + delta)
  }
  const toggleSuperset = (target: number) =>
    mutate((list) => {
      const a = list[target]
      const b = list[target + 1]
      if (!a || !b) return list
      if (a.superset && a.superset === b.superset) return list.map((e, i) => (i === target || i === target + 1 ? { ...e, superset: null } : e))
      const used = new Set(list.map((e) => e.superset).filter(Boolean))
      const letter = a.superset ?? b.superset ?? 'ABCDEFGH'.split('').find((l) => !used.has(l)) ?? 'Z'
      return list.map((e, i) => (i === target || i === target + 1 ? { ...e, superset: letter } : e))
    })

  const elapsed = session.startedAt ? (now - Date.parse(session.startedAt)) / 1000 : 0
  const total = entries.reduce((sum, e) => sum + e.sets.filter((s) => s.type !== 'warmup').length, 0)
  const done = doneSets(session)
  const muscles = [...new Set(entries.map((e) => index.get(e.exerciseId)?.muscle).filter(Boolean))] as Muscle[]

  const card = (entry: Entry, i: number, showMedia: boolean) => (
    <EntryCard
      key={`${i}-${entry.exerciseId ?? entry.name}`}
      entry={entry}
      def={index.get(entry.exerciseId)}
      index={i}
      count={entries.length}
      before={bestOf(others, entry)}
      last={lastEntry(others, entry)}
      effort={settings.effort}
      step={weightStep()}
      showMedia={showMedia}
      linked={Boolean(entry.superset && entries[i + 1]?.superset === entry.superset)}
      actions={{
        onUpdate: (change) => mutate((list) => list.map((e, j) => (j === i ? change(e) : e))),
        onSetDone: (setIndex) => onSetDone(i, setIndex),
        onMove: (delta) => move(i, delta),
        onSwap: () => setBrowsing({ mode: 'swap', at: i }),
        onRemove: () => mutate((list) => list.filter((_, j) => j !== i)),
        onSuperset: () => toggleSuperset(i),
      }}
    />
  )

  const finish = async () => {
    rest.stop()
    await update(record.id, { finishedAt: new Date().toISOString() })
    onFinished?.()
  }

  return (
    <div className={`to-workout${live ? ' is-live' : ''}`}>
      <header className="to-workout__bar">
        <div className="to-workout__title">
          <input
            className="to-workout__name"
            defaultValue={session.name}
            aria-label={t('workout.name')}
            onBlur={(e) => e.target.value.trim() && e.target.value !== session.name && void update(record.id, { name: e.target.value.trim() })}
          />
          <span className="to-workout__sub">
            {live ? `${clock(elapsed)} · ` : ''}
            {t('workout.sets', { done, total })}
          </span>
        </div>
        <div className="to-menu">
          <button type="button" className="to-iconbutton" aria-label={t('workout.menu')} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div className="to-menu__list" role="menu">
              <button type="button" role="menuitem" onClick={() => (setMenu(false), void setSettings({ view: view === 'cards' ? 'list' : 'cards' }))}>
                {view === 'cards' ? <LayoutList size={14} /> : <RectangleHorizontal size={14} />}
                {t(view === 'cards' ? 'workout.viewList' : 'workout.viewCards')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setMenu(false)
                  if (confirm(t(live ? 'workout.discardConfirm' : 'workout.deleteConfirm'))) void remove(record.id).then(onFinished)
                }}
              >
                <Trash2 size={14} /> {t(live ? 'workout.discard' : 'workout.delete')}
              </button>
            </div>
          )}
        </div>
        {live && (
          <button type="button" className="to-pill" onClick={() => void finish()}>
            {t('workout.finish')}
          </button>
        )}
      </header>

      <div className="to-workout__progress">
        <div className="to-workout__track">
          <div className="to-workout__fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <span>{sessionVolume(session).toLocaleString('pt-BR')} kg</span>
      </div>

      {!live && (
        <label className="to-inline-field">
          <span className="to-muted">{t('workout.date')}</span>
          <input type="date" className="to-field__input" value={session.date} onChange={(e) => e.target.value && void update(record.id, { date: e.target.value })} />
        </label>
      )}

      {entries.length > 0 && (
        <nav className="to-workout__pager" aria-label={t('workout.exercises')}>
          <div className="to-workout__dots">
            {entries.map((entry, i) => (
              <button
                key={i}
                type="button"
                className={`to-dot${i === at && view === 'cards' ? ' is-current' : ''}${entryDone(entry) ? ' is-done' : ''}`}
                aria-label={entry.name}
                title={entry.name}
                onClick={() => (view === 'cards' ? setCurrent(i) : document.getElementById(`entry-${i}`)?.scrollIntoView({ behavior: 'smooth' }))}
              >
                {entryDone(entry) ? <Check size={12} /> : i + 1}
              </button>
            ))}
          </div>
          {muscles.length > 0 && <BodyMap primary={muscles} size="tiny" />}
        </nav>
      )}

      {toast && (
        <div className="to-toast" role="status">
          <Trophy size={16} />
          {toast}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState title={t('workout.empty')} body={t('workout.emptyBody')} />
      ) : view === 'cards' ? (
        <>
          {card(entries[at], at, true)}
          <div className="to-workout__nav">
            <button type="button" className="to-linkbutton" disabled={at === 0} onClick={() => setCurrent(at - 1)}>
              <ChevronLeft size={16} /> {t('workout.prev')}
            </button>
            <button type="button" className="to-linkbutton to-linkbutton--strong" disabled={at >= entries.length - 1} onClick={() => setCurrent(at + 1)}>
              {t('workout.next')} <ChevronRight size={16} />
            </button>
          </div>
        </>
      ) : (
        entries.map((entry, i) => (
          <div key={`${i}-${entry.exerciseId ?? entry.name}`} id={`entry-${i}`}>
            {card(entry, i, false)}
          </div>
        ))
      )}

      <div className="to-workout__extras">
        {browsing ? (
          <ExerciseBrowser
            key={browsing.mode === 'swap' ? `swap-${browsing.at}` : 'add'}
            title={browsing.mode === 'add' ? t('workout.addExercise') : t('entry.swapTitle', { name: entries[browsing.at]?.name ?? '' })}
            startMuscle={browsing.mode === 'swap' ? index.get(entries[browsing.at]?.exerciseId ?? null)?.muscle : undefined}
            onClose={() => setBrowsing(null)}
            action={
              browsing.mode === 'add'
                ? { label: t('workout.addToWorkout'), withDays: false, keepOpen: true, onAdd: add }
                : { label: t('entry.swapTo'), withDays: false, keepOpen: false, onAdd: (exercise, plan) => swap(browsing.at, exercise, plan) }
            }
          />
        ) : (
          <button type="button" className="to-rowlink" onClick={() => setBrowsing({ mode: 'add' })}>
            <Plus size={16} /> {t('workout.addExercise')}
          </button>
        )}
        <textarea
          className="to-field__input"
          rows={2}
          defaultValue={session.note}
          placeholder={t('workout.note')}
          aria-label={t('workout.note')}
          onBlur={(e) => e.target.value !== session.note && void update(record.id, { note: e.target.value })}
        />
      </div>

      {live && (
        <Button variant="primary" onClick={() => void finish()}>
          <Check size={15} />
          {t('workout.finish')}
        </Button>
      )}

      {live && <RestBar rest={rest} />}

    </div>
  )
}
