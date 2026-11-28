import type { Restriction, Sex } from '@core/api'
import type { Exam } from './schema'

/**
 * Routine check-ups, from the screening calendars of the Ministério da
 * Saúde / INCA and the usual medical-society guidance, adjusted to the
 * person: age and sex pick the list, and Meus dados, the exams and the
 * readings change it (high pressure brings monthly pressure checks and a
 * cardiologist, high glucose a glycated hemoglobin every 6 months, a
 * pregnancy the prenatal visits…). Each change says why. A starting point
 * to talk over with a doctor, not a prescription.
 */
export interface Checkup {
  id: string
  name: string
  kind: Exam['kind']
  /** Months between one and the next, for anyone it applies to. */
  every: number
  from: number
  to?: number
  sex?: Sex
  /** Words that identify it among the exams already registered. */
  match: string[]
}

export const CHECKUPS: Checkup[] = [
  { id: 'clinico', name: 'Consulta clínica (check-up)', kind: 'consult', every: 12, from: 18, match: ['check-up', 'checkup', 'clinico', 'clinica geral', 'consulta clinica'] },
  { id: 'pressao', name: 'Medir a pressão arterial', kind: 'other', every: 12, from: 18, match: ['pressao', 'mapa'] },
  { id: 'dentista', name: 'Dentista', kind: 'consult', every: 6, from: 0, match: ['dentista', 'odonto', 'limpeza'] },
  { id: 'hemograma', name: 'Hemograma', kind: 'lab', every: 12, from: 18, match: ['hemograma'] },
  { id: 'glicemia', name: 'Glicemia em jejum', kind: 'lab', every: 36, from: 35, match: ['glicemia', 'glicose'] },
  { id: 'hba1c', name: 'Hemoglobina glicada', kind: 'lab', every: 6, from: 0, match: ['hemoglobina glicada', 'glicada', 'hba1c'] },
  { id: 'colesterol', name: 'Colesterol e triglicerídeos', kind: 'lab', every: 60, from: 20, match: ['colesterol', 'lipidico', 'triglicer'] },
  { id: 'cardio', name: 'Cardiologista', kind: 'consult', every: 12, from: 0, match: ['cardiolog', 'eletrocardiograma', 'ecocardiograma', 'ecg'] },
  { id: 'atividade', name: 'Avaliação médica para atividade física', kind: 'consult', every: 12, from: 35, match: ['atestado', 'avaliacao medica', 'medicina esportiva', 'ergometrico'] },
  { id: 'ortopedia', name: 'Ortopedista ou fisioterapeuta', kind: 'consult', every: 12, from: 0, match: ['ortoped', 'fisioterap'] },
  { id: 'oftalmo', name: 'Oftalmologista', kind: 'consult', every: 24, from: 18, match: ['oftalmo', 'vista', 'olhos', 'fundo de olho'] },
  { id: 'prenatal', name: 'Consulta de pré-natal', kind: 'consult', every: 1, from: 0, sex: 'f', match: ['pre-natal', 'prenatal', 'pre natal', 'obstetr'] },
  { id: 'papanicolau', name: 'Papanicolau (preventivo)', kind: 'lab', every: 36, from: 25, to: 64, sex: 'f', match: ['papanicolau', 'preventivo', 'citopatologico'] },
  { id: 'mamografia', name: 'Mamografia', kind: 'image', every: 24, from: 50, to: 69, sex: 'f', match: ['mamografia'] },
  { id: 'prostata', name: 'Avaliação da próstata (urologista)', kind: 'consult', every: 12, from: 50, sex: 'm', match: ['prostata', 'psa', 'urologista'] },
  { id: 'intestino', name: 'Rastreio de câncer de intestino', kind: 'lab', every: 12, from: 45, to: 75, match: ['sangue oculto', 'colonoscopia', 'intestino'] },
  { id: 'densitometria', name: 'Densitometria óssea', kind: 'image', every: 24, from: 65, sex: 'f', match: ['densitometria'] },
  { id: 'densitometria-m', name: 'Densitometria óssea', kind: 'image', every: 24, from: 70, sex: 'm', match: ['densitometria'] },
]

/** Check-ups that only exist because of something about the person. */
const ONLY_WHEN = new Set(['hba1c', 'cardio', 'atividade', 'ortopedia', 'prenatal'])

/** Why a check-up is on the list, or comes more often. */
export type Reason = 'hypertension' | 'bmi' | 'obesity' | 'waist' | 'glucose' | 'diabetes' | 'ldl' | 'pregnancy' | 'joints' | 'training'

/** What the rest of the app knows that changes the list. */
export interface Person {
  age: number | null
  sex: Sex | null
  bmi: number | null
  flags?: readonly Restriction[]
  /** Latest readings, when there are any. */
  glucose?: number | null
  hba1c?: number | null
  ldl?: number | null
  /** The latest pressure was 140/90 or more. */
  pressureHigh?: boolean
  /** Training days a week, from Meus dados. */
  trainingDays?: number | null
  /** Waist measure against the usual limits, from Meus dados. */
  waistRisk?: 'normal' | 'attention' | 'high' | null
}

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** A number written on any exam counts as that check-up done (pressure taken at a consultation). */
function measured(id: string, values: Exam['values']): boolean {
  if (!values) return false
  if (id === 'pressao') return Boolean(values.systolic)
  if (id === 'glicemia') return Boolean(values.glucose)
  if (id === 'colesterol') return Boolean(values.ldl)
  return false
}

export type CheckupStatus = 'due' | 'soon' | 'ok'

export interface CheckupPlan {
  checkup: Checkup
  /** Months between, for this person. */
  every: number
  /** What about the person put it here or made it more frequent. */
  reasons: Reason[]
  last: string | null
  next: string | null
  status: CheckupStatus
}

const addMonths = (iso: string, months: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + months, Math.min(d, 28)))
  return date.toISOString().slice(0, 10)
}

/** For one check-up: whether it applies, how often, and why it differs from the default. */
function adjust(c: Checkup, p: Person): { applies: boolean; every: number; reasons: Reason[] } {
  const age = p.age ?? 0
  const flags = p.flags ?? []
  const hypertension = flags.includes('hypertension') || Boolean(p.pressureHigh)
  const bmi = p.bmi ?? 0
  const glucose = p.glucose ?? 0
  const hba1c = p.hba1c ?? 0
  const diabetes = glucose >= 126 || hba1c >= 6.5
  const prediabetes = !diabetes && (glucose >= 100 || hba1c >= 5.7)
  let every = c.every
  let from = c.from
  const reasons: Reason[] = []
  let applies = !ONLY_WHEN.has(c.id)

  const set = (months: number, why: Reason, start?: number) => {
    every = months
    reasons.push(why)
    if (start !== undefined) from = start
  }
  const add = (why: Reason, months?: number) => {
    applies = true
    reasons.push(why)
    if (months !== undefined) every = months
  }

  switch (c.id) {
    case 'pressao':
      if (hypertension) set(1, 'hypertension')
      break
    case 'cardio':
      if (hypertension) add('hypertension')
      break
    case 'glicemia':
      if (diabetes || prediabetes) set(6, diabetes ? 'diabetes' : 'glucose', 0)
      else if (bmi >= 25) set(12, 'bmi', 18)
      else if (p.waistRisk === 'attention' || p.waistRisk === 'high') set(12, 'waist', 18)
      break
    case 'hba1c':
      if (diabetes || prediabetes) add(diabetes ? 'diabetes' : 'glucose', diabetes ? 3 : 6)
      break
    case 'colesterol': {
      const why: Reason | null = (p.ldl ?? 0) >= 160 ? 'ldl' : hypertension ? 'hypertension' : diabetes || prediabetes ? 'glucose' : bmi >= 30 ? 'obesity' : p.waistRisk === 'high' ? 'waist' : null
      if (why) set(12, why, 0)
      break
    }
    case 'oftalmo':
      if (diabetes) set(12, 'diabetes')
      break
    case 'atividade':
      if ((p.trainingDays ?? 0) >= 1) add('training')
      break
    case 'ortopedia':
      if (flags.some((f) => f === 'knee' || f === 'back' || f === 'shoulder' || f === 'wrist')) add('joints')
      break
    case 'prenatal':
      if (flags.includes('pregnancy')) add('pregnancy')
      break
  }
  const inAge = age >= from && (c.to === undefined || age <= c.to)
  return { applies: applies && inAge && (!c.sex || c.sex === p.sex), every, reasons }
}

/** The check-ups for this person, when each was last done and whether it is due. */
export function checkupsFor(person: Person, exams: readonly (Pick<Exam, 'name' | 'date'> & Partial<Pick<Exam, 'values'>>)[], today: string): CheckupPlan[] {
  // Without an age and a sex the list would guess wrong (a preventive for a man), so there is none.
  if (person.age === null || person.sex === null) return []
  return CHECKUPS.map((checkup) => ({ checkup, ...adjust(checkup, person) }))
    .filter((c) => c.applies)
    .filter((c, i, list) => list.findIndex((o) => o.checkup.name === c.checkup.name) === i)
    .map(({ checkup, every, reasons }) => {
      const last =
        exams
          .filter((e) => e.date <= today && (checkup.match.some((word) => plain(e.name).includes(word)) || measured(checkup.id, e.values)))
          .map((e) => e.date)
          .sort()
          .at(-1) ?? null
      const next = last ? addMonths(last, every) : null
      const status: CheckupStatus = !next || next <= today ? 'due' : next <= addMonths(today, every <= 1 ? 0 : 2) ? 'soon' : 'ok'
      return { checkup, every, reasons, last, next, status }
    })
    .sort((a, b) => ['due', 'soon', 'ok'].indexOf(a.status) - ['due', 'soon', 'ok'].indexOf(b.status) || b.reasons.length - a.reasons.length)
}
