import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { describeShape } from './shape'

describe('describeShape', () => {
  it('names fields, enums, dates and nullables', () => {
    const schema = z.object({
      title: z.string().trim().min(1),
      due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      status: z.enum(['todo', 'done']),
      amount: z.number().int(),
      tags: z.array(z.string()),
    })
    expect(describeShape(schema)).toBe(
      '{ title: string; due: date YYYY-MM-DD | null; status: "todo" | "done"; amount: integer; tags: string[] }',
    )
  })
})
