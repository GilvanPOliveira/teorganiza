import { useRef } from 'react'
import { ArrowLeft, Pencil, Printer } from 'lucide-react'
import { Button, EmptyState, toLocalISODate, useFormat, useNavigate, useT, type Envelope } from '@core/api'
import { BodyMap } from './BodyMap'
import { SHORT_DAYS, WEEK_ORDER } from './browser'
import { equipmentLabel, muscleLabel } from './catalog'
import { useExerciseIndex, useRoutines, WEEKDAYS } from './data'
import { clock } from './logic'
import { PHOTOS } from './photos'
import type { Routine, RoutineItem } from './schema'

const kg = (n: number) => `${String(n).replace('.', ',')} kg`

/** The sheet on paper: black on white, the same layout, nothing of the app around it. */
const PRINT_CSS = `
@page { margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 13px/1.35 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; background: #fff; }
.to-noprint { display: none !important; }
.to-ficha { display: flex; flex-direction: column; gap: 14px; }
.to-ficha__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 6px; }
.to-ficha__head h1 { margin: 0; font-size: 20px; }
.to-ficha__head span { color: #555; font-size: 12px; }
.to-ficha__day { break-inside: avoid; display: flex; flex-direction: column; gap: 6px; }
.to-ficha__day h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; }
.to-ficha__day h2 small { font-weight: 500; font-size: 12px; color: #555; }
.to-ficha__badge { padding: 1px 7px; border-radius: 5px; background: #111; color: #fff; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.to-ficha__list { list-style: none; margin: 0; padding: 0; border: 1px solid #bbb; border-radius: 8px; }
.to-ficha__row { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 6px 10px; break-inside: avoid; }
.to-ficha__row + .to-ficha__row { border-top: 1px solid #ddd; }
.to-ficha__pic { width: 46px; height: 46px; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: #f2f2f2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.to-ficha__pic img { width: 100%; height: 100%; object-fit: cover; }
.to-bodymap { display: flex; justify-content: center; gap: 2px; height: 42px; }
.to-bodymap__view { height: 100%; width: auto; }
.to-bodymap__part path { fill: #c8c8c8; }
.to-bodymap__part.is-secondary path { fill: #9ab; }
.to-bodymap__part.is-primary path { fill: #1d4ed8; }
.to-ficha__name { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.to-ficha__name small { color: #555; font-size: 11px; }
.to-ficha__nums { display: flex; gap: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.to-ficha__nums > span { display: flex; flex-direction: column; align-items: flex-end; min-width: 50px; }
.to-ficha__nums small { font-weight: 500; font-size: 10px; color: #555; }
`

/**
 * Prints the sheet alone, from a page of its own: the print window then
 * offers "Save as PDF", named after the sheet.
 */
function printSheet(node: HTMLElement, title: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) return frame.remove()
  const safeTitle = title.replace(/[<>&]/g, '')
  doc.open()
  doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${safeTitle}</title><base href="${location.origin}/"><style>${PRINT_CSS}</style></head><body>${node.outerHTML}</body></html>`)
  doc.close()
  const pending = [...doc.images].filter((img) => !img.complete).map((img) => new Promise((done) => {
      img.addEventListener('load', done)
      img.addEventListener('error', done)
    }))
  void Promise.all(pending).then(() => {
    win.focus()
    win.print()
    window.setTimeout(() => frame.remove(), 1000)
  })
}

function ItemRow({ item }: { item: RoutineItem }) {
  const t = useT()
  const index = useExerciseIndex()
  const def = index.get(item.exerciseId)
  const work = item.sets.filter((s) => s.type !== 'warmup')
  const first = work[0]
  const timed = def?.kind === 'time' || def?.kind === 'cardio'
  const amount = !first
    ? '—'
    : def?.kind === 'cardio'
      ? `${Math.round((first.seconds ?? 0) / 60)} min`
      : timed
        ? `${work.length} × ${first.seconds ?? '—'} s`
        : `${work.length} × ${first.reps ?? '—'}${first.repsMax ? `–${first.repsMax}` : ''}`

  return (
    <li className="to-ficha__row">
      <span className="to-ficha__pic">
        {def && PHOTOS.has(def.id) ? (
          <img src={`/exercises/${def.id}/0.jpg`} alt="" />
        ) : (
          def && <BodyMap primary={[def.muscle]} secondary={def.secondary} size="tiny" />
        )}
      </span>
      <span className="to-ficha__name">
        <strong>{def?.name ?? item.exerciseId}</strong>
        {def && (
          <small>
            {muscleLabel(def.muscle)} · {equipmentLabel(def.equipment)}
          </small>
        )}
        {item.note && <small>{item.note}</small>}
      </span>
      <span className="to-ficha__nums">
        <span>
          <small>{t('sheet.sets')}</small>
          {amount}
        </span>
        <span>
          <small>{t('sheet.weight')}</small>
          {item.weight ? kg(item.weight) : '—'}
        </span>
        <span>
          <small>{t('sheet.rest')}</small>
          {item.rest ? clock(item.rest) : '—'}
        </span>
      </span>
    </li>
  )
}

/**
 * The training sheet: every registered exercise by weekday, with its
 * picture, sets, weight and rest. Printing it, or saving it as a PDF from
 * the print window, takes it anywhere.
 */
export function SheetScreen() {
  const t = useT()
  const navigate = useNavigate()
  const format = useFormat()
  const routines = useRoutines()
  const sheet = useRef<HTMLElement>(null)

  const byDay = WEEK_ORDER.map((day) => routines.find((r) => r.data.weekday === day)).filter((r): r is Envelope<Routine> => Boolean(r && r.data.items.length))
  const loose = routines.filter((r) => r.data.weekday === null && r.data.items.length)
  const groups = [...byDay, ...loose]
  const total = groups.reduce((sum, r) => sum + r.data.items.length, 0)

  return (
    <div className="to-stack">
      <div className="to-toolbar to-noprint">
        <Button variant="ghost" onClick={() => navigate('library')}>
          <ArrowLeft size={15} />
          {t('sheet.back')}
        </Button>
        <Button variant="primary" onClick={() => sheet.current && printSheet(sheet.current, t('sheet.title'))} disabled={total === 0}>
          <Printer size={15} />
          {t('sheet.print')}
        </Button>
      </div>
      {total > 0 && <p className="to-muted to-noprint">{t('sheet.printHint')}</p>}

      <article ref={sheet} className="to-ficha">
        <header className="to-ficha__head">
          <h1>{t('sheet.title')}</h1>
          <span>
            {t('sheet.count', { count: total })} · {t('sheet.generated', { date: format.date(toLocalISODate()) })}
          </span>
        </header>

        {groups.length === 0 ? (
          <EmptyState title={t('sheet.empty')} body={t('sheet.emptyBody')} />
        ) : (
          groups.map((routine) => {
            const day = routine.data.weekday
            const dayName = day === null ? t('sheet.noDay') : WEEKDAYS[day]
            const own = routine.data.name !== t('sheet.dayRoutine', { day: dayName })
            return (
              <section key={routine.id} className="to-ficha__day">
                <h2>
                  {day !== null && <span className="to-ficha__badge">{SHORT_DAYS[day]}</span>}
                  <span>{day === null ? routine.data.name : dayName}</span>
                  {day !== null && own && <small>{routine.data.name}</small>}
                  <button type="button" className="to-plainicon to-noprint" aria-label={t('sheet.edit', { name: routine.data.name })} title={t('sheet.edit', { name: routine.data.name })} onClick={() => navigate(`routines/${routine.id}`)}>
                    <Pencil size={14} />
                  </button>
                </h2>
                <ul className="to-ficha__list">
                  {routine.data.items.map((item, i) => (
                    <ItemRow key={`${i}-${item.exerciseId}`} item={item} />
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </article>
    </div>
  )
}
