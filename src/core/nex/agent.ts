import Anthropic from '@anthropic-ai/sdk'
import type { ZodTypeAny } from 'zod'
import { toLocalISODate } from '@core/api/dates'
import type { Envelope } from '@core/api/types'
import * as repository from '@core/db/repository'
import { getCollection, getCollections, getModule } from '@core/registry/registry'
import { describeShape } from './shape'

export const NEX_MODEL = 'claude-opus-5-5'

/** How many recent records of each collection go into the snapshot. */
const SNAPSHOT_PER_COLLECTION = 25
const MAX_TOOL_ROUNDS = 8

/** Something Nex changed, shown under its answer. */
export interface NexAction {
  kind: 'created' | 'updated'
  area: string
  label: string
}

export type NexMessage = Anthropic.Beta.BetaMessageParam

export interface NexTurn {
  messages: NexMessage[]
  text: string
  actions: NexAction[]
}

/** Every module collection, with its area name and field shapes. */
function userCollections() {
  return getCollections()
    .filter((collection) => collection.moduleId !== 'core')
    .map((collection) => ({
      ...collection,
      area: getModule(collection.moduleId)?.name ?? collection.moduleId,
    }))
}

function compact(data: unknown): string {
  const text = JSON.stringify(data)
  return text.length > 400 ? `${text.slice(0, 400)}…` : text
}

function line(record: Envelope<unknown>, describe: (record: Envelope<unknown>) => string): string {
  return `- id=${record.id} · ${describe(record)} · ${compact(record.data)}`
}

/**
 * The system prompt: what Nex is, what it may touch, and a snapshot of the
 * most recent records. Built fresh for each conversation, read from the
 * same local database every screen uses; nothing leaves the browser except
 * this request to the API the user holds the key for.
 */
export async function buildSystemPrompt(today = new Date()): Promise<string> {
  const sections: string[] = []
  for (const collection of userCollections()) {
    const rows = (await repository.readAll<unknown>(collection.path))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, SNAPSHOT_PER_COLLECTION)
    const header = `### ${collection.path} (${collection.area})\nfields: ${describeShape(collection.def.schema as ZodTypeAny)}`
    const body = rows.length ? rows.map((row) => line(row, collection.def.describe)).join('\n') : '(empty)'
    sections.push(`${header}\n${body}`)
  }

  return [
    'You are Nex, the assistant inside TeOrganiza, a personal organizer that runs entirely in the user\'s browser.',
    'Answer in Brazilian Portuguese, briefly and plainly. Use the user\'s own data below; when it does not hold the answer, say so instead of guessing.',
    'You can create and update records with the tools. Do it when the user asks for something to be added, scheduled, marked or changed; for a question, just answer.',
    'Dates are YYYY-MM-DD and times HH:MM, in the user\'s local time. Money amounts follow the examples of each collection (integers mean cents).',
    'After changing anything, say in one short line what you did.',
    `Today is ${toLocalISODate(today)} (${today.toLocaleDateString('pt-BR', { weekday: 'long' })}).`,
    '',
    '## Collections (most recent records first)',
    sections.join('\n\n'),
  ].join('\n')
}

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'create_record',
    description:
      'Creates one record in a collection, e.g. a task in lists/items or an event in calendar/events. `data` must match the collection fields listed in the system prompt.',
    input_schema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection path, e.g. "lists/items".' },
        data: { type: 'object', description: 'The record fields.' },
      },
      required: ['collection', 'data'],
    },
  },
  {
    name: 'update_record',
    description: 'Changes some fields of an existing record, found by its id.',
    input_schema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        id: { type: 'string' },
        changes: { type: 'object', description: 'Only the fields to change.' },
      },
      required: ['collection', 'id', 'changes'],
    },
  },
  {
    name: 'find_records',
    description:
      'Searches a collection beyond the recent records in the snapshot. Returns up to 30 records whose fields contain the text.',
    input_schema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        text: { type: 'string', description: 'Words to look for; empty returns the newest records.' },
      },
      required: ['collection'],
    },
  },
]

function isUserCollection(path: unknown): path is string {
  return typeof path === 'string' && userCollections().some((collection) => collection.path === path)
}

async function runTool(
  name: string,
  input: Record<string, unknown>,
  deviceId: string,
  actions: NexAction[],
): Promise<{ content: string; isError: boolean }> {
  const { collection } = input
  if (!isUserCollection(collection)) {
    return { content: `Unknown collection "${String(collection)}".`, isError: true }
  }
  const { def, moduleId } = getCollection(collection)
  const area = getModule(moduleId)?.name ?? moduleId

  try {
    if (name === 'create_record') {
      const id = await repository.createRecord(collection, input.data, deviceId)
      const record = await repository.readOne(collection, id)
      actions.push({ kind: 'created', area, label: record ? def.describe(record) : id })
      return { content: `Created ${id}.`, isError: false }
    }
    if (name === 'update_record') {
      await repository.updateRecord(collection, String(input.id), input.changes as object, deviceId)
      const record = await repository.readOne(collection, String(input.id))
      actions.push({ kind: 'updated', area, label: record ? def.describe(record) : String(input.id) })
      return { content: 'Updated.', isError: false }
    }
    if (name === 'find_records') {
      const words = String(input.text ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean)
      const rows = (await repository.readAll<unknown>(collection))
        .filter((row) => {
          const haystack = `${def.describe(row)} ${JSON.stringify(row.data)}`.toLocaleLowerCase()
          return words.every((word) => haystack.includes(word))
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 30)
      return { content: rows.map((row) => line(row, def.describe)).join('\n') || '(nothing found)', isError: false }
    }
    return { content: `Unknown tool "${name}".`, isError: true }
  } catch (error) {
    // A schema rejection comes back to the model, which fixes the fields and tries again.
    return { content: error instanceof Error ? error.message : String(error), isError: true }
  }
}

/**
 * One user turn: sends the conversation, runs the tools Nex asks for, and
 * loops until it answers. Returns the whole conversation to keep.
 */
export async function askNex({
  apiKey,
  system,
  messages,
  deviceId,
}: {
  apiKey: string
  system: string
  messages: NexMessage[]
  deviceId: string
}): Promise<NexTurn> {
  // The key is the user's own, typed into this device; the request goes
  // straight from the browser to the API, as there is no server of ours.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const conversation = [...messages]
  const actions: NexAction[] = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: NEX_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
      system,
      tools,
      messages: conversation,
    })
    conversation.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'refusal') {
      return { messages: conversation, text: 'O Nex não pode ajudar com esse pedido.', actions }
    }
    if (response.stop_reason === 'pause_turn') continue

    const calls = response.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use')
    if (calls.length === 0 || response.stop_reason !== 'tool_use') {
      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim()
      return { messages: conversation, text, actions }
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const call of calls) {
      const result = await runTool(call.name, call.input as Record<string, unknown>, deviceId, actions)
      results.push({ type: 'tool_result', tool_use_id: call.id, content: result.content, is_error: result.isError })
    }
    conversation.push({ role: 'user', content: results })
  }

  return { messages: conversation, text: 'O Nex parou depois de muitas etapas. Tente um pedido mais curto.', actions }
}

/** A readable message for the errors a user can act on. */
export function nexErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'A chave da API foi recusada. Confira em Configurações › Nex.'
  if (error instanceof Anthropic.PermissionDeniedError) return 'Esta chave não tem permissão para usar o modelo.'
  if (error instanceof Anthropic.RateLimitError) return 'Muitos pedidos seguidos. Espere um pouco e tente de novo.'
  if (error instanceof Anthropic.APIConnectionError) return 'Sem conexão com a API. Verifique a internet.'
  if (error instanceof Anthropic.APIError) return `A API respondeu com erro ${error.status ?? ''}: ${error.message}`
  return error instanceof Error ? error.message : String(error)
}
