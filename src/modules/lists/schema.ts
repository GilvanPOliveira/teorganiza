import { z } from 'zod'

/**
 * A named list. The kind decides which area shows it: a project, the
 * house, work, or films and series. Everything that is "a list of X" is
 * one of these — a new kind is a new area, never a new module.
 */
export const listSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(['project', 'home', 'work', 'media', 'general']),
  archived: z.boolean(),
  /** Deadline, for projects. Lists written before deadlines existed have none. */
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
})

export type List = z.infer<typeof listSchema>
export type ListKind = List['kind']

/**
 * One item with a state. `status` drives the kanban; `done` mirrors
 * status === 'done' so a plain checkbox list stays a one-field filter.
 */
export const itemSchema = z.object({
  listId: z.string().nullable(),
  title: z.string().trim().min(1),
  status: z.enum(['todo', 'doing', 'done']),
  done: z.boolean(),
  /** Calendar date, 'YYYY-MM-DD'. */
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  priority: z.enum(['low', 'normal', 'high']),
})

export type Item = z.infer<typeof itemSchema>
export type Status = Item['status']
