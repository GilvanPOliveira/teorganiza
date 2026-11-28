import type { Sex } from '@core/api'

/**
 * The health measures the app knows: what they are called (and every name
 * a lab report may use for them), their unit, and the usual adult
 * reference bands. Bands are general guidance from Brazilian medical
 * societies, meant to flag a number worth a look, not to diagnose.
 */

export type Status = 'low' | 'normal' | 'attention' | 'high'

export interface Marker {
  id: string
  label: string
  short: string
  unit: string
  /** Measured at home day to day, or in a lab. */
  kind: 'daily' | 'lab'
  /** One line on how to measure it, for the person who never has. */
  how?: string
  decimals: number
  /** Plausible range: anything outside is a misreading, not a result. */
  min: number
  max: number
  /** Second number (diastolic pressure). */
  pair?: { label: string; min: number; max: number }
  /** Names on lab reports, lowercase and without accents. */
  names: string[]
  status: (value: number, value2: number | undefined, sex: Sex | null) => Status
}

const bands =
  (attention: number, high: number, low?: number) =>
  (v: number): Status =>
    low !== undefined && v < low ? 'low' : v >= high ? 'high' : v >= attention ? 'attention' : 'normal'

/** Higher is better: below `low` is flagged. */
const floor =
  (low: number, attention?: number) =>
  (v: number): Status =>
    v < low ? 'low' : attention !== undefined && v < attention ? 'attention' : 'normal'

export const MARKERS: Marker[] = [
  {
    id: 'pressure',
    how: 'Com o aparelho de pressão, sentado e em repouso há 5 minutos.',
    label: 'Pressão arterial',
    short: 'Pressão',
    unit: 'mmHg',
    kind: 'daily',
    decimals: 0,
    min: 60,
    max: 260,
    pair: { label: 'mínima', min: 30, max: 160 },
    names: ['pressao arterial', 'pressao'],
    status: (s, d = 0) => (s >= 140 || d >= 90 ? 'high' : s >= 130 || d >= 85 ? 'attention' : s < 90 || d < 60 ? 'low' : 'normal'),
  },
  {
    id: 'glucose',
    how: 'Com o glicosímetro, em jejum de 8 horas.',
    label: 'Glicemia em jejum',
    short: 'Glicemia',
    unit: 'mg/dL',
    kind: 'daily',
    decimals: 0,
    min: 20,
    max: 800,
    names: ['glicemia de jejum', 'glicemia em jejum', 'glicose de jejum', 'glicose em jejum', 'glicemia', 'glicose'],
    status: bands(100, 126, 70),
  },
  {
    id: 'glucosePost',
    how: 'Com o glicosímetro, 2 horas depois de começar a refeição.',
    label: 'Glicemia após refeição',
    short: 'Glicemia pós',
    unit: 'mg/dL',
    kind: 'daily',
    decimals: 0,
    min: 20,
    max: 800,
    names: ['glicemia pos prandial', 'glicose pos prandial'],
    status: bands(140, 200, 70),
  },
  {
    id: 'heartRate',
    how: 'Batimentos por minuto parado, de manhã: no relógio, no oxímetro ou contando no pulso por 1 minuto.',
    label: 'Batimentos em repouso (frequência cardíaca)',
    short: 'Batimentos',
    unit: 'bpm',
    kind: 'daily',
    decimals: 0,
    min: 25,
    max: 220,
    names: ['frequencia cardiaca'],
    status: bands(90, 100, 50),
  },
  {
    id: 'spo2',
    how: 'Com o oxímetro de dedo, parado.',
    label: 'Saturação de oxigênio',
    short: 'Saturação',
    unit: '%',
    kind: 'daily',
    decimals: 0,
    min: 50,
    max: 100,
    names: ['saturacao'],
    status: floor(92, 95),
  },
  {
    id: 'temperature',
    how: 'Com o termômetro.',
    label: 'Temperatura',
    short: 'Temperatura',
    unit: '°C',
    kind: 'daily',
    decimals: 1,
    min: 30,
    max: 44,
    names: ['temperatura'],
    status: (v) => (v < 35 ? 'low' : v >= 37.8 ? 'high' : v >= 37.3 ? 'attention' : 'normal'),
  },
  {
    id: 'hba1c',
    label: 'Hemoglobina glicada',
    short: 'HbA1c',
    unit: '%',
    kind: 'lab',
    decimals: 1,
    min: 3,
    max: 20,
    names: ['hemoglobina glicada', 'hemoglobina glicosilada', 'hba1c', 'a1c'],
    status: bands(5.7, 6.5),
  },
  {
    id: 'cholesterol',
    label: 'Colesterol total',
    short: 'Colesterol',
    unit: 'mg/dL',
    kind: 'lab',
    decimals: 0,
    min: 50,
    max: 600,
    names: ['colesterol total'],
    status: bands(190, 240),
  },
  {
    id: 'ldl',
    label: 'Colesterol LDL',
    short: 'LDL',
    unit: 'mg/dL',
    kind: 'lab',
    decimals: 0,
    min: 10,
    max: 500,
    names: ['colesterol ldl', 'ldl colesterol', 'ldl-colesterol', 'ldl-c', 'ldl'],
    status: bands(130, 160),
  },
  {
    id: 'hdl',
    label: 'Colesterol HDL',
    short: 'HDL',
    unit: 'mg/dL',
    kind: 'lab',
    decimals: 0,
    min: 5,
    max: 200,
    names: ['colesterol hdl', 'hdl colesterol', 'hdl-colesterol', 'hdl-c', 'hdl'],
    status: (v, _d, sex) => floor(sex === 'f' ? 50 : 40)(v),
  },
  {
    id: 'triglycerides',
    label: 'Triglicerídeos',
    short: 'Triglicerídeos',
    unit: 'mg/dL',
    kind: 'lab',
    decimals: 0,
    min: 10,
    max: 3000,
    names: ['triglicerideos', 'triglicerides', 'trigliceris'],
    status: bands(150, 200),
  },
  {
    id: 'tsh',
    label: 'TSH',
    short: 'TSH',
    unit: 'µUI/mL',
    kind: 'lab',
    decimals: 2,
    min: 0.001,
    max: 100,
    names: ['tsh', 'hormonio tireoestimulante', 'tireotrofina'],
    status: (v) => (v < 0.4 ? 'low' : v > 4.5 ? 'high' : 'normal'),
  },
  {
    id: 'creatinine',
    label: 'Creatinina',
    short: 'Creatinina',
    unit: 'mg/dL',
    kind: 'lab',
    decimals: 2,
    min: 0.1,
    max: 20,
    names: ['creatinina'],
    status: (v, _d, sex) => (v > (sex === 'f' ? 1.1 : 1.3) ? 'high' : 'normal'),
  },
  {
    id: 'vitaminD',
    label: 'Vitamina D',
    short: 'Vitamina D',
    unit: 'ng/mL',
    kind: 'lab',
    decimals: 0,
    min: 1,
    max: 200,
    names: ['25-hidroxivitamina d', '25 hidroxi vitamina d', '25-oh vitamina d', 'vitamina d'],
    status: floor(20, 30),
  },
  {
    id: 'vitaminB12',
    label: 'Vitamina B12',
    short: 'B12',
    unit: 'pg/mL',
    kind: 'lab',
    decimals: 0,
    min: 30,
    max: 3000,
    names: ['vitamina b12', 'cobalamina'],
    status: floor(200, 300),
  },
  {
    id: 'ferritin',
    label: 'Ferritina',
    short: 'Ferritina',
    unit: 'ng/mL',
    kind: 'lab',
    decimals: 0,
    min: 1,
    max: 5000,
    names: ['ferritina'],
    status: (v, _d, sex) => (v < (sex === 'f' ? 15 : 30) ? 'low' : v > (sex === 'f' ? 200 : 400) ? 'high' : 'normal'),
  },
  {
    id: 'hemoglobin',
    label: 'Hemoglobina',
    short: 'Hemoglobina',
    unit: 'g/dL',
    kind: 'lab',
    decimals: 1,
    min: 3,
    max: 25,
    names: ['hemoglobina'],
    status: (v, _d, sex) => (v < (sex === 'f' ? 12 : 13) ? 'low' : v > (sex === 'f' ? 16 : 17.5) ? 'high' : 'normal'),
  },
  {
    id: 'uricAcid',
    label: 'Ácido úrico',
    short: 'Ácido úrico',
    unit: 'mg/dL',
    kind: 'lab',
    decimals: 1,
    min: 0.5,
    max: 20,
    names: ['acido urico'],
    status: (v, _d, sex) => (v > (sex === 'f' ? 6 : 7) ? 'high' : 'normal'),
  },
]

export const MARKER_BY_ID = new Map<string, Marker>(MARKERS.map((m) => [m.id, m]))

export const markerOf = (id: string): Marker | undefined => MARKER_BY_ID.get(id)

/** "5,6" or "150/95", with the marker's decimals. */
export function formatValue(marker: Marker, value: number, value2?: number): string {
  const fmt = (n: number) => n.toFixed(marker.decimals).replace('.', ',')
  return value2 !== undefined && marker.pair ? `${fmt(value)}/${fmt(value2)}` : fmt(value)
}
