import { describe, expect, it } from 'vitest'
import { parseNumber, readLabReport } from './labreport'

const values = (lines: string[]) => Object.fromEntries(readLabReport(lines).found.map((f) => [f.marker, f.value]))

describe('lab report reader', () => {
  it('reads Brazilian number formats', () => {
    expect(parseNumber('5,6')).toBe(5.6)
    expect(parseNumber('1.234,5')).toBe(1234.5)
    expect(parseNumber('1.234')).toBe(1234)
    expect(parseNumber('5.6')).toBe(5.6)
    expect(parseNumber('92')).toBe(92)
  })

  it('reads values on the same line, skipping the reference range', () => {
    expect(
      values([
        'GLICOSE   92 mg/dL   Valores de referência: 70 a 99 mg/dL',
        'HEMOGLOBINA GLICADA (HbA1c)   5,6 %   Referência: até 5,6%',
        'COLESTEROL TOTAL ....... 198 mg/dL   Desejável: < 190',
        'HDL-COLESTEROL  52 mg/dL  > 40',
        'LDL-COLESTEROL 121 mg/dL',
        'VLDL-COLESTEROL 25 mg/dL',
        'Colesterol não-HDL 146 mg/dL',
        'TRIGLICERÍDEOS 120 mg/dL',
        'TSH - Hormônio Tireoestimulante 2,15 µUI/mL 0,4 a 4,5',
        'Creatinina 0,98 mg/dL',
        '25-Hidroxivitamina D 28 ng/mL',
      ]),
    ).toEqual({ glucose: 92, hba1c: 5.6, cholesterol: 198, hdl: 52, ldl: 121, triglycerides: 120, tsh: 2.15, creatinine: 0.98, vitaminD: 28 })
  })

  it('does not take a number that is part of the name', () => {
    expect(values(['VITAMINA D (25-OH)                 28 ng/mL        > 30 ng/mL'])).toEqual({ vitaminD: 28 })
  })

  it('reads the number from the "Resultado" line under the name', () => {
    expect(values(['GLICEMIA DE JEJUM', 'Material: Soro   Método: Enzimático', 'Resultado: 104 mg/dL', 'Valor de referência: 70 a 99'])).toEqual({ glucose: 104 })
  })

  it('does not take the hemoglobin of an index, nor glucose in urine', () => {
    expect(values(['Hemoglobina corpuscular média 29,5 pg', 'Hemoglobina 14,2 g/dL', 'Glicose (urina) Negativo'])).toEqual({ hemoglobin: 14.2 })
  })

  it('ignores implausible numbers and keeps the first result of each', () => {
    expect(values(['Glicose 2024', 'Glicose 88 mg/dL', 'Glicose 95 mg/dL'])).toEqual({ glucose: 88 })
  })

  it('finds the collection date, not the birth date', () => {
    expect(readLabReport(['Paciente: Fulano   Nascimento: 10/05/1990', 'Data da coleta: 12/10/2026 07:40']).date).toBe('2026-10-12')
    expect(readLabReport(['Nasc.: 10/05/1990', 'Emitido em 14/10/2026', 'Atendimento 12/10/2026']).date).toBe('2026-10-12')
  })
})
