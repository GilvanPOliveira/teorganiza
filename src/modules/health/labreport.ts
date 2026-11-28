import { MARKERS, type Marker } from './markers'

/**
 * Reads a lab report's text (one string per printed line) into values.
 * No AI and no network: every lab marker has the names labs print for it,
 * and the number is the first one after the name on that line, or on the
 * "Resultado" line just below. Reference ranges are skipped, and a number
 * outside the marker's plausible range is not a result. The person always
 * reviews what was found before anything is saved.
 */

export interface Found {
  marker: string
  value: number
  /** The line it came from, to show next to the value. */
  line: string
}

export interface LabReport {
  /** Collection date, ISO, when the report says it. */
  date: string | null
  found: Found[]
}

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Markers a lab report carries; glucose is both measured at home and in labs. */
const LAB_MARKERS = MARKERS.filter((m) => m.kind === 'lab' || m.id === 'glucose')

/** Every (name, marker), longest name first, so "colesterol ldl" beats "ldl". */
const NAMES = LAB_MARKERS.flatMap((m) => m.names.map((name) => ({ name, marker: m }))).sort((a, b) => b.name.length - a.name.length)

/** Lines naming something close but different, that would otherwise match. */
const NOT_THIS: Record<string, RegExp> = {
  hemoglobin: /corpuscular|glicad|glicosilad|\bhcm\b|\bchcm\b/,
  hdl: /nao[ -]?hdl/,
  ldl: /nao[ -]?hdl|vldl/,
  glucose: /urina|pos[ -]?prandial|curva|tolerancia|\b1h\b|\b2h\b/,
  creatinine: /clearance|urina|depuracao/,
}

/** A number, not one that is part of a name (the 25 of "25-OH", the 1 of "B1"). */
const NUMBER = /(?<![\w,.])(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?![\w]|-[a-z])/g

/** "1.234,5" → 1234.5; "5,6" → 5.6; "5.6" → 5.6; "1.234" → 1234. */
export function parseNumber(text: string): number | null {
  let t = text
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** The first plausible number in a piece of line, stopping at the reference range. */
function firstValue(rest: string, marker: Marker): number | null {
  const cut = rest.search(/refer|intervalo|desejavel|ideal|otimo|limitrofe|\bvr\b/)
  const scope = cut >= 0 ? rest.slice(0, cut) : rest
  for (const match of scope.matchAll(NUMBER)) {
    const before = scope.slice(Math.max(0, match.index - 2), match.index)
    if (/[<>]/.test(before)) continue
    const value = parseNumber(match[1])
    if (value !== null && value >= marker.min && value <= marker.max) return value
  }
  return null
}

function findName(line: string): { marker: Marker; end: number } | null {
  for (const { name, marker } of NAMES) {
    const re = new RegExp(`(^|[^a-z0-9])${name.replace(/[-]/g, '[- ]?')}(?![a-z0-9])`)
    const match = re.exec(line)
    if (!match) continue
    if (NOT_THIS[marker.id]?.test(line)) return null
    return { marker, end: match.index + match[0].length }
  }
  return null
}

const DATE = /(\d{2})\/(\d{2})\/(\d{4})/

/** Collection date: the date on a "coleta" line, else the first date that is not a birth date. */
function reportDate(lines: string[]): string | null {
  const iso = (m: RegExpExecArray) => `${m[3]}-${m[2]}-${m[1]}`
  for (const line of lines) {
    if (!/colet|coleta/.test(line)) continue
    const m = DATE.exec(line)
    if (m) return iso(m)
  }
  for (const line of lines) {
    if (/nasc|emiss|emitid|impress|liberad|assinad/.test(line)) continue
    const m = DATE.exec(line)
    if (m) return iso(m)
  }
  return null
}

export function readLabReport(rawLines: readonly string[]): LabReport {
  const lines = rawLines.map(plain).filter(Boolean)
  const found: Found[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const hit = findName(lines[i])
    if (!hit || seen.has(hit.marker.id)) continue
    let value = firstValue(lines[i].slice(hit.end), hit.marker)
    let source = rawLines[i]
    // Name on one line, the number on a "Resultado" line (or alone) just below.
    for (let j = i + 1; value === null && j <= i + 3 && j < lines.length; j++) {
      if (findName(lines[j])) break
      if (/^resultado|^\d/.test(lines[j])) {
        value = firstValue(lines[j].replace(/^resultado:?/, ''), hit.marker)
        source = `${rawLines[i]} … ${rawLines[j]}`
      }
    }
    if (value === null) continue
    seen.add(hit.marker.id)
    found.push({ marker: hit.marker.id, value, line: source.trim() })
  }
  return { date: reportDate(lines), found }
}
