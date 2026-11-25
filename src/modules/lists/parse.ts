import { toLocalISODate } from '@core/api'

/**
 * "Write it the way you say it": `pagar a luz sexta #casa` becomes the
 * title "pagar a luz", due next Friday, tagged #casa. Understands hoje,
 * amanhã, weekday names (with or without -feira) and dd/mm.
 */
export interface ParsedTask {
  title: string
  due: string | null
  tags: string[]
  priority: 'low' | 'normal' | 'high'
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1,
  terca: 2, ter: 2,
  quarta: 3, qua: 3,
  quinta: 4, qui: 4,
  sexta: 5, sex: 5,
  sabado: 6, sab: 6,
}

function plain(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** The word as a date, or null when it is just a word. */
function dateFrom(word: string, today: Date): string | null {
  const w = plain(word).replace(/-feira$/, '')
  if (w === 'hoje') return toLocalISODate(today)
  if (w === 'amanha') return toLocalISODate(addDays(today, 1))
  if (w in WEEKDAYS) {
    // Always ahead: "sexta" on a Friday means next Friday.
    const ahead = (WEEKDAYS[w] - today.getDay() + 7) % 7 || 7
    return toLocalISODate(addDays(today, ahead))
  }
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(w)
  if (match) {
    const [day, month] = [Number(match[1]), Number(match[2])]
    if (day < 1 || day > 31 || month < 1 || month > 12) return null
    let candidate = new Date(today.getFullYear(), month - 1, day)
    if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      candidate = new Date(today.getFullYear() + 1, month - 1, day)
    }
    return toLocalISODate(candidate)
  }
  return null
}

export function parseTask(text: string, today: Date = new Date()): ParsedTask {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const kept: string[] = []
  const tags: string[] = []
  let due: string | null = null
  let priority: ParsedTask['priority'] = 'normal'

  for (const word of words) {
    if (word.startsWith('#') && word.length > 1) {
      tags.push(word.slice(1))
      continue
    }
    if (word === '!' || word === '!!') {
      priority = 'high'
      continue
    }
    const date: string | null = due === null ? dateFrom(word, today) : null
    if (date) {
      due = date
      // "na sexta", "até amanhã": the little word before goes too.
      const last = plain(kept[kept.length - 1] ?? '')
      if (['na', 'no', 'ate', 'em', 'dia'].includes(last)) kept.pop()
      continue
    }
    kept.push(word)
  }

  const title = kept.join(' ')
  return { title: title || text.trim(), due, tags, priority }
}
