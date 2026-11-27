import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Flame,
  Link2,
  Plus,
  Repeat,
  SkipForward,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { Badge, Button, EmptyState, useCollection, useT, type Envelope } from '@core/api'
import { muscleLabel, type ExerciseDef } from './catalog'
import { useExerciseIndex, useSessions, useTrainingSettings, withIds } from './data'
import { bestOf, clock, doneSets, entryFor, estimateOneRepMax, isRecord, sessionVolume, warmupFor, type Best } from './logic'
import { ExercisePicker } from './picker'
import type { Entry, LoggedSet, Session, SetType } from './schema'

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]
const TYPE_ORDER: SetType[] = ['normal', 'warmup', 'drop', 'restpause']

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */

interface NumberInputProps {
  value: number | null
  onCommit: (value: number | null) => void
  label: string
  suffix?: string
  decimals?: boolean
}

/**
 * A number field that saves when it loses focus or on Enter, so typing
 * does not write on every key. Keyed by the stored value: when the value
 * changes elsewhere (a copied set, a sync), the field starts over from it.
 */
function NumberInput(props: NumberInputProps) {
  const shown = props.value === null ? '' : String(props.value).replace('.', ',')
  return <NumberField key={shown} shown={shown} {...props} />
}

function NumberField({ value, onCommit, label, suffix, decimals = true, shown }: NumberInputProps & { shown: string }) {
  const [text, setText] = useState(shown)
  // Reads what is in the box when leaving it, not the last rendered text.
  const commit = (raw: string) => {
    const clean = raw.trim().replace(',', '.')
    const parsed = clean === '' ? null : Number(clean)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return setText(shown)
    const next = parsed === null ? null : decimals ? Math.round(parsed * 100) / 100 : Math.round(parsed)
    if (next !== value) onCommit(next)
  }
  return (
    <label className="to-setinput">
      <input
        className="to-field__input"
        inputMode={decimals ? 'decimal' : 'numeric'}
        value={text}
        aria-label={label}
        placeholder="—"
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      {suffix && <span className="to-setinput__suffix">{suffix}</span>}
    </label>
  )
}

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

/** The rest countdown. Its end time is kept per session, so it survives leaving the screen. */
function useRest(sessionId: string, sound: boolean) {
  const key = `teorganiza.rest.${sessionId}`
  const read = () => {
    try {
      return Number(sessionStorage.getItem(key)) || 0
    } catch {
      return 0
    }
  }
  const [end, setEnd] = useState(read)
  const [now, setNow] = useState(() => Date.now())
  const write = (value: number) => {
    setEnd(value)
    try {
      if (value) sessionStorage.setItem(key, String(value))
      else sessionStorage.removeItem(key)
    } catch {
      // Without storage the timer lives only on this screen.
    }
  }
  useEffect(() => {
    if (!end) return
    const timer = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= end) {
        if (sound) beep()
        write(0)
      }
    }, 250)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, sound])
  return {
    remaining: end ? Math.max(0, (end - now) / 1000) : 0,
    start: (seconds: number) => seconds > 0 && write(Date.now() + seconds * 1000),
    add: (seconds: number) => end && write(Math.max(Date.now() + 1000, end + seconds * 1000)),
    stop: () => write(0),
  }
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
  record,
  onChange,
  onRemove,
}: {
  entry: Entry
  set: LoggedSet
  index: number
  workNumber: number
  effort: 'none' | 'rir' | 'rpe'
  record: boolean
  onChange: (patch: Partial<LoggedSet>) => void
  onRemove: () => void
}) {
  const t = useT()
  const nextType = () => TYPE_ORDER[(TYPE_ORDER.indexOf(set.type) + 1) % TYPE_ORDER.length]
  return (
    <div className={`to-setrow${set.done ? ' is-done' : ''}${set.type === 'warmup' ? ' is-warmup' : ''}`}>
      <button
        type="button"
        className="to-setrow__tag"
        title={t(`set.type.${set.type}`)}
        aria-label={t('set.changeType', { type: t(`set.type.${set.type}`) })}
        onClick={() => onChange({ type: nextType() })}
      >
        {typeTag(set, workNumber)}
      </button>

      {(entry.kind === 'weight' || entry.kind === 'bodyweight') && (
        <>
          <NumberInput value={set.weight} label={t(entry.kind === 'bodyweight' ? 'set.extra' : 'set.weight')} suffix="kg" onCommit={(weight) => onChange({ weight })} />
          <NumberInput value={set.reps} label={t('set.reps')} suffix={entry.perSide ? t('set.perSide') : t('set.repsShort')} decimals={false} onCommit={(reps) => onChange({ reps })} />
        </>
      )}
      {entry.kind === 'time' && (
        <NumberInput value={set.seconds} label={t('set.seconds')} suffix="s" decimals={false} onCommit={(seconds) => onChange({ seconds })} />
      )}
      {entry.kind === 'cardio' && (
        <>
          <NumberInput
            value={set.seconds === null ? null : Math.round((set.seconds / 60) * 10) / 10}
            label={t('set.minutes')}
            suffix="min"
            onCommit={(minutes) => onChange({ seconds: minutes === null ? null : Math.round(minutes * 60) })}
          />
          <NumberInput value={set.speed} label={t('set.speed')} suffix="km/h" onCommit={(speed) => onChange({ speed })} />
        </>
      )}
      {effort !== 'none' && (
        <NumberInput value={set.effort} label={t(`set.effort.${effort}`)} suffix={effort.toUpperCase()} onCommit={(value) => onChange({ effort: value })} />
      )}

      <span className="to-setrow__end">
        {record && (
          <span className="to-setrow__record" title={t('set.record')}>
            <Trophy size={14} />
          </span>
        )}
        <button
          type="button"
          className={`to-setrow__done${set.done ? ' is-on' : ''}`}
          aria-pressed={set.done}
          aria-label={t(set.done ? 'set.undo' : 'set.done', { n: index + 1 })}
          onClick={() => onChange({ done: !set.done })}
        >
          <Check size={15} />
        </button>
        <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('set.remove')} onClick={onRemove}>
          <X size={13} />
        </button>
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * One exercise
 * ------------------------------------------------------------------ */

function EntryCard({
  entry,
  def,
  index,
  count,
  before,
  effort,
  step,
  onUpdate,
  onSetDone,
  onMove,
  onSwap,
  onRemove,
  onSuperset,
  linkedToNext,
}: {
  entry: Entry
  def?: ExerciseDef
  index: number
  count: number
  before: Best
  effort: 'none' | 'rir' | 'rpe'
  step: number
  onUpdate: (change: (entry: Entry) => Entry) => void
  onSetDone: (setIndex: number) => void
  onMove: (delta: -1 | 1) => void
  onSwap: () => void
  onRemove: () => void
  onSuperset: () => void
  linkedToNext: boolean
}) {
  const t = useT()
  const setSet = (i: number, patch: Partial<LoggedSet>) => {
    onUpdate((e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
    if (patch.done === true) onSetDone(i)
  }
  const addSet = () =>
    onUpdate((e) => {
      const last = e.sets.filter((s) => s.type !== 'warmup').at(-1) ?? e.sets.at(-1)
      const fresh: LoggedSet = last
        ? { ...last, type: last.type === 'warmup' ? 'normal' : last.type, done: false, effort: null }
        : { type: 'normal', weight: null, reps: null, seconds: null, speed: null, effort: null, done: false }
      return { ...e, sets: [...e.sets, fresh] }
    })
  const firstWork = entry.sets.find((s) => s.type !== 'warmup' && s.weight)
  const canWarm = entry.kind === 'weight' && Boolean(firstWork) && !entry.sets.some((s) => s.type === 'warmup')
  let work = 0

  return (
    <article className="to-entry">
      <header className="to-entry__header">
        <div className="to-entry__title">
          <strong>{entry.name}</strong>
          <span className="to-list__meta">
            {def && <span>{muscleLabel(def.muscle)}</span>}
            {entry.superset && <Badge tone="accent">{t('entry.superset', { letter: entry.superset })}</Badge>}
            {before.oneRepMax > 0 && <span>{t('entry.best', { kg: before.oneRepMax })}</span>}
          </span>
        </div>
        <div className="to-toolbar to-toolbar--tight">
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.up')} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp size={14} />
          </button>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.down')} disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown size={14} />
          </button>
          {index < count - 1 && (
            <button type="button" className={`to-iconbutton to-iconbutton--small${linkedToNext ? ' active' : ''}`} aria-label={t('entry.supersetToggle')} title={t('entry.supersetToggle')} onClick={onSuperset}>
              <Link2 size={14} />
            </button>
          )}
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.swap')} title={t('entry.swap')} onClick={onSwap}>
            <Repeat size={14} />
          </button>
          <button type="button" className="to-iconbutton to-iconbutton--small" aria-label={t('entry.remove')} title={t('entry.remove')} onClick={onRemove}>
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      <div className="to-entry__sets">
        {entry.sets.map((set, i) => {
          if (set.type === 'normal') work++
          const record = isRecord(set, entry.kind, before)
          return (
            <SetRow
              key={i}
              entry={entry}
              set={set}
              index={i}
              workNumber={work}
              effort={effort}
              record={record}
              onChange={(patch) => setSet(i, patch)}
              onRemove={() => onUpdate((e) => ({ ...e, sets: e.sets.filter((_, j) => j !== i) }))}
            />
          )
        })}
      </div>

      <footer className="to-toolbar to-toolbar--tight">
        <Button variant="ghost" onClick={addSet}>
          <Plus size={14} />
          {t('set.add')}
        </Button>
        {canWarm && (
          <Button
            variant="ghost"
            onClick={() =>
              onUpdate((e) => {
                const work = e.sets.find((x) => x.type !== 'warmup' && x.weight)
                return work && !e.sets.some((x) => x.type === 'warmup') ? { ...e, sets: [...warmupFor(work.weight!, step), ...e.sets] } : e
              })
            }
          >
            <Flame size={14} />
            {t('entry.warmup')}
          </Button>
        )}
        <label className="to-inline-field">
          <span className="to-muted">{t('entry.rest')}</span>
          <select className="to-field__input" value={entry.rest} aria-label={t('entry.rest')} onChange={(ev) => onUpdate((e) => ({ ...e, rest: Number(ev.target.value) }))}>
            {REST_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t('entry.noRest') : clock(s)}
              </option>
            ))}
          </select>
        </label>
      </footer>
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * The workout
 * ------------------------------------------------------------------ */

/**
 * Logs a workout set by set. Live, it times the rest between sets, keeps
 * the screen on and marks records as they happen; when editing a past
 * workout, the same screen corrects it.
 */
export function WorkoutLog({ record, live, onFinished }: { record: Envelope<Session>; live: boolean; onFinished?: () => void }) {
  const t = useT()
  const { update, remove } = useCollection<Session>('sessions')
  const index = useExerciseIndex()
  const all = useSessions()
  const [settings] = useTrainingSettings()
  const rest = useRest(record.id, settings.sound)
  const [picking, setPicking] = useState<{ mode: 'add' } | { mode: 'swap'; at: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
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

  // Changes apply to the newest entries, not to the ones this render saw:
  // a load typed and then the reps, one right after the other, must both
  // stay. While a write is on its way, the stored copy is not adopted yet.
  const latest = useRef(entries)
  const pending = useRef(0)
  useEffect(() => {
    if (pending.current === 0) latest.current = entries
  }, [entries])
  const mutate = (change: (current: Entry[]) => Entry[]) => {
    const next = change(latest.current)
    latest.current = next
    pending.current++
    void update(record.id, { entries: next }).finally(() => {
      pending.current--
    })
  }

  const onSetDone = (entryIndex: number, setIndex: number) => {
    const current = latest.current
    const entry = current[entryIndex]
    const set = entry.sets[setIndex]
    const before = bestOf(others, entry)
    if (isRecord({ ...set, done: true }, entry.kind, before)) {
      const value = entry.kind === 'weight' ? t('toast.oneRm', { kg: estimateOneRepMax(set.weight, set.reps) }) : ''
      setToast(t('toast.record', { name: entry.name, detail: value }))
    }
    // In a superset, rest comes after the last exercise of the group.
    const group = entry.superset
    const nextInGroup = group && current[entryIndex + 1]?.superset === group
    if (live && !nextInGroup) rest.start(entry.rest)
  }

  const add = (exercise: ExerciseDef) => {
    mutate((list) => [...list, entryFor(exercise, others, undefined, settings.rest)])
    setPicking(null)
  }
  const swap = (at: number, exercise: ExerciseDef) => {
    mutate((list) =>
      list.map((e, i) => (i === at ? { ...entryFor(exercise, others, undefined, e.rest), superset: e.superset } : e)),
    )
    setPicking(null)
  }
  const move = (at: number, delta: -1 | 1) =>
    mutate((list) => {
      const next = [...list]
      const [item] = next.splice(at, 1)
      next.splice(at + delta, 0, item)
      return next
    })
  const toggleSuperset = (at: number) =>
    mutate((list) => {
      const a = list[at]
      const b = list[at + 1]
      if (!a || !b) return list
      if (a.superset && a.superset === b.superset) {
        return list.map((e, i) => (i === at || i === at + 1 ? { ...e, superset: null } : e))
      }
      const used = new Set(list.map((e) => e.superset).filter(Boolean))
      const letter = a.superset ?? b.superset ?? 'ABCDEFGH'.split('').find((l) => !used.has(l)) ?? 'Z'
      return list.map((e, i) => (i === at || i === at + 1 ? { ...e, superset: letter } : e))
    })

  const elapsed = session.startedAt ? (now - Date.parse(session.startedAt)) / 1000 : 0
  const total = entries.reduce((sum, e) => sum + e.sets.filter((s) => s.type !== 'warmup').length, 0)

  return (
    <div className="to-stack">
      <section className="to-workout__head">
        <div className="to-toolbar">
          <input
            className="to-field__input to-workout__name"
            defaultValue={session.name}
            aria-label={t('workout.name')}
            onBlur={(e) => e.target.value.trim() && e.target.value !== session.name && void update(record.id, { name: e.target.value.trim() })}
          />
          {!live && (
            <input type="date" className="to-field__input" value={session.date} aria-label={t('workout.date')} onChange={(e) => e.target.value && void update(record.id, { date: e.target.value })} />
          )}
        </div>
        <div className="to-workout__stats">
          {live && <span>{clock(elapsed)}</span>}
          <span>{t('workout.volume', { kg: sessionVolume(session).toLocaleString('pt-BR') })}</span>
          <span>{t('workout.sets', { done: doneSets(session), total })}</span>
        </div>
      </section>

      {live && rest.remaining > 0 && (
        <div className="to-rest" role="timer" aria-live="polite">
          <span className="to-rest__label">{t('rest.label')}</span>
          <strong className="to-rest__time">{clock(rest.remaining)}</strong>
          <span className="to-toolbar to-toolbar--tight">
            <Button variant="ghost" onClick={() => rest.add(-15)}>−15s</Button>
            <Button variant="ghost" onClick={() => rest.add(15)}>+15s</Button>
            <Button onClick={rest.stop}>
              <SkipForward size={14} />
              {t('rest.skip')}
            </Button>
          </span>
        </div>
      )}

      {toast && (
        <div className="to-toast" role="status">
          <Trophy size={16} />
          {toast}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState title={t('workout.empty')} body={t('workout.emptyBody')} />
      ) : (
        entries.map((entry, i) => (
          <EntryCard
            key={`${i}-${entry.exerciseId ?? entry.name}`}
            entry={entry}
            def={index.get(entry.exerciseId)}
            index={i}
            count={entries.length}
            before={bestOf(others, entry)}
            effort={settings.effort}
            step={settings.step}
            linkedToNext={Boolean(entry.superset && entries[i + 1]?.superset === entry.superset)}
            onUpdate={(change) => mutate((list) => list.map((e, j) => (j === i ? change(e) : e)))}
            onSetDone={(setIndex) => onSetDone(i, setIndex)}
            onMove={(delta) => move(i, delta)}
            onSwap={() => setPicking({ mode: 'swap', at: i })}
            onRemove={() => mutate((list) => list.filter((_, j) => j !== i))}
            onSuperset={() => toggleSuperset(i)}
          />
        ))
      )}

      <div className="to-toolbar">
        <Button onClick={() => setPicking({ mode: 'add' })}>
          <Plus size={15} />
          {t('workout.addExercise')}
        </Button>
      </div>

      <textarea
        className="to-field__input"
        rows={2}
        defaultValue={session.note}
        placeholder={t('workout.note')}
        aria-label={t('workout.note')}
        onBlur={(e) => e.target.value !== session.note && void update(record.id, { note: e.target.value })}
      />

      <div className="to-toolbar">
        {live ? (
          <>
            <Button
              variant="primary"
              onClick={async () => {
                rest.stop()
                await update(record.id, { finishedAt: new Date().toISOString() })
                onFinished?.()
              }}
            >
              <Check size={15} />
              {t('workout.finish')}
            </Button>
            <Button variant="ghost" onClick={() => confirm(t('workout.discardConfirm')) && void remove(record.id)}>
              {t('workout.discard')}
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => confirm(t('workout.deleteConfirm')) && void remove(record.id).then(onFinished)}>
            <Trash2 size={15} />
            {t('workout.delete')}
          </Button>
        )}
      </div>

      {picking && (
        <ExercisePicker
          title={t(picking.mode === 'add' ? 'workout.addExercise' : 'entry.swap')}
          onClose={() => setPicking(null)}
          onPick={(exercise) => (picking.mode === 'add' ? add(exercise) : swap(picking.at, exercise))}
        />
      )}
    </div>
  )
}
