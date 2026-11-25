import { describe, expect, it } from 'vitest'
import { parseTask } from './parse'

// Wednesday, 25 November 2026.
const TODAY = new Date(2026, 10, 25, 10, 0)

describe('parseTask', () => {
  it('takes the date and the tag out of the title', () => {
    expect(parseTask('pagar a luz sexta #casa', TODAY)).toEqual({
      title: 'pagar a luz',
      due: '2026-11-27',
      tags: ['casa'],
      priority: 'normal',
    })
  })

  it('understands hoje, amanhã and -feira, and drops the "na" before them', () => {
    expect(parseTask('ligar pro banco hoje', TODAY).due).toBe('2026-11-25')
    expect(parseTask('comprar pão amanhã', TODAY).due).toBe('2026-11-26')
    expect(parseTask('reunião na segunda-feira', TODAY)).toMatchObject({ title: 'reunião', due: '2026-11-30' })
  })

  it('never puts a weekday in the past: the same weekday means next week', () => {
    expect(parseTask('academia quarta', TODAY).due).toBe('2026-12-02')
  })

  it('reads dd/mm, rolling into next year when the date already passed', () => {
    expect(parseTask('dentista 10/12', TODAY).due).toBe('2026-12-10')
    expect(parseTask('IPVA 15/01', TODAY).due).toBe('2027-01-15')
    expect(parseTask('placar 40/50', TODAY)).toMatchObject({ title: 'placar 40/50', due: null })
  })

  it('marks ! as high priority and keeps everything else as written', () => {
    expect(parseTask('! renovar passaporte #docs #viagem', TODAY)).toEqual({
      title: 'renovar passaporte',
      due: null,
      tags: ['docs', 'viagem'],
      priority: 'high',
    })
  })

  it('uses only the first date, so a second one stays in the title', () => {
    expect(parseTask('mudar reunião de sexta para segunda', TODAY)).toMatchObject({
      title: 'mudar reunião de para segunda',
      due: '2026-11-27',
    })
  })
})
